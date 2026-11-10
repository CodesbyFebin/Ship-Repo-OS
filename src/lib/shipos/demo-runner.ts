// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Demo Maker job runner. repo URL → ingest → audit (ensure) →
// deterministic demo script → LLM voiceover enhancement → persist.
// Fire-and-forget like the auditor/optimizer; the client polls the API.
// The audit is the demo's spine ("audit before filming") — when no ready
// audit exists the runner runs one inline; if that fails the film proceeds
// on repo facts alone and the audit-dependent acts drop out of the cut.
// ─────────────────────────────────────────────────────────────────────────────
import type { DemoJob } from "@prisma/client";
import { db } from "@/lib/db";
import { ingestRepo, RepoNotFoundError } from "./ingest";
import { runAuditJob } from "./repo-auditor";
import { normalizeRepoUrl } from "./ingest";
import type { AuditRepoMeta, RepoAudit } from "./audit-types";
import { buildDemoScript, enhanceDemoVo, type DemoStyle, type DemoTarget, type DemoVoice } from "./demo-engine";
import type { VideoScript } from "./story-engine";

export type DemoJobParams = {
  targetSeconds: DemoTarget;
  style: DemoStyle;
  voice: DemoVoice;
};

const DEMO_STAGES = ["queued", "ingesting", "auditing", "writing", "enhancing", "done"] as const;

export function isDemoTarget(v: unknown): v is DemoTarget {
  return v === 60 || v === 150 || v === 300;
}

export function isDemoStyle(v: unknown): v is DemoStyle {
  return v === "launch" || v === "hackathon" || v === "academic" || v === "product";
}

export function isDemoVoice(v: unknown): v is DemoVoice {
  return v === "calm" || v === "energetic" || v === "authoritative";
}

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Compact audit facts the player + UI render (persisted in metaJson). */
export interface DemoAuditFacts {
  score: number;
  grade: string;
  checksPassed: number;
  checksTotal: number;
  checksFailed: number;
  pointsAtStake: number;
  fixesCount: number;
  topFixTitle: string;
  topFixPoints: number;
  categories: { name: string; score: number; max: number }[];
}

/** What the DemoJob persists as metaJson — repo snapshot + audit facts + demo extras. */
export interface DemoMeta {
  repo: AuditRepoMeta;
  audit: DemoAuditFacts | null;
  repoTitle: string;
  tagline: string;
  modules: string[];
  frameworks: string[];
  version: string | null;
  installCmd: string;
  testCmd: string;
  contributors: number;
  commitCount: number | null;
  envProvided: boolean;
}

function auditFactsOf(audit: RepoAudit): DemoAuditFacts {
  return {
    score: audit.score,
    grade: audit.grade,
    checksPassed: audit.stats.checksPassed,
    checksTotal: audit.stats.checksTotal,
    checksFailed: audit.stats.checksFailed,
    pointsAtStake: audit.stats.pointsAtStake,
    fixesCount: audit.fixes.length,
    topFixTitle: audit.fixes[0]?.title ?? "the heaviest fix",
    topFixPoints: audit.fixes[0]?.points ?? 0,
    categories: audit.categories.map((c) => ({ name: c.name, score: c.score, max: c.max })),
  };
}

function modulesOfRunner(repo: Awaited<ReturnType<typeof ingestRepo>>): string[] {
  const skip = new Set([".github", ".vscode", "node_modules", "dist", "build", ".git"]);
  const dirs = repo.rootFiles.filter((f) => !skip.has(f.toLowerCase()) && !f.includes("."));
  const files = repo.rootFiles.filter((f) => f.includes(".") && !f.startsWith("."));
  return [...dirs, ...files].slice(0, 8);
}

function installCmdOf(repo: Awaited<ReturnType<typeof ingestRepo>>): string {
  const pm = repo.detected.packageManager;
  if (pm === "pnpm") return "pnpm install && pnpm dev";
  if (pm === "yarn") return "yarn && yarn dev";
  if (pm === "bun") return "bun install && bun dev";
  if (pm === "npm" || repo.manifest) return "npm install && npm run dev";
  if (repo.rootFiles.some((f) => /^cargo\.toml$/i.test(f))) return "cargo run";
  if (repo.rootFiles.some((f) => /^go\.mod$/i.test(f))) return "go run .";
  if (repo.rootFiles.some((f) => /^pyproject\.toml$/i.test(f))) return "pip install -e .";
  return "clone, configure, run";
}

function testCmdOf(repo: Awaited<ReturnType<typeof ingestRepo>>): string {
  const s = repo.detected.scripts ?? {};
  if (s.test) return s.test.slice(0, 60);
  if (repo.hasTests) return "test runner detected";
  return "echo 'no test suite yet'";
}

function metaSnapshot(repo: Awaited<ReturnType<typeof ingestRepo>>): AuditRepoMeta {
  const langPcts = repo.detected.languages.slice(0, 5).map((l) => ({ name: l.name, pct: l.pct }));
  return {
    description: repo.description,
    language: repo.detected.language,
    languages: langPcts,
    stars: repo.stars,
    forks: repo.forks,
    license: repo.license?.spdx ?? null,
    topics: repo.topics,
    hasTests: repo.hasTests,
    ciWorkflows: repo.ciWorkflows,
    packageManager: repo.detected.packageManager,
    homepage: repo.homepage,
    commitCount: repo.commitCount,
    releaseCount: repo.releaseCount,
  };
}

function buildDemoMeta(repo: Awaited<ReturnType<typeof ingestRepo>>, audit: RepoAudit | null): DemoMeta {
  return {
    repo: metaSnapshot(repo),
    audit: audit ? auditFactsOf(audit) : null,
    repoTitle: `${repo.owner}/${repo.repo}`,
    tagline: repo.description || `A ${repo.detected.language} project built in the open.`,
    modules: modulesOfRunner(repo),
    frameworks: repo.detected.frameworks.slice(0, 4),
    version: repo.manifest?.version ?? null,
    installCmd: installCmdOf(repo),
    testCmd: testCmdOf(repo),
    contributors: repo.contributors.length,
    commitCount: repo.commitCount,
    envProvided: Boolean(repo.envExample),
  };
}

/**
 * Ensure a ready audit exists for the repo. Reuses the most recent ready audit;
 * otherwise runs one inline (awaited — the demo needs its facts).
 * Returns null when the audit cannot be produced (the demo still films).
 */
async function ensureAudit(repoUrl: string): Promise<RepoAudit | null> {
  const existing = await db.auditJob.findFirst({
    where: { repoUrl, status: "ready", auditJson: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.auditJson) return parse<RepoAudit | null>(existing.auditJson, null);

  const job = await db.auditJob.create({
    data: { repoUrl, owner: "", repo: "", status: "processing", stage: "queued" },
  });
  try {
    await runAuditJob(job.id, repoUrl);
  } catch {
    // audit failure must not kill the demo — the film degrades to repo facts
    return null;
  }
  const done = await db.auditJob.findUnique({ where: { id: job.id } });
  return done?.auditJson ? parse<RepoAudit | null>(done.auditJson, null) : null;
}

export async function runDemoJob(jobId: string, repoUrl: string, params: DemoJobParams): Promise<void> {
  const touch = (data: Parameters<typeof db.demoJob.update>[0]["data"]) =>
    db.demoJob.update({ where: { id: jobId }, data });

  try {
    const normalized = normalizeRepoUrl(repoUrl);
    await touch({ stage: "ingesting" });
    const repo = await ingestRepo(normalized.url);
    const source = repo.source === "github-api" ? "github" : "web-scrape";
    await touch({ owner: repo.owner, repo: repo.repo, source });

    await touch({ stage: "auditing" });
    const audit = await ensureAudit(normalized.url);

    await touch({ stage: "writing" });
    const script: VideoScript = buildDemoScript(repo, audit, {
      targetSeconds: params.targetSeconds,
      style: params.style,
    });
    await touch({ schemaJson: JSON.stringify(script) });

    await touch({ stage: "enhancing" });
    const lines = await enhanceDemoVo(repo, audit, script, { style: params.style });
    let enhanced = false;
    let finalScript = script;
    if (lines && lines.length === script.scenes.length) {
      finalScript = {
        ...script,
        scenes: script.scenes.map((sc, i) => ({
          ...sc,
          vo: Array.isArray(lines[i]) && lines[i].length >= 2 ? lines[i] : sc.vo,
        })),
      };
      enhanced = true;
    }

    await touch({
      status: "ready",
      stage: "done",
      schemaJson: JSON.stringify(finalScript),
      metaJson: JSON.stringify(buildDemoMeta(repo, audit)),
      enhanced,
    });
    console.log(`[shipos:demo] ${repo.owner}/${repo.repo} ready — ${finalScript.scenes.length} scenes, ${finalScript.totalDuration}s, ${enhanced ? "LLM" : "template"} voiceover`);
  } catch (err) {
    console.error("[shipos:demo] job failed:", err);
    await touch({
      status: "error",
      error:
        err instanceof RepoNotFoundError
          ? "Repository not found or private. Check the URL and make sure the repo is public."
          : err instanceof Error
            ? err.message
            : "Demo pipeline failed",
    });
  }
}

/** Response type shared with the client (createdAt re-declared: JSON responses carry ISO strings, not Prisma Dates). */
export type DemoJobListItem = Omit<
  Pick<
    DemoJob,
    "id" | "repoUrl" | "owner" | "repo" | "status" | "stage" | "targetSeconds" | "style" | "voice" | "enhanced" | "createdAt"
  >,
  "createdAt"
> & {
  createdAt: string;
};

export type DemoJobResponse = DemoJobListItem & {
  source: string;
  error: string | null;
  script: VideoScript | null;
  meta: DemoMeta | null;
  updatedAt: string;
};

export function toDemoJobResponse(job: DemoJob): DemoJobResponse {
  return {
    id: job.id,
    repoUrl: job.repoUrl,
    owner: job.owner,
    repo: job.repo,
    status: job.status as DemoJobResponse["status"],
    stage: job.stage as DemoJobResponse["stage"],
    targetSeconds: job.targetSeconds,
    style: job.style,
    voice: job.voice,
    enhanced: job.enhanced,
    source: job.source,
    error: job.error,
    script: parse<VideoScript | null>(job.schemaJson, null),
    meta: parse<DemoMeta | null>(job.metaJson, null),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export { DEMO_STAGES };

// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Full Repo Auditor pipeline (fire-and-forget, DB-persisted stages):
//   queued → ingesting → scanning → scoring → composing → done
// Deterministic end to end: same repo, same score, same fixes. No LLM.
// ─────────────────────────────────────────────────────────────────────────────
import { db } from "@/lib/db";
import { ingestRepo, RepoNotFoundError, IngestionError } from "./ingest";
import { fetchRaw } from "./scrape";
import { auditRepo, type AuditScan } from "./repo-audit";
import type { AuditRepoMeta, AuditStage, AuditStatus, Strictness } from "./audit-types";
import { DEFAULT_STRICTNESS } from "./audit-types";
import type { RepoData } from "./types";

const MAX_WORKFLOW_PROBES = 4;

async function setStage(id: string, stage: AuditStage): Promise<void> {
  await db.auditJob.update({ where: { id }, data: { stage } });
}

function repoMeta(repo: RepoData): AuditRepoMeta {
  return {
    description: repo.description,
    language: repo.detected.language,
    languages: repo.detected.languages,
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

/**
 * Run the full repo audit for a job.
 * Deterministic: pure structural analysis of the live repository.
 */
export async function runAuditJob(jobId: string, repoUrl: string, strictness: Strictness = DEFAULT_STRICTNESS): Promise<void> {
  try {
    // ── Stage 1: ingest (metadata, tree, commits, manifests, README) ─────────
    await setStage(jobId, "ingesting");
    const repo = await ingestRepo(repoUrl);

    // ── Stage 2: scan — probe workflow contents + non-node manifests ─────────
    await setStage(jobId, "scanning");
    const scan: AuditScan = { workflowContents: [], raws: {} };

    const wfNames = repo.ciWorkflows.slice(0, MAX_WORKFLOW_PROBES);
    const needsPyproject = !repo.manifest && repo.rootFiles.some((f) => /^pyproject\.toml$/i.test(f));
    const needsCargo = !repo.manifest && repo.rootFiles.some((f) => /^cargo\.toml$/i.test(f));
    const needsGoMod = !repo.manifest && repo.rootFiles.some((f) => /^go\.mod$/i.test(f));
    const needsTsconfig = repo.rootFiles.some((f) => /^tsconfig\.json$/i.test(f));

    const dockerfile = repo.rootFiles.find((name) => /^dockerfile$/i.test(name));

    const [wfResults, pyprojectRaw, cargoRaw, goModRaw, tsconfigRaw, dockerRaw] = await Promise.all([
      Promise.all(
        wfNames.map(async (name) => ({
          name,
          content: (await fetchRaw(repo.owner, repo.repo, repo.defaultBranch, `.github/workflows/${name}`)) ?? "",
        }))
      ),
      needsPyproject ? fetchRaw(repo.owner, repo.repo, repo.defaultBranch, "pyproject.toml") : Promise.resolve(null),
      needsCargo ? fetchRaw(repo.owner, repo.repo, repo.defaultBranch, "Cargo.toml") : Promise.resolve(null),
      needsGoMod ? fetchRaw(repo.owner, repo.repo, repo.defaultBranch, "go.mod") : Promise.resolve(null),
      needsTsconfig ? fetchRaw(repo.owner, repo.repo, repo.defaultBranch, "tsconfig.json") : Promise.resolve(null),
      dockerfile ? fetchRaw(repo.owner, repo.repo, repo.defaultBranch, dockerfile) : Promise.resolve(null),
    ]);

    scan.workflowContents = wfResults.filter((w) => w.content);
    if (pyprojectRaw) scan.raws["pyproject.toml"] = pyprojectRaw;
    if (cargoRaw) scan.raws["Cargo.toml"] = cargoRaw;
    if (goModRaw) scan.raws["go.mod"] = goModRaw;
    if (dockerRaw) scan.raws.Dockerfile = dockerRaw;
    repo.tsconfigRaw = tsconfigRaw;

    // ── Stage 3: score — 50 deterministic checks across 5 categories ─────────
    await setStage(jobId, "scoring");
    const audit = auditRepo(repo, scan, strictness);

    // ── Stage 4: compose — rank fixes + roadmap (part of auditRepo; stage kept
    //    for honest progress reporting and to avoid blocking the ingest loop) ──
    await setStage(jobId, "composing");

    await db.auditJob.update({
      where: { id: jobId },
      data: {
        status: "ready",
        stage: "done",
        score: audit.score,
        fixesCount: audit.fixes.length,
        checksFailed: audit.stats.checksFailed,
        auditJson: JSON.stringify(audit),
        repoMetaJson: JSON.stringify(repoMeta(repo)),
      },
    });
    console.log(
      `[shipos:audit] job ${jobId} (${repo.owner}/${repo.repo}) ready — score ${audit.score}/100, ${audit.fixes.length} fixes, ${audit.stats.checksFailed} checks failed`
    );
  } catch (err) {
    const message =
      err instanceof RepoNotFoundError
        ? `Repository not found or private: ${repoUrl}`
        : err instanceof IngestionError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown audit error";
    console.error(`[shipos:audit] job ${jobId} failed:`, message);
    await db.auditJob
      .update({
        where: { id: jobId },
        data: { status: "error", error: message, stage: "done" },
      })
      .catch(() => undefined);
  }
}

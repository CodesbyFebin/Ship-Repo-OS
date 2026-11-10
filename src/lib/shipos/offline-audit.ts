// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Offline Full Repo Auditor ("Paste File List" mode).
// Scores a repo from pasted filenames (+ optional README text) with zero
// network calls — perfect when GitHub rate-limits the sandbox or the user
// wants to re-score a private repo without exposing it.
// GitHub-metadata-only checks auto-pass as "n/a — offline mode".
// ─────────────────────────────────────────────────────────────────────────────
import type { RepoData, DetectedStack, RepoManifest } from "./types";
import { auditRepo, type AuditScan } from "./repo-audit";
import type { RepoAudit, Strictness } from "./audit-types";
import { DEFAULT_STRICTNESS } from "./audit-types";

/** Split a pasted blob into clean file paths (newlines, commas, semicolons). */
export function parseFileList(text: string): string[] {
  const out = new Set<string>();
  for (const rawLine of text.split(/[\n,;]+/)) {
    const line = rawLine.trim().replace(/^\.\//, "").replace(/^\/+/, "").replace(/\\/g, "/");
    if (!line || line.startsWith("#")) continue;
    // keep it path-shaped; reject absolute URLs
    if (/^https?:\/\//i.test(line)) continue;
    out.add(line);
  }
  return [...out].slice(0, 4000);
}

function emptyStack(): DetectedStack {
  return {
    language: "Unknown",
    languages: [],
    frameworks: [],
    databases: [],
    tools: [],
    packageManager: null,
    scripts: {},
    dependencies: {},
    devDependencies: {},
  };
}

function buildSyntheticRepo(input: { name?: string; files: string[]; readme?: string }): RepoData {
  const files = input.files;
  const lower = files.map((f) => f.toLowerCase());

  // Root entries: files without "/" plus first segment of nested paths (dirs)
  const rootSet = new Set<string>();
  const githubSet = new Set<string>();
  const workflows = new Set<string>();

  for (const f of files) {
    const first = f.split("/")[0];
    if (first) rootSet.add(first);
    if (/^\.github\//i.test(f)) {
      const rest = f.slice(".github/".length);
      githubSet.add(rest);
      const wf = rest.match(/^workflows\/(.+)$/i);
      if (wf) workflows.add(wf[1]);
    }
  }

  // README: explicit content, or a hint that one exists (content unknown)
  const readmeNameIdx = lower.findIndex((f) => /^readme(\.md|\.rst|\.txt)?$/.test(f.split("/").pop() ?? ""));
  const readme = input.readme?.trim() ? input.readme.trim() : null;

  const hasTests = lower.some((f) => /(^|\/)(tests?|__tests__|spec|e2e)(\/|$)/i.test(f) || /\.(test|spec)\.[tj]sx?$/i.test(f) || /test_.*\.py$|.*_test\.go$/i.test(f));

  const isNode = lower.includes("package.json");
  const isGo = lower.includes("go.mod");
  const isRust = lower.includes("cargo.toml");
  const isPython = lower.includes("pyproject.toml") || lower.includes("requirements.txt");
  const stack = emptyStack();
  if (isNode) {
    stack.language = "JavaScript";
    stack.packageManager = lower.includes("pnpm-lock.yaml") ? "pnpm" : lower.includes("yarn.lock") ? "yarn" : lower.includes("bun.lock") || lower.includes("bun.lockb") ? "bun" : "npm";
  } else if (isPython) stack.language = "Python";
  else if (isGo) stack.language = "Go";
  else if (isRust) stack.language = "Rust";

  const manifest: RepoManifest | null = null; // offline mode cannot read contents

  const name = input.name?.trim() || "pasted-file-list";
  const now = new Date().toISOString();

  return {
    owner: "offline",
    repo: name,
    url: `file-list://${name}`,
    description: input.name?.trim() ?? "Offline file-list audit",
    topics: [],
    stars: 0,
    forks: 0,
    watchers: 0,
    openIssues: null,
    license: null,
    defaultBranch: "main",
    createdAt: now,
    pushedAt: now,
    commitCount: null,
    releaseCount: null,
    homepage: null,
    commits: [],
    contributors: [],
    rootFiles: [...rootSet],
    githubFiles: [...githubSet],
    ciWorkflows: [...workflows],
    hasTests,
    readme,
    readmeTruncated: false,
    manifest,
    envExample: null,
    detected: stack,
    source: "web-scrape",
    ingestedAt: now,
    offline: true,
  };
}

/** Deterministic offline audit from a pasted file list (+ optional README). */
export function auditFromFiles(
  input: { name?: string; files: string[]; readme?: string },
  strictness: Strictness = DEFAULT_STRICTNESS
): RepoAudit {
  const repo = buildSyntheticRepo(input);
  const scan: AuditScan = { workflowContents: [], raws: {} };
  return auditRepo(repo, scan, strictness);
}

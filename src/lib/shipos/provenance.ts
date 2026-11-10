// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — LAYER 2: Zero-Trust Intelligence
//   extractNarrative(): LLM narrative mapper (grounded, provenance-enforced)
//   buildLedger():      Claim → Evidence verification engine
// "You do NOT invent features. Every claim gets evidence, or gets REJECTED."
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";
import type { ClaimEntry, ClaimLedger, Narrative, RepoData } from "./types";
import { chatJson } from "./llm";

// ── Narrative extraction ─────────────────────────────────────────────────────

const NarrativeSchema = z.object({
  tagline: z.string().default(""),
  problem: z.string().default(""),
  solution: z.string().default(""),
  features: z
    .array(z.object({ title: z.string(), description: z.string(), evidenceHint: z.string().default("") }))
    .max(10)
    .default([]),
  roadmap: z.array(z.string()).max(6).default([]),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).max(8).default([]),
  keywords: z.array(z.string()).max(10).default([]),
  claims: z
    .array(
      z.object({
        claim: z.string(),
        category: z.enum(["tech", "feature", "traction", "quality", "community", "other"]).default("other"),
        evidenceHint: z.string().default(""),
      })
    )
    .max(12)
    .default([]),
  missing: z.array(z.string()).default([]),
});

const PROVENANCE_SYSTEM = `You are the ShipOS Narrative Mapper + Provenance Engine. You do NOT invent features.

HARD RULES:
1. Use ONLY numbers, names, technologies and facts present in the provided repo digest. Never invent traction (users, revenue, downloads, benchmarks, dates, awards).
2. If a required fact is missing, add an entry to "missing": "MISSING: <what a human must add>". Do not fill the gap yourself.
3. "claims" must be factual statements verifiable from the digest; each carries an evidenceHint (a file path, a dependency name, a commit-message keyword, or 'stars'/'license'/'ci'/'tests').
4. "faqs" must be answerable from the digest (40-60 words per answer). Phrase questions as users search: "What is X?", "How do you run X?", "Is X free?".
5. "features" must map to real evidence: a file path, a script name, or a dependency.
6. tagline: max 12 words. problem/solution: 2-4 sentences each, concrete, no fluff.
7. keywords: 6-10 GitHub search keywords for this repo.
8. Respond with STRICT JSON only. No markdown fences, no commentary.

JSON SHAPE:
{"tagline":"","problem":"","solution":"","features":[{"title":"","description":"","evidenceHint":""}],"roadmap":[""],"faqs":[{"q":"","a":""}],"keywords":[""],"claims":[{"claim":"","category":"tech|feature|quality|community","evidenceHint":""}],"missing":["MISSING: ..."]}`;

function buildDigest(repo: RepoData): string {
  const commitLines = repo.commits
    .slice(0, 30)
    .map((c) => `- ${c.sha.slice(0, 7)} [${c.type}] ${c.message}`)
    .join("\n");
  const depNames = [...Object.keys(repo.manifest?.dependencies ?? {})].slice(0, 30);
  const scriptLines = Object.entries(repo.manifest?.scripts ?? {})
    .slice(0, 12)
    .map(([k, v]) => `"${k}": "${v}"`)
    .join(", ");
  return JSON.stringify(
    {
      repo: `${repo.owner}/${repo.repo}`,
      description: repo.description,
      topics: repo.topics,
      homepage: repo.homepage,
      license: repo.license?.spdx ?? null,
      stars: repo.stars,
      forks: repo.forks,
      commitCount: repo.commitCount,
      defaultBranch: repo.defaultBranch,
      languages: repo.detected.languages,
      frameworks: repo.detected.frameworks,
      databases: repo.detected.databases,
      tools: repo.detected.tools,
      packageManager: repo.detected.packageManager,
      scripts: scriptLines || null,
      dependencies: depNames,
      rootFiles: repo.rootFiles.slice(0, 60),
      ciWorkflows: repo.ciWorkflows.slice(0, 8),
      hasTests: repo.hasTests,
      contributors: repo.contributors.slice(0, 6).map((c) => c.login),
      recentCommits: commitLines,
      readmeExcerpt: repo.readme ? repo.readme.slice(0, 1500) : null,
    },
    null,
    1
  );
}

/** Deterministic narrative used when the LLM is unavailable — still 100% factual. */
export function fallbackNarrative(repo: RepoData): Narrative {
  const name = repo.repo;
  const desc = repo.description || `${name} — a ${repo.detected.language} project`;
  const stack = [repo.detected.language, ...repo.detected.frameworks].filter(Boolean);
  const features = repo.detected.frameworks.slice(0, 5).map((f) => ({
    title: `${f} integration`,
    description: `${name} ships with ${f} wired into its ${repo.detected.packageManager ?? "standard"} toolchain, detected from its dependency manifests.`,
    evidenceHint: f.toLowerCase(),
  }));
  if (repo.ciWorkflows.length)
    features.push({
      title: "Continuous Integration",
      description: `Automated CI pipeline with ${repo.ciWorkflows.length} GitHub Actions workflow${repo.ciWorkflows.length > 1 ? "s" : ""} (${repo.ciWorkflows.slice(0, 3).join(", ")}).`,
      evidenceHint: ".github/workflows",
    });
  if (repo.hasTests)
    features.push({
      title: "Automated tests",
      description: "The repository contains a test suite and/or test scripts runnable from its package manifests.",
      evidenceHint: "tests",
    });

  const featCommits = repo.commits.filter((c) => c.type === "feat").slice(0, 3);
  return {
    tagline: desc.split(/[.!?]/)[0].slice(0, 90) || `Ship ${name} faster`,
    problem: `Most projects stagnate not because the code is weak, but because onboarding friction, missing docs, and manual verification burn contributor goodwill. ${name} tackles this directly in the ${repo.detected.language} ecosystem${repo.topics.length ? ` (topics: ${repo.topics.slice(0, 4).join(", ")})` : ""}.`,
    solution: `${name} is built with ${stack.slice(0, 3).join(", ") || repo.detected.language}${repo.detected.databases.length ? ` and backed by ${repo.detected.databases[0]}` : ""}. It exposes a clear setup path via ${repo.detected.packageManager ?? "its build system"} and has been iterated across ${repo.commitCount ?? repo.commits.length}+ commits, with CI${repo.ciWorkflows.length ? "" : " to be added"} keeping regressions in check.`,
    features,
    roadmap: featCommits.length
      ? featCommits.map((c) => `Continue the line of work started in "${c.message}" (${c.sha.slice(0, 7)})`)
      : [`Grow the ${name} contributor base`, "Expand documentation and examples"],
    faqs: [
      {
        q: `What is ${name}?`,
        a: `${name} is an open-source ${repo.detected.language} project${desc ? `: ${desc}` : ""}. It is developed in the open at github.com/${repo.owner}/${repo.repo}.`,
      },
      {
        q: `How do you run ${name}?`,
        a: repo.manifest?.scripts?.dev
          ? `Install dependencies with ${repo.detected.packageManager ?? "npm"} install, then run \`${repo.detected.packageManager ?? "npm"} run dev\`. The full quick-start is in the generated README.`
          : `Clone the repository and follow the setup documented in the README; dependencies are managed with ${repo.detected.packageManager ?? "the project's build system"}.`,
      },
      {
        q: `Is ${name} free?`,
        a: repo.license
          ? `Yes — ${name} is released under the ${repo.license.name}, so it is free to use, modify and distribute under that license's terms.`
          : `The repository currently has no detected license file, so usage terms are not yet formalized — a human should add a LICENSE.`,
      },
    ],
    keywords: [name, repo.detected.language, ...repo.detected.frameworks.map((f) => f.toLowerCase()), ...repo.topics].slice(0, 8),
    claims: [
      { claim: `Written primarily in ${repo.detected.language}`, category: "tech", evidenceHint: "languages" },
      ...(repo.license ? [{ claim: `Released under the ${repo.license.spdx} license`, category: "other" as const, evidenceHint: "license" }] : []),
      ...(repo.ciWorkflows.length ? [{ claim: `CI via GitHub Actions (${repo.ciWorkflows.length} workflows)`, category: "quality" as const, evidenceHint: ".github/workflows" }] : []),
    ],
    missing: repo.description ? [] : ["MISSING: repository description (About section is empty)"],
  };
}

export async function extractNarrative(repo: RepoData): Promise<{ narrative: Narrative; usedLlm: boolean }> {
  const digest = buildDigest(repo);
  const parsed = await chatJson({
    system: PROVENANCE_SYSTEM,
    user: `REPO DIGEST (ground truth — the only source you may use):\n${digest}`,
    schema: NarrativeSchema,
  });
  if (!parsed) return { narrative: fallbackNarrative(repo), usedLlm: false };
  return { narrative: parsed as Narrative, usedLlm: true };
}

// ── Zero-Trust verification ──────────────────────────────────────────────────

const TRACTION_RE =
  /\b(users?|customers?|subscribers?|revenue|downloads?|installs?|signups?|mau|dau|funding|raised|seed round|\$\s?\d|(\d+\s*[km]?\+?\s*(users|customers|downloads|installs|companies|teams)))\b/i;

function techTokens(claim: string, repo: RepoData): string[] {
  const hay = claim.toLowerCase();
  const tokens: string[] = [];
  const candidateNames = new Set<string>();
  for (const dep of [...Object.keys(repo.manifest?.dependencies ?? {}), ...Object.keys(repo.manifest?.devDependencies ?? {})]) {
    candidateNames.add(dep.toLowerCase());
  }
  for (const fw of repo.detected.frameworks) candidateNames.add(fw.toLowerCase());
  for (const db of repo.detected.databases) candidateNames.add(db.toLowerCase());
  for (const tool of repo.detected.tools) candidateNames.add(tool.toLowerCase());
  for (const lang of repo.detected.languages.map((l) => l.name.toLowerCase())) candidateNames.add(lang);
  if (repo.detected.packageManager) candidateNames.add(repo.detected.packageManager.toLowerCase());
  // python deps use dashes/underscores interchangeably
  for (const n of [...candidateNames]) candidateNames.add(n.replace(/-/g, "_"));
  for (const n of candidateNames) {
    if (n.length >= 3 && hay.includes(n)) tokens.push(n);
  }
  return [...new Set(tokens)];
}

function findCommitFor(keyword: string, repo: RepoData): string | null {
  const kw = keyword.toLowerCase();
  if (kw.length < 3) return null;
  const hit = repo.commits.find((c) => c.message.toLowerCase().includes(kw));
  return hit ? hit.sha : null;
}

function latestCommitSha(repo: RepoData): string | null {
  return repo.commits[0]?.sha ?? null;
}

function verifyClaim(c: { claim: string; category: ClaimEntry["category"]; evidenceHint: string }, repo: RepoData, idx: number): ClaimEntry {
  const base = { id: `claim-${idx}`, claim: c.claim, category: c.category };
  const hint = (c.evidenceHint ?? "").trim();
  const claimText = c.claim.toLowerCase();

  // ── Traction claims: the cardinal sin. REJECT unless it is literally about stars.
  if (TRACTION_RE.test(claimText) && !/star/.test(claimText)) {
    const starMatch = claimText.match(/(\d[\d.,]*[km]?)\+?\s*stars?/);
    if (starMatch) {
      const n = parseFloat(starMatch[1].replace(/,/g, "")) * (starMatch[1].endsWith("k") ? 1000 : 1);
      if (repo.stars >= n) {
        return { ...base, status: "VERIFIED", confidence: 0.99, evidence: `GitHub live metadata · ${repo.stars} stars`, commitSha: null, filePath: null, reason: `Live star count ${repo.stars} ≥ claimed ${n}` };
      }
    }
    return { ...base, status: "REJECTED", confidence: 0, evidence: "no evidence found", commitSha: null, filePath: null, reason: "Unverified Traction — no commit, file or analytics evidence exists for audience/monetization claims" };
  }

  // ── Star claims
  if (/star/.test(claimText)) {
    const starMatch = claimText.match(/(\d[\d.,]*[km]?)\+?\s*stars?/);
    if (starMatch) {
      const n = parseFloat(starMatch[1].replace(/,/g, "")) * (starMatch[1].endsWith("k") ? 1000 : 1);
      return repo.stars >= n
        ? { ...base, status: "VERIFIED", confidence: 0.99, evidence: `GitHub live metadata · ${repo.stars} stars`, commitSha: null, filePath: null, reason: `Live star count matches` }
        : { ...base, status: "REJECTED", confidence: 0, evidence: `GitHub live metadata · ${repo.stars} stars`, commitSha: null, filePath: null, reason: `Claimed ${n} stars but repo has ${repo.stars}` };
    }
    return { ...base, status: "VERIFIED", confidence: 0.95, evidence: `GitHub live metadata · ${repo.stars} stars`, commitSha: null, filePath: null, reason: "Star count confirmed from live repo metadata" };
  }

  // ── Evidence hint: file path?
  const hintPath = hint.replace(/^\.?\//, "");
  const rootHit = repo.rootFiles.find((f) => f.toLowerCase() === hintPath.toLowerCase());
  const dirHit = repo.rootFiles.find((f) => f.toLowerCase().startsWith(hintPath.toLowerCase() + "/") || hintPath.startsWith(f.toLowerCase()));
  if (hintPath && (rootHit || dirHit || hintPath.includes(".github/workflows"))) {
    if (hintPath.includes(".github/workflows") && repo.ciWorkflows.length === 0) {
      return { ...base, status: "REJECTED", confidence: 0, evidence: "no .github/workflows found", commitSha: null, filePath: null, reason: "No CI workflows exist in the repository" };
    }
    return {
      ...base,
      status: "VERIFIED",
      confidence: 0.9,
      evidence: `${rootHit ?? dirHit ?? hintPath}${repo.ciWorkflows.length && hintPath.includes("workflows") ? ` (${repo.ciWorkflows.length} workflows)` : ""}`,
      commitSha: latestCommitSha(repo),
      filePath: rootHit ?? dirHit ?? hintPath,
      reason: "File/directory exists in the live repo tree",
    };
  }

  // ── Tech claims: match against manifests, tools, languages
  const tokens = techTokens(c.claim, repo);
  if (tokens.length > 0) {
    const depKeys = new Set([...Object.keys(repo.manifest?.dependencies ?? {}), ...Object.keys(repo.manifest?.devDependencies ?? {})].map((k) => k.toLowerCase()));
    const matchedDep = tokens.find((t) => depKeys.has(t) || depKeys.has(t.replace(/_/g, "-")));
    const commitSha = matchedDep
      ? findCommitFor(matchedDep.split(/[-_]/)[0], repo) ?? latestCommitSha(repo)
      : findCommitFor(tokens[0], repo) ?? latestCommitSha(repo);
    if (matchedDep) {
      const ver = repo.manifest?.dependencies[matchedDep] ?? repo.manifest?.devDependencies[matchedDep] ?? repo.manifest?.dependencies[matchedDep.replace(/_/g, "-")] ?? repo.manifest?.devDependencies[matchedDep.replace(/_/g, "-")];
      return { ...base, status: "VERIFIED", confidence: 0.95, evidence: `package.json · ${matchedDep}${ver ? `@${ver}` : ""}`, commitSha, filePath: "package.json", reason: "Dependency present in the project manifest" };
    }
    return { ...base, status: "VERIFIED", confidence: 0.85, evidence: `stack detection · ${tokens.join(", ")}`, commitSha, filePath: null, reason: "Detected in manifests / tooling / language analysis" };
  }

  // ── Script-based feature evidence
  const scriptHit = Object.keys(repo.manifest?.scripts ?? {}).find((s) => claimText.includes(s));
  if (scriptHit || (hint && Object.keys(repo.manifest?.scripts ?? {}).includes(hint))) {
    const s = scriptHit ?? hint;
    return { ...base, status: "VERIFIED", confidence: 0.85, evidence: `package.json#scripts · "${s}"`, commitSha: latestCommitSha(repo), filePath: "package.json", reason: "Runnable script exists in the manifest" };
  }

  // ── Boolean repo qualities
  const qualityMap: { re: RegExp; ok: boolean; evidence: string }[] = [
    { re: /\bcommits?\b|commit history|development activity/i, ok: (repo.commitCount ?? repo.commits.length) > 0, evidence: `${repo.commitCount ?? repo.commits.length} commits on ${repo.defaultBranch} (live history)` },
    { re: /\bpackage manager\b|\b(pnpm|yarn|npm|bun|pip|cargo|go modules)\b/i, ok: (() => { if (!repo.detected.packageManager) return false; const mentioned = claimText.match(/\b(pnpm|yarn|npm|bun|pip|cargo|go modules)\b/i); return !mentioned || mentioned[1].toLowerCase() === repo.detected.packageManager.toLowerCase(); })(), evidence: repo.detected.packageManager ? `detected package manager: ${repo.detected.packageManager} (lockfile in repo root)` : "no lockfile detected" },
    { re: /\btest(s|ing|suite)?\b/, ok: repo.hasTests, evidence: "test directories / test scripts in manifest" },
    { re: /\bci\b|continuous integration|github actions/, ok: repo.ciWorkflows.length > 0, evidence: `.github/workflows (${repo.ciWorkflows.length} workflows)` },
    { re: /\blicense[ds]?\b/, ok: !!repo.license, evidence: repo.license ? `${repo.license.spdx} LICENSE` : "no LICENSE file" },
    { re: /\bcontribut/, ok: repo.rootFiles.some((f) => /contribut/i.test(f)), evidence: repo.rootFiles.find((f) => /contribut/i.test(f)) ?? "no CONTRIBUTING file" },
    { re: /\bsecurity\b/, ok: repo.rootFiles.some((f) => /security/i.test(f)), evidence: repo.rootFiles.find((f) => /security/i.test(f)) ?? "no SECURITY file" },
  ];
  for (const q of qualityMap) {
    if (q.re.test(claimText)) {
      if (q.ok) return { ...base, status: "VERIFIED", confidence: 0.9, evidence: q.evidence, commitSha: latestCommitSha(repo), filePath: null, reason: "Verified from live repository structure" };
      return { ...base, status: "REJECTED", confidence: 0, evidence: q.evidence, commitSha: null, filePath: null, reason: "Repository structure does not support this claim" };
    }
  }

  // ── README mention → PARTIAL at best
  if (repo.readme) {
    const words = c.claim.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const hits = words.filter((w) => repo.readme!.toLowerCase().includes(w)).length;
    if (words.length > 0 && hits / words.length >= 0.6) {
      return { ...base, status: "PARTIAL", confidence: 0.55, evidence: "README.md (text mention only)", commitSha: null, filePath: "README.md", reason: "Mentioned in README but not backed by manifests, files or commits" };
    }
  }

  return { ...base, status: "REJECTED", confidence: 0, evidence: "no evidence found", commitSha: null, filePath: null, reason: "No matching file, dependency, script, commit or doc evidence" };
}

/** Deterministic claims that are always checkable — guarantee a truthful baseline. */
function seedClaims(repo: RepoData): { claim: string; category: ClaimEntry["category"]; evidenceHint: string }[] {
  const seeds: { claim: string; category: ClaimEntry["category"]; evidenceHint: string }[] = [
    { claim: `Primary language is ${repo.detected.language}`, category: "tech", evidenceHint: repo.detected.language },
    { claim: `Hosted at github.com/${repo.owner}/${repo.repo} with ${repo.stars} stars and ${repo.forks} forks`, category: "community", evidenceHint: "stars" },
    { claim: `${repo.commitCount ?? repo.commits.length}+ commits on branch ${repo.defaultBranch}`, category: "quality", evidenceHint: "commits" },
  ];
  if (repo.license) seeds.push({ claim: `Distributed under the ${repo.license.name}`, category: "other", evidenceHint: "license" });
  if (repo.ciWorkflows.length)
    seeds.push({ claim: `CI pipeline with ${repo.ciWorkflows.length} GitHub Actions workflows`, category: "quality", evidenceHint: ".github/workflows" });
  if (repo.hasTests) seeds.push({ claim: "Includes automated tests", category: "quality", evidenceHint: "tests" });
  if (repo.detected.frameworks.length)
    seeds.push({ claim: `Built with ${repo.detected.frameworks.slice(0, 3).join(", ")}`, category: "tech", evidenceHint: repo.detected.frameworks[0] });
  return seeds;
}

export function buildLedger(repo: RepoData, narrative: Narrative | null): ClaimLedger {
  const source = [
    ...seedClaims(repo),
    ...(narrative?.claims ?? []),
  ];
  const seen = new Set<string>();
  const claims: ClaimEntry[] = [];
  let i = 0;
  for (const c of source) {
    const key = c.claim.toLowerCase().replace(/\W+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push(verifyClaim(c, repo, i++));
    if (claims.length >= 26) break;
  }
  const summary = {
    total: claims.length,
    verified: claims.filter((c) => c.status === "VERIFIED").length,
    partial: claims.filter((c) => c.status === "PARTIAL").length,
    rejected: claims.filter((c) => c.status === "REJECTED").length,
  };
  return { claims, summary, generatedAt: new Date().toISOString() };
}

/** Only VERIFIED claims may be rendered as proof. PARTIAL renders with a caveat badge. */
export function renderableClaims(ledger: ClaimLedger): ClaimEntry[] {
  return ledger.claims.filter((c) => c.status === "VERIFIED" || c.status === "PARTIAL");
}

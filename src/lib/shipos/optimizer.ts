// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Full Repo Optimization Engine pipeline.
//   ingest → detect 54 signals → score SEO/AEO/GEO (before) → generate pack
//   (LLM with deterministic template fallback) → assemble a review checklist
//   → persist. Fire-and-forget like the auditor; the client polls the API.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";
import { db } from "@/lib/db";
import { ingestRepo, normalizeRepoUrl } from "./ingest";
import { fetchRaw } from "./scrape";
import { chatJson } from "./llm";
import { OPTIMIZE_CATALOG, detectAll, scoreDimension, type DetectContext, type OptimizeScan } from "./optimize-catalog";
import {
  CopyPackSchema,
  FilePackSchema,
  PackSchema,
  repoMetaSnapshot,
  type ChecklistEntry,
  type DimensionBreakdown,
  type ItemSignal,
  type CatalogItem,
  optimizationGuidance,
  type OptimizationPack,
} from "./optimize-types";
import type { RepoData } from "./types";

const SCAN_FILES = ["robots.txt", "llms.txt", "llms-full.txt", "agents.txt", "AGENTS.md", "CHANGELOG.md", "CITATION.cff"];

async function buildScan(owner: string, repo: string, branch: string): Promise<OptimizeScan> {
  const raws: Record<string, string> = {};
  await Promise.all(
    SCAN_FILES.map(async (f) => {
      const content = await fetchRaw(owner, repo, branch, f);
      if (content) raws[f] = content;
    })
  );
  return { raws };
}

function detectContext(repo: RepoData, scan: OptimizeScan): DetectContext {
  const files = [...repo.rootFiles, ...repo.githubFiles].map((f) => f.toLowerCase());
  return {
    repo,
    readme: repo.readme ?? "",
    readmeLower: (repo.readme ?? "").toLowerCase(),
    files,
    scan,
    today: new Date(),
  };
}

// ── LLM pack generation ──────────────────────────────────────────────────────

function repoFacts(repo: RepoData): Record<string, unknown> {
  return {
    name: repo.repo,
    owner: repo.owner,
    url: repo.url,
    description: repo.description,
    topics: repo.topics,
    language: repo.detected.language,
    frameworks: repo.detected.frameworks.slice(0, 8),
    dependencies: Object.keys({ ...repo.manifest?.dependencies }).slice(0, 12),
    manifestKeywords: repo.manifest?.keywords ?? [],
    manifestVersion: repo.manifest?.version ?? null,
    license: repo.license?.spdx ?? null,
    stars: repo.stars,
    forks: repo.forks,
    contributors: repo.contributors?.length ?? 0,
    homepage: repo.homepage,
    lastPush: repo.pushedAt,
    rootFiles: repo.rootFiles.slice(0, 40),
    readmeExcerpt: (repo.readme ?? "").slice(0, 2400),
  };
}

const PACK_SYSTEM = `You are ShipOS's Optimization Engine: an expert in GitHub SEO, Answer-Engine Optimization (Perplexity, Google AI Overviews) and Generative-Engine Optimization (ChatGPT, Claude, Gemini citations).
Respond with STRICT JSON only — no markdown fences, no commentary. Every string must be publication-ready prose, specific to this repo, never generic filler. Obey exact format constraints per key. Use ONLY facts from REPO FACTS — never invent stars/benchmarks. If a number is unknown, phrase around it.`;

/** Call 1 — short marketing + answer copy (small response, never truncates). */
function copyPrompt(repo: RepoData): string {
  return `Generate the SEARCH + ANSWER copy pack for this repository.

REPO FACTS:
${JSON.stringify(repoFacts(repo), null, 2)}

OUTPUT JSON KEYS (exact names, exact constraints):
{
  "description": "GitHub repo description, max 300 chars, front-loads the primary keyword, states what it does + the key benefit. Plain text, no hashtags.",
  "topics": [12-18 GitHub topics, lowercase-hyphen-case, mix of language + domain + ecosystem + intent terms, include the project name],
  "keywords": [8-12 search phrases a developer would type, ordered by expected volume],
  "metaTitle": "SEO title tag, max 60 chars, format '<Name> — <core benefit>'",
  "metaDescription": "Meta description, 140-160 chars, includes the primary keyword and a call to action",
  "quickAnswer": "Direct answer to 'What is <Name>?'. 45-70 words, one paragraph, opens with '<Name> is a …', mentions the license. Self-contained so an answer engine can quote it verbatim.",
  "aboutPara": "Quotable About block: 50-80 words, one paragraph, contains at least one concrete number from the facts (stars, version, contributors), written so a generative engine can cite it with attribution.",
  "faq": [6 objects {"q":"…?","a":"…"} covering: what is it, how to install, is it free + license, how it compares to the top alternative, what are the requirements, how to contribute. Answers 25-60 words, factual.],
  "comparison": { "headers": ["", "<Name>", "<Alt A>", "<Alt B>"] — Alt A/B must be the 2 most real alternatives in this domain, "rows": [4 rows comparing License, Language, Install, Best for — cells short] },
  "social": { "x": "3-tweet launch thread separated by blank lines, ≤280 chars each, first tweet has the hook + repo URL", "linkedin": "launch post 80-130 words, ends with the repo URL", "hn": "Show HN style title + 2-sentence first comment", "reddit": "post for the most relevant subreddit (name it), 100-150 words, no marketing speak", "productHunt": "one-line tagline ≤60 chars + 2-sentence description", "devto": "article outline: title + 6 section headings with one-line notes" }
}

JSON only.`;
}

/** Call 2 — the machine files (agents.txt / llms.txt / robots / JSON-LD). */
function filesPrompt(repo: RepoData): string {
  return `Generate the MACHINE-FILE pack for this repository.

REPO FACTS:
${JSON.stringify(repoFacts(repo), null, 2)}

OUTPUT JSON KEYS (exact names, exact constraints):
{
  "agentsTxt": "Full agents.txt file content for AI coding agents. Markdown. Sections: '# <name>' title with one-line purpose, '## What this is' (2-3 sentences), '## Stack' (detected language/frameworks), '## Commands' (install/build/test from the facts; say 'not detected — inspect the manifest' when unknown), '## Constraints (do not)' (don't bump deps without tests, follow existing style, don't touch lockfiles casually), '## Conventions', '## Where to look' (bullet map of rootFiles). 50-100 lines.",
  "llmsTxt": "Full llms.txt file (Answer.AI standard). Markdown: '# <Name>' H1, then '>' blockquote one-liner, then a 2-3 sentence definition paragraph, then '## Docs' link list (README, source, issues, homepage if any), then '## Use when' bullets, then '## Install' fenced bash block with the real command, then '## Last updated' line with lastPush date. 40-80 lines.",
  "llmsFullTxt": "Expanded llms-full.txt: same H1/quote, '## Overview' (4-6 sentences with facts), '## Requirements', '## Quickstart' with language-tagged fenced code blocks, '## API surface' summarizing main folders from rootFiles, '## Links'. 60-120 lines.",
  "jsonLd": { "@context": "https://schema.org", "@type": "SoftwareApplication", "name", "url", "description" (one sentence), "applicationCategory": "developerApplication", "operatingSystem": "Any", "softwareVersion", "license" (spdx URL or omit), "author" {"@type":"Organization","name": owner}, "codeRepository", "keywords" (comma-joined), "dateModified" },
  "robotsAiTxt": "Full robots.txt content: explicit 'User-agent: GPTBot / ClaudeBot / Anthropic-AI / PerplexityBot / Google-Extended / CCBot' blocks each with 'Allow: /', then 'User-agent: *' with 'Allow: /', plus a Sitemap line if homepage exists. Leading '#' comment notes the policy."
}

JSON only.`;
}

/** Clamp LLM output to the strict pack invariants before merging. */
function clampCopy(copy: z.infer<typeof CopyPackSchema>, name: string) {
  const topics = Array.from(
    new Set(
      copy.topics
        .map((t) => t.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
        .filter((t) => /^[a-z0-9][a-z0-9-]*$/.test(t) && t.length >= 2)
    )
  ).slice(0, 20);
  return {
    description: copy.description.trim().slice(0, 350),
    topics: topics.length >= 10 ? topics : [...new Set([...topics, name.toLowerCase(), "open-source", "developer-tools"])].slice(0, 20),
    keywords: copy.keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12),
    metaTitle: copy.metaTitle.trim().slice(0, 70),
    metaDescription: copy.metaDescription.trim().slice(0, 160),
    quickAnswer: copy.quickAnswer.trim(),
    aboutPara: copy.aboutPara.trim(),
    faq: copy.faq.slice(0, 8).map((f) => ({ q: f.q.trim(), a: f.a.trim() })),
    comparison: {
      headers: copy.comparison.headers.slice(0, 5),
      rows: copy.comparison.rows.slice(0, 6).map((r) => r.map((c) => String(c)).slice(0, 5)),
    },
    social: copy.social,
  };
}

async function packWithLlm(repo: RepoData, ctx: DetectContext): Promise<OptimizationPack | null> {
  const base = fallbackPack(repo, ctx); // deterministic safety net — merged result always validates
  const [copy, files] = await Promise.all([
    chatJson({ system: PACK_SYSTEM, user: copyPrompt(repo), schema: CopyPackSchema, retries: 1, maxTokens: 6000 }),
    chatJson({ system: PACK_SYSTEM, user: filesPrompt(repo), schema: FilePackSchema, retries: 1, maxTokens: 8000 }),
  ]);
  if (!copy && !files) return null;
  const merged = {
    ...base,
    ...(copy ? clampCopy(copy, repo.repo) : {}),
    ...(files ?? {}),
  };
  try {
    return PackSchema.parse(merged);
  } catch (err) {
    console.warn("[shipos:optimizer] merged pack failed validation — using template base:", err instanceof z.ZodError ? err.issues.slice(0, 3) : err);
    return base;
  }
}

// ── Deterministic fallback pack (never invents, never fails) ─────────────────

function fallbackPack(repo: RepoData, ctx: DetectContext): OptimizationPack {
  const name = repo.repo;
  const lang = repo.detected.language || "polyglot";
  const frameworks = repo.detected.frameworks.slice(0, 3);
  const fw = frameworks.length ? frameworks.join(", ") : "zero heavy dependencies";
  const kw = repo.manifest?.keywords ?? [];
  const baseKw = kw.length ? kw : [name, lang.toLowerCase(), "open source", "developer tools", "library", "framework", "cli", "api"];
  const license = repo.license?.spdx ?? "unlicensed";
  const version = repo.manifest?.version ?? "v1";
  const install =
    repo.manifest?.name
      ? repo.detected.packageManager === "pnpm"
        ? `pnpm add ${name}`
        : `npm install ${name}`
      : `git clone ${repo.url}.git`;
  const stars = repo.stars > 0 ? `${repo.stars.toLocaleString("en-US")} GitHub stars` : "an open repository";
  const updated = repo.pushedAt ? new Date(repo.pushedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const topics = Array.from(
    new Set([
      name.toLowerCase(),
      lang.toLowerCase(),
      ...baseKw.slice(0, 9).map((k) => k.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")),
      ...frameworks.map((f) => f.toLowerCase().replace(/\s+/g, "-")),
      "open-source",
      "developer-tools",
      ...(repo.topics.length >= 12 ? repo.topics : []),
    ])
  )
    .filter((t) => /^[a-z0-9][a-z0-9-]*$/.test(t))
    .slice(0, 20);

  const description = `${name} — ${repo.description?.trim() || `a ${lang} project built with ${fw}`}. Open source under ${license}.`.slice(0, 350);

  const quickAnswer = `${name} is a ${lang} ${fw.includes("zero heavy") ? "library" : `project built with ${fw}`} that ${repo.description?.trim() || "solves its domain problem with a minimal, composable API"}. Install it with \`${install}\` and ship in minutes. Source is available on GitHub under the ${license} license — free for commercial and personal use.`;

  const faq = [
    { q: `What is ${name}?`, a: `${quickAnswer}` },
    { q: `How do I install ${name}?`, a: `Run \`${install}\`. ${repo.manifest ? `The package is published as \`${repo.manifest.name ?? name}\` (current ${version}).` : "Clone the repository to get started."}` },
    { q: `Is ${name} free? What is the license?`, a: `Yes — ${name} is open source under the ${license} license, free for personal and commercial use with attribution preserved in the source files.` },
    { q: `What are ${name}'s requirements?`, a: `${name} targets ${lang}${frameworks.length ? ` with ${fw}` : ""}. See the repository README for the exact runtime versions and peer dependencies.` },
    { q: `How active is ${name}?`, a: `The repository was last pushed ${updated} and has ${stars}${repo.forks ? `, ${repo.forks.toLocaleString("en-US")} forks` : ""}${(repo.contributors?.length ?? 0) > 1 ? ` and ${repo.contributors.length} contributors` : ""}.` },
    { q: `How can I contribute to ${name}?`, a: `Open an issue or pull request on GitHub. Read the repository guidelines first — agents should consult agents.txt at the repo root for orientation.` },
  ];

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    url: repo.url,
    description,
    applicationCategory: "developerApplication",
    operatingSystem: "Any",
    softwareVersion: version,
    license: license !== "unlicensed" ? `https://spdx.org/licenses/${license}` : undefined,
    author: { "@type": "Organization", name: repo.owner },
    codeRepository: repo.url,
    keywords: topics.join(", "),
    dateModified: updated,
  };

  const agentsTxt = `# agents.txt — orientation for AI coding agents

> ${name}: ${repo.description?.trim() || `a ${lang} repository`}. Read this file before writing any code.

## What this is
- ${quickAnswer}

## Stack
- Language: ${lang}
- Frameworks/libraries: ${frameworks.length ? frameworks.join(", ") : "see manifest"}
- Package manager: ${repo.detected.packageManager ?? "not detected — inspect lockfiles"}

## Commands
- Install: \`${install}\`
- Build/test: ${repo.detected.scripts?.build ? `\`${Object.keys(repo.detected.scripts).includes("build") ? repo.detected.packageManager ?? "npm" : "npm"} run build\`` : "see manifest scripts"}
- ${repo.detected.scripts?.test ? "Test: `" + (repo.detected.packageManager ?? "npm") + " run test`" : "Test: no script detected — ask before adding one"}

## Constraints (do not)
- Do not upgrade dependencies without a passing test run.
- Do not reformat unrelated files; follow the existing style.
- Do not commit lockfile changes unless the task is a dependency change.
- Do not invent APIs — read the source under the relevant folder first.

## Conventions
- One canonical name: "${name}" everywhere (docs, code, copy).
- ${lang} idioms; keep public APIs documented in the README.

## Where to look
${repo.rootFiles.slice(0, 14).map((f) => `- \`${f}\``).join("\n")}
- Full tree: ${repo.url}
`;

  const llmsTxt = `# ${name}

> ${name} — ${repo.description?.trim() || `an open-source ${lang} project`}. ${license !== "unlicensed" ? `Licensed ${license}.` : ""}

${quickAnswer}

## Docs
- [README](${repo.url}#readme) — full documentation
- [Source](${repo.url}) — browse the code
- [Issues](${repo.url}/issues) — bugs and feature requests
${repo.homepage ? `- [Homepage](${repo.homepage})\n` : ""}
## Use when
- You need ${repo.description?.trim()?.toLowerCase() || `a ${lang} solution`} without heavy setup.
- You want an ${license !== "unlicensed" ? `${license}-licensed` : "open-source"} alternative you can vendor.

## Install
\`\`\`bash
${install}
\`\`\`

## Last updated
- ${updated} — actively maintained; check releases for the current version.
`;

  const llmsFullTxt = `${llmsTxt}
## Overview
${name} is written in ${lang}${frameworks.length ? ` and built on ${fw}` : ""}. Current release: ${version}. License: ${license}. Community: ${stars}${repo.forks ? `, ${repo.forks.toLocaleString("en-US")} forks` : ""}${(repo.contributors?.length ?? 0) > 1 ? `, ${repo.contributors.length} contributors` : ""}. Last push: ${updated}.

## Requirements
- ${lang} runtime${frameworks.length ? ` + ${fw}` : ""}
- See the manifest for exact peer dependencies.

## Quickstart
\`\`\`${lang === "TypeScript" || lang === "JavaScript" ? "ts" : lang.toLowerCase()}
// minimal usage — see README for the full example
import { } from "${repo.manifest?.name ?? name}";
\`\`\`

## API surface
${repo.rootFiles
  .filter((f) => /\.(ts|tsx|js|py|go|rs)$/.test(f) || ["src", "lib", "packages", "cmd", "internal"].includes(f))
  .slice(0, 10)
  .map((f) => `- \`${f}\``)
  .join("\n") || "- browse the repository tree"}

## FAQ
${faq.map((f) => `### ${f.q}\n${f.a}`).join("\n\n")}

## Links
- Repository: ${repo.url}
${repo.homepage ? `- Homepage: ${repo.homepage}\n` : ""}- Issues: ${repo.url}/issues
`;

  const robotsAiTxt = `# robots.txt — AI crawler policy (ShipOS pack)
# Answer + generative engines are explicitly welcome.

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

User-agent: *
Allow: /
${repo.homepage ? `\nSitemap: ${repo.homepage.replace(/\/$/, "")}/sitemap.xml\n` : ""}`;

  const aboutPara = `${name} is an open-source ${lang} project${frameworks.length ? ` built on ${fw}` : ""}. ${repo.description?.trim() || "It keeps its core small, documented, and dependency-light."} Current release ${version}, licensed ${license}. Community proof: ${stars}${repo.forks ? ` and ${repo.forks.toLocaleString("en-US")} forks` : ""}. Last updated ${updated} — maintained in the open on GitHub.`;

  const comparison = {
    headers: ["", name, "Incumbent tool", "Build it yourself"],
    rows: [
      ["License", license, "often restrictive", "your own"],
      ["Language", lang, "varies", "varies"],
      ["Install", install, "vendor-specific", "weeks of work"],
      ["Best for", "teams that want auditable, hackable source", "teams locked into that vendor", "nobody, in 2025"],
    ],
  };

  const social = {
    x: `${name}: ${repo.description?.trim() || `the ${lang} way to do it`}. Open source, ${license}.\n\n${repo.url}\n\n⭐ ${stars} — PRs welcome.`,
    linkedin: `We keep shipping on ${name}.\n\n${repo.description?.trim() || `An open-source ${lang} project`} — ${fw}, licensed ${license}, current release ${version}.\n\nIf you are building in this space, the README now answers every question an AI engine will ask: what it is, how to install it, how it compares.\n\n${repo.url}`,
    hn: `Show HN: ${name} – ${repo.description?.trim() || `open-source ${lang} tool`}\n\nFirst comment: We built ${name} because the existing options were heavier than the problem. It is ${lang}, ${license}${repo.stars ? `, and has ${stars}` : ""}. Happy to answer architecture questions — the agents.txt file at the repo root maps the whole tree for AI reviewers.`,
    reddit: `r/${lang === "TypeScript" || lang === "JavaScript" ? "javascript" : "programming"} — I open-sourced ${name}\n\n${repo.description?.trim() || `An open-source ${lang} project`}. It is ${license}-licensed and installs with \`${install}\`.\n\nThe repo ships llms.txt and agents.txt so AI tools understand it out of the box. Feedback welcome — especially on the API surface.`,
    productHunt: `${name} — ${repo.description?.trim() || `the open-source ${lang} toolkit`}`.slice(0, 60) + `\n\n${name} makes ${repo.description?.trim()?.toLowerCase() || "the workflow"} a one-command install. Open source, ${license}, AI-crawler ready (llms.txt + agents.txt included).`,
    devto: `Shipping ${name}: a field guide\n1. What problem it solves — ${repo.description?.trim() || "the core idea"}\n2. Architecture tour — ${lang} modules and why the split\n3. Quickstart in 60 seconds\n4. How the AI surfaces work (llms.txt, agents.txt, JSON-LD)\n5. Performance and maintenance story\n6. Roadmap + how to contribute`,
  };

  return PackSchema.parse({
    description,
    topics,
    keywords: baseKw.slice(0, 12).map((k) => (typeof k === "string" ? k : String(k))),
    metaTitle: `${name} — ${repo.description?.trim()?.split(/[.,—-]/)[0] || `open-source ${lang}`}`.slice(0, 60),
    metaDescription: `${name}: ${repo.description?.trim() || `open-source ${lang} project`}. ${license !== "unlicensed" ? `${license}-licensed, ` : ""}install with one command. Docs, examples and AI-ready metadata included.`.slice(0, 160),
    quickAnswer,
    agentsTxt,
    llmsTxt,
    llmsFullTxt,
    faq,
    jsonLd,
    robotsAiTxt,
    aboutPara,
    comparison,
    social,
  });
}

// ── Checklist assembly ───────────────────────────────────────────────────────

function buildChecklist(signals: Map<string, ItemSignal>, catalog: CatalogItem[]): ChecklistEntry[] {
  return catalog.map((item) => {
    const before = signals.get(item.id) ?? { pass: false, detail: "not scanned" };
    return { item, before, after: optimizationGuidance(item, before) };
  });
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export async function runOptimizeJob(jobId: string, repoUrl: string): Promise<void> {
  const touch = (data: Parameters<typeof db.optimizeJob.update>[0]["data"]) =>
    db.optimizeJob.update({ where: { id: jobId }, data });

  try {
    const normalized = normalizeRepoUrl(repoUrl);
    await touch({ stage: "ingesting" });
    const repo = await ingestRepo(normalized.url);
    const scan = await buildScan(repo.owner, repo.repo, repo.defaultBranch || "main");
    const ctx = detectContext(repo, scan);

    await touch({ stage: "scoring", repoMetaJson: JSON.stringify(repoMetaSnapshot(repo)) });
    const signals = detectAll(ctx);
    const before: DimensionBreakdown = {
      seo: scoreDimension(signals, "seo"),
      aeo: scoreDimension(signals, "aeo"),
      geo: scoreDimension(signals, "geo"),
    };
    await touch({ beforeJson: JSON.stringify(before) });

    await touch({ stage: "generating" });
    let pack = await packWithLlm(repo, ctx);
    let packSource: "llm" | "fallback" = "llm";
    if (!pack) {
      console.warn("[shipos:optimizer] LLM pack failed — using deterministic template pack");
      pack = fallbackPack(repo, ctx);
      packSource = "fallback";
    }

    await touch({ stage: "auditing" });
    const checklist = buildChecklist(signals, OPTIMIZE_CATALOG);

    await touch({
      status: "ready",
      stage: "done",
      afterJson: null,
      artifactsJson: JSON.stringify(pack),
      checklistJson: JSON.stringify(checklist),
      packSource,
    });
  } catch (err) {
    console.error("[shipos:optimizer] job failed:", err);
    await touch({
      status: "error",
      error: err instanceof Error ? err.message : "Optimization pipeline failed",
    });
  }
}

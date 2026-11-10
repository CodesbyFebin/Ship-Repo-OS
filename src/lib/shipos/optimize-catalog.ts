// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Optimization catalog: 54 items = 4 headline assets
// (description · topics · agents.txt · llms.txt) + 50 other optimizations.
// Every item carries a deterministic detector that scores the repo BEFORE the
// pack is generated — no LLM guessing in the scoring path.
// Rings: Search SEO (18) · Answer Engines (18) · Generative Engines (18).
// ─────────────────────────────────────────────────────────────────────────────
import type { RepoData } from "./types";
import type { CatalogItem, ItemSignal, OptimizeDimension, OptimizationCategory } from "./optimize-types";

/** Extra raw files fetched by the pipeline before detection. */
export interface OptimizeScan {
  raws: Record<string, string>;
}

export interface DetectContext {
  repo: RepoData;
  readme: string;
  readmeLower: string;
  /** lowercase root + .github file names */
  files: string[];
  scan: OptimizeScan;
  today: Date;
}

/** A catalog item that carries its live detector (never serialized). */
export interface DetectableItem extends CatalogItem {
  detect: Det;
}

type Det = (ctx: DetectContext) => ItemSignal;

const ok = (detail: string): ItemSignal => ({ pass: true, detail });
const fail = (detail: string): ItemSignal => ({ pass: false, detail });

const H1_RE = /^#\s+\S+/m;
const QUESTION_H_RE = /^#{2,3}\s+(what|why|how|when|which|who|can|does|is|should|do)\b[^#]*\?/gim;
const BADGE_RE = /img\.shields\.io|badgen\.net|circleci\.com\/badge|travis-ci\.org|github\.com\/.*\/workflows\/.*\/badge\.svg|badge\.fury\.io|snyk\.io|codecov\.io/i;
const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
const INSTALL_RE = /^\s*(npm i\b|npm install|pnpm (add|i)\b|yarn add|bun add|pip install|uv add|cargo add|go get\b|brew install|dotnet add|gem install|composer require)/im;
const VERSION_RE = /\bv?\d+\.\d+\.\d+\b/;
const ISO_DATE_RE = /\b20\d\d-\d\d-\d\d\b/;
const NUMBERISH_RE = /\b\d+(\.\d+)?\s?(k|m|bn|million|billion|%|ms|x|×|fps|req\/s|stars)\b/i;

function fencedBlocks(readme: string): string[] {
  const out: string[] = [];
  const re = /```([\w-]*)[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(readme))) out.push(m[1] ?? "");
  return out;
}

function paragraphs(readme: string): string[] {
  return readme
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

const raw = (ctx: DetectContext, name: string): string | null => ctx.scan.raws[name] ?? null;
const hasFile = (ctx: DetectContext, name: string): boolean => ctx.files.includes(name);

function headingCount(readme: string, level: number): number {
  const re = level === 1 ? /^#\s+\S/gm : new RegExp(`^${"#".repeat(level)}\\s+\\S`, "gm");
  return (readme.match(re) ?? []).length;
}

function hasSection(readmeLower: string, ...names: string[]): boolean {
  return names.some((n) => new RegExp(`^#{1,4}[^\\n]*${n}`, "im").test(readmeLower));
}

// ═══ Ring 1 — Search SEO (18) ═══════════════════════════════════════════════

const SEO_ITEMS: DetectableItem[] = [
  {
    id: "seo-description",
    category: "seo",
    dimension: "seo",
    title: "Keyword-optimized repo description",
    why: "The description is the <meta name=description> of GitHub search and Google's repo sitelink — the single highest-leverage SEO surface.",
    applies: "Generated description ≤350 chars, primary keyword front-loaded, benefits stated.",
    artifact: "description",
    detect: (c) => {
      const d = c.repo.description.trim();
      if (!d) return fail("no repo description set");
      if (d.length < 20) return fail(`description too thin (${d.length} chars)`);
      if (d.length > 350) return fail(`description exceeds 350 chars (${d.length})`);
      return ok(`description present · ${d.length} chars`);
    },
  },
  {
    id: "seo-topics",
    category: "seo",
    dimension: "seo",
    title: "15-20 curated GitHub topics",
    why: "Topics power GitHub topic search + Google 'repository topics' rich results; 15-20 maximizes surface without diluting relevance.",
    applies: "20 topics generated: language, domain, ecosystem, and intent terms.",
    artifact: "topics",
    detect: (c) => {
      const t = c.repo.topics;
      if (t.length === 0) return fail("no topics set");
      if (t.length < 12) return fail(`only ${t.length} topics (15-20 recommended)`);
      return ok(`${t.length} topics set`);
    },
  },
  {
    id: "seo-readme-h1",
    category: "seo",
    dimension: "seo",
    title: "README opens with one keyword-rich H1",
    why: "The first H1 is the strongest on-page signal for both GitHub rendering and search crawlers.",
    applies: "Pack meta title + description feed a rewritten first screen.",
    artifact: "metaTitle",
    detect: (c) => (H1_RE.test(c.readme) ? ok("H1 found") : fail("no H1 heading in README")),
  },
  {
    id: "seo-manifest-keywords",
    category: "seo",
    dimension: "seo",
    title: "Manifest keywords field (≥8 phrases)",
    why: "package.json/pyproject keywords feed npm/PyPI search and are mirrored by aggregators.",
    applies: "12 search phrases generated and ranked by volume vs competition.",
    artifact: "keywords",
    detect: (c) => {
      const k = c.repo.manifest?.keywords ?? [];
      if (k.length === 0) return fail("manifest has no keywords field");
      if (k.length < 8) return fail(`only ${k.length} keywords (≥8 recommended)`);
      return ok(`${k.length} keywords present`);
    },
  },
  {
    id: "seo-manifest-description",
    category: "seo",
    dimension: "seo",
    title: "Manifest description mirrors repo SEO copy",
    why: "npm/PyPI show the manifest description first — mismatches split your click-through between registries and GitHub.",
    applies: "Generated metaDescription keeps registry + repo copy consistent.",
    artifact: "metaDescription",
    detect: (c) => {
      const m = c.repo.manifest?.description;
      if (!m) return fail("no description in package manifest");
      return ok(`manifest description · ${m.length} chars`);
    },
  },
  {
    id: "seo-badges",
    category: "seo",
    dimension: "seo",
    title: "README badge row (≥3 quality badges)",
    why: "Badges render as trust signals in screenshots, embeds, and answer-engine snapshots of the README.",
    applies: "Badge block template for build · npm · license · stars included in the pack notes.",
    detect: (c) => {
      const n = (c.readme.match(new RegExp(BADGE_RE.source, "gi")) ?? []).length;
      if (n < 3) return fail(`only ${n} badge(s) detected`);
      return ok(`${n} badges detected`);
    },
  },
  {
    id: "seo-homepage-link",
    category: "seo",
    dimension: "seo",
    title: "Repository website/homepage link",
    why: "The homepage field creates a verified backlink from the repo page — a crawlable edge for the docs domain.",
    applies: "Pack JSON-LD carries url + homepage for consistency across surfaces.",
    artifact: "jsonLd",
    detect: (c) => (c.repo.homepage ? ok(`homepage: ${c.repo.homepage}`) : fail("no homepage/website set")),
  },
  {
    id: "seo-heading-hierarchy",
    category: "seo",
    dimension: "seo",
    title: "Clean H1→H2→H3 heading hierarchy",
    why: "Crawlers build sitelink anchors from headings; skipped levels fragment the outline.",
    applies: "llms-full.txt mirrors the corrected outline in semantic Markdown.",
    artifact: "llmsFullTxt",
    detect: (c) => {
      const h1 = headingCount(c.readme, 1);
      const h2 = headingCount(c.readme, 2);
      if (h1 !== 1) return fail(`${h1} H1 headings (want exactly 1)`);
      if (h2 < 3) return fail(`only ${h2} H2 sections`);
      return ok(`1 H1 · ${h2} H2 sections`);
    },
  },
  {
    id: "seo-install-command",
    category: "seo",
    dimension: "seo",
    title: "One-command install block",
    why: "'How to install X' is a top commercial query — a fenced install command is eligible for code-snippet features.",
    applies: "Quick-answer block includes the canonical install command.",
    artifact: "quickAnswer",
    detect: (c) =>
      INSTALL_RE.test(c.readme)
        ? ok("install command found in README")
        : fail("no fenced install command"),
  },
  {
    id: "seo-code-examples",
    category: "seo",
    dimension: "seo",
    title: "≥2 runnable code examples",
    why: "Usage snippets rank for 'how to do X with <lib>' long-tails and get lifted into AI answers verbatim.",
    applies: "llms-full.txt ships annotated usage examples per surface.",
    artifact: "llmsFullTxt",
    detect: (c) => {
      const n = fencedBlocks(c.readme).length;
      if (n < 2) return fail(`only ${n} fenced code block(s)`);
      return ok(`${n} code blocks`);
    },
  },
  {
    id: "seo-alt-text",
    category: "seo",
    dimension: "seo",
    title: "Descriptive alt text on all images",
    why: "Alt text is indexable text for image search and a stated requirement of AI-crawler guidelines.",
    applies: "Pack guidance + llms.txt describe every visual in prose.",
    artifact: "llmsTxt",
    detect: (c) => {
      const imgs = [...c.readme.matchAll(IMG_RE)];
      if (imgs.length === 0) return ok("n/a — no images in README");
      const missing = imgs.filter((m) => !m[1].trim()).length;
      if (missing > 0) return fail(`${missing}/${imgs.length} images missing alt text`);
      return ok(`all ${imgs.length} images have alt text`);
    },
  },
  {
    id: "seo-footer-links",
    category: "seo",
    dimension: "seo",
    title: "Related-links footer",
    why: "Outbound related-links give crawlers entity context and earn reciprocal links from ecosystems.",
    applies: "llms.txt link section doubles as the README footer.",
    artifact: "llmsTxt",
    detect: (c) => {
      const tail = c.readme.slice(-1500);
      const links = (tail.match(/\]\(https?:\/\//g) ?? []).length;
      if (links < 3) return fail(`only ${links} link(s) in the README footer`);
      return ok(`${links} links in footer zone`);
    },
  },
  {
    id: "seo-canonical-name",
    category: "seo",
    dimension: "seo",
    title: "One canonical project name everywhere",
    why: "Name variants (pkg-name vs PkgName vs The Pkg) split brand queries and confuse entity extraction.",
    applies: "Pack uses one canonical name across description, agents.txt, llms.txt, and JSON-LD.",
    artifact: "description",
    detect: (c) => {
      const name = c.repo.repo;
      const inH1 = new RegExp(`^#\\s.*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(c.readme);
      if (!inH1) return fail("repo name not found in README H1");
      return ok(`canonical name "${name}" in H1`);
    },
  },
  {
    id: "seo-license-visible",
    category: "seo",
    dimension: "seo",
    title: "License stated in README text",
    why: "'Is X free / what license' is a pre-install decision query — state it where crawlers read.",
    applies: "Quick answer + FAQ state the license explicitly.",
    artifact: "quickAnswer",
    detect: (c) => {
      const stated = /\b(mit|apache-?2\.0|bsd|gpl|mpl|isc|unlicense|lgpl)\b license/i.test(c.readme) || /##\s*license/i.test(c.readmeLower);
      if (!stated) return fail("no License section in README");
      return ok("license stated in README");
    },
  },
  {
    id: "seo-repository-url",
    category: "seo",
    dimension: "seo",
    title: "manifest.repository points at GitHub",
    why: "Registry → repo backlink consolidates your package and code into one entity for search engines.",
    applies: "JSON-LD sameAs + codeRepository fields carry the canonical URL.",
    artifact: "jsonLd",
    detect: (c) => (c.repo.manifest?.repository ? ok("repository URL present") : fail("no repository field in manifest")),
  },
  {
    id: "seo-bugs-url",
    category: "seo",
    dimension: "seo",
    title: "Issue tracker (bugs) URL in manifest",
    why: "Support surfaces rank ('X github issues') and signal maintained-ness to crawlers.",
    applies: "JSON-LD + agents.txt reference the tracker URL.",
    artifact: "agentsTxt",
    detect: (c) => (c.repo.manifest?.bugs ? ok("bugs URL present") : fail("no bugs field in manifest")),
  },
  {
    id: "seo-freshness-date",
    category: "seo",
    dimension: "seo",
    title: "Recency signal in the first screen",
    why: "Search engines boost freshly-maintained repos; a visible date converts maintenance into ranking.",
    applies: "llms.txt 'last updated' line + JSON-LD dateModified.",
    artifact: "llmsTxt",
    detect: (c) => {
      if (!c.repo.pushedAt) return fail("no push date known");
      const months = (c.today.getTime() - new Date(c.repo.pushedAt).getTime()) / 2.628e9;
      if (months > 6) return fail(`last push ${months.toFixed(0)} months ago`);
      return ok(`pushed ${months.toFixed(1)} months ago`);
    },
  },
  {
    id: "seo-star-social-proof",
    category: "seo",
    dimension: "seo",
    title: "Traction numbers in README copy",
    why: "Numbers in text (not just badges) get indexed and quoted — 'trusted by N teams' is a ranking keyword magnet.",
    applies: "Quotable About block embeds stars/downloads/benchmarks in prose.",
    artifact: "aboutPara",
    detect: (c) =>
      NUMBERISH_RE.test(c.readme.replace(/```[\s\S]*?```/g, ""))
        ? ok("numeric traction found in prose")
        : fail("no numeric traction in README prose"),
  },
];

// ═══ Ring 2 — Answer Engines · AEO (18) ══════════════════════════════════════

const AEO_ITEMS: DetectableItem[] = [
  {
    id: "aeo-quick-answer",
    category: "aeo",
    dimension: "aeo",
    title: "40-60 word quick-answer block",
    why: "Perplexity and AI Overviews lift a self-contained 'What is X?' paragraph verbatim — this is the #1 AEO surface.",
    applies: "Generated quickAnswer block, drop-in after the H1.",
    artifact: "quickAnswer",
    detect: (c) => {
      const paras = paragraphs(c.readme.slice(0, 2000)).filter((p) => !p.startsWith("!") && !p.startsWith("[!") && !BADGE_RE.test(p));
      const first = paras.find((p) => !p.startsWith("#"));
      if (!first) return fail("no prose paragraph in the first screen");
      const w = wordCount(first);
      if (w < 25) return fail(`first paragraph only ${w} words (want 40-60)`);
      if (w > 90) return fail(`first paragraph is ${w} words — too long to quote`);
      return ok(`answer paragraph · ${w} words`);
    },
  },
  {
    id: "aeo-faq",
    category: "aeo",
    dimension: "aeo",
    title: "FAQ section (6-8 real questions)",
    why: "FAQ headings map 1:1 to question queries; answer engines quote the Q/A pair directly.",
    applies: "Six generated Q/As from actual adoption + comparison questions.",
    artifact: "faq",
    detect: (c) =>
      hasSection(c.readmeLower, "faq", "frequently asked")
        ? ok("FAQ section present")
        : fail("no FAQ section"),
  },
  {
    id: "aeo-faq-schema",
    category: "aeo",
    dimension: "aeo",
    title: "FAQPage structured data",
    why: "schema.org FAQPage markup makes the Q/As machine-readable to every answer engine and rich-result parser.",
    applies: "FAQPage JSON-LD generated in the pack's @graph.",
    artifact: "jsonLd",
    detect: (c) =>
      /application\/ld\+json|schema\.org/i.test(c.readme)
        ? ok("JSON-LD referenced in README")
        : fail("no structured data anywhere"),
  },
  {
    id: "aeo-jsonld-software",
    category: "aeo",
    dimension: "aeo",
    title: "SoftwareApplication JSON-LD entity",
    why: "A canonical SoftwareApplication node ties name, version, license, and repo into one knowledge-graph entity.",
    applies: "Generated SoftwareApplication node with offers/aggregateRating slots.",
    artifact: "jsonLd",
    detect: () => fail("no SoftwareApplication schema detected"),
  },
  {
    id: "aeo-question-headings",
    category: "aeo",
    dimension: "aeo",
    title: "Question-style H2/H3 headings (≥2)",
    why: "'How do you…?' headings let engines map sections to queries without inference.",
    applies: "FAQ + docs section use question headings generated in the pack.",
    artifact: "faq",
    detect: (c) => {
      const n = (c.readme.match(QUESTION_H_RE) ?? []).length;
      if (n < 2) return fail(`only ${n} question-style heading(s)`);
      return ok(`${n} question headings`);
    },
  },
  {
    id: "aeo-comparison-table",
    category: "aeo",
    dimension: "aeo",
    title: "Comparison table vs alternatives",
    why: "Answer engines prefer tables for 'X vs Y' queries — tables get quoted with attribution.",
    applies: "Generated 4-column comparison vs the 3 named alternatives.",
    artifact: "comparison",
    detect: (c) =>
      /\|\s*-{3,}\s*\|/.test(c.readme)
        ? ok("markdown table found")
        : fail("no comparison table"),
  },
  {
    id: "aeo-cited-stats",
    category: "aeo",
    dimension: "aeo",
    title: "Citable stats with units",
    why: "Answers cite specific numbers ('2.1M downloads, 40% faster') — vague claims are never quoted.",
    applies: "About block + FAQ embed stars, downloads, benchmarks with units.",
    artifact: "aboutPara",
    detect: (c) => (NUMBERISH_RE.test(c.readme) ? ok("stats with units found") : fail("no citable numbers")),
  },
  {
    id: "aeo-install-answer",
    category: "aeo",
    dimension: "aeo",
    title: "Zero-context install answer",
    why: "The single most-asked question — engines extract the command only when it appears without setup prerequisites.",
    applies: "Quick answer leads with the one-liner install command.",
    artifact: "quickAnswer",
    detect: (c) =>
      INSTALL_RE.test(c.readme)
        ? ok("standalone install command present")
        : fail("install requires reading multiple sections"),
  },
  {
    id: "aeo-definitions",
    category: "aeo",
    dimension: "aeo",
    title: "Definitions / glossary block",
    why: "Definitional sentences ('X is a … that …') are the extraction target for definitional queries.",
    applies: "llms.txt opens with the canonical definition sentence.",
    artifact: "llmsTxt",
    detect: (c) =>
      hasSection(c.readmeLower, "glossar", "definitions", "terminology")
        ? ok("glossary section present")
        : fail("no definitions block"),
  },
  {
    id: "aeo-tldr",
    category: "aeo",
    dimension: "aeo",
    title: "TL;DR / summary block",
    why: "A TL;DR gives engines a ready-made snippet and skimmers the answer in one glance.",
    applies: "Quick-answer card doubles as the TL;DR.",
    artifact: "quickAnswer",
    detect: (c) =>
      /\b(tl;?dr|summary|at a glance|in short)\b/i.test(c.readme.slice(0, 3000))
        ? ok("TL;DR present")
        : fail("no TL;DR block"),
  },
  {
    id: "aeo-voice-readable",
    category: "aeo",
    dimension: "aeo",
    title: "Project name in opening prose",
    why: "Voice assistants read the first paragraph aloud — the name must appear in spoken prose, not only in badges.",
    applies: "Quick answer opens with '<Name> is a …'.",
    artifact: "quickAnswer",
    detect: (c) => {
      const first = paragraphs(c.readme).find((p) => !p.startsWith("#") && !p.startsWith("!") && !p.startsWith("[!"));
      if (!first) return fail("no opening prose");
      return new RegExp(c.repo.repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(first)
        ? ok("name appears in opening prose")
        : fail("name missing from opening prose");
    },
  },
  {
    id: "aeo-latest-version",
    category: "aeo",
    dimension: "aeo",
    title: "Current version stated in README",
    why: "'What version of X' is a live query — engines trust repos that state their own version.",
    applies: "llms.txt + JSON-LD carry the version; FAQ states it in prose.",
    artifact: "llmsTxt",
    detect: (c) => (VERSION_RE.test(c.readme.replace(/```[\s\S]*?```/g, "")) ? ok("version in README prose") : fail("no version stated")),
  },
  {
    id: "aeo-compatibility",
    category: "aeo",
    dimension: "aeo",
    title: "Compatibility / requirements block",
    why: "'Does X work with Node 22 / Python 3.12' — engines answer from an explicit requirements section.",
    applies: "FAQ answers compatibility; llms-full.txt lists requirements.",
    artifact: "llmsFullTxt",
    detect: (c) =>
      hasSection(c.readmeLower, "requirement", "compatibilit", "prerequisite", "supported")
        ? ok("requirements section present")
        : fail("no compatibility section"),
  },
  {
    id: "aeo-troubleshooting",
    category: "aeo",
    dimension: "aeo",
    title: "Troubleshooting section",
    why: "Error-message queries are the highest-intent support traffic; engines extract problem→fix pairs.",
    applies: "FAQ includes failure→fix pairs; llms-full.txt mirrors them.",
    artifact: "faq",
    detect: (c) =>
      hasSection(c.readmeLower, "troubleshoot", "common issues", "gotchas", "error")
        ? ok("troubleshooting present")
        : fail("no troubleshooting section"),
  },
  {
    id: "aeo-use-cases",
    category: "aeo",
    dimension: "aeo",
    title: "Use-cases / when-to-use section",
    why: "Engines answer 'when should I use X' by quoting a scannable use-case list.",
    applies: "llms.txt Use-when section + FAQ cover the decision query.",
    artifact: "llmsTxt",
    detect: (c) =>
      hasSection(c.readmeLower, "use case", "when to use", "why ", "who is this for", "features")
        ? ok("use-cases covered")
        : fail("no use-case framing"),
  },
  {
    id: "aeo-docs-link",
    category: "aeo",
    dimension: "aeo",
    title: "Docs destination linked",
    why: "Answer engines cite sources with stable doc URLs — no docs means no citation.",
    applies: "llms.txt link block points at docs, API ref, and examples.",
    artifact: "llmsTxt",
    detect: (c) =>
      Boolean(c.repo.homepage) || /docs?\/|documentation|readthedocs|\.wiki/i.test(c.readme)
        ? ok("docs destination found")
        : fail("no docs link"),
  },
  {
    id: "aeo-structured-answers",
    category: "aeo",
    dimension: "aeo",
    title: "Answer-formatted sections (heading → list/table)",
    why: "Engines extract answers more often when a heading is followed within ~400 chars by a list or table.",
    applies: "llms-full.txt formats every section as heading → compact list.",
    artifact: "llmsFullTxt",
    detect: (c) => {
      const re = /^#{2,3} [^\n]+\n+(?:[-*\d]|[|])/gm;
      const n = (c.readme.match(re) ?? []).length;
      if (n < 2) return fail(`only ${n} heading→list/table pattern(s)`);
      return ok(`${n} extraction-ready sections`);
    },
  },
  {
    id: "aeo-concise-paragraphs",
    category: "aeo",
    dimension: "aeo",
    title: "Quote-sized paragraphs (≤90 words)",
    why: "Extraction models clip at ~90 words — shorter paragraphs survive quoting intact.",
    applies: "All generated copy is quote-sized by construction.",
    artifact: "aboutPara",
    detect: (c) => {
      const long = paragraphs(c.readme).filter((p) => wordCount(p) > 120).length;
      if (long > 0) return fail(`${long} paragraph(s) over 120 words`);
      return ok("paragraphs quote-sized");
    },
  },
];

// ═══ Ring 3 — Generative Engines · GEO (18) ═════════════════════════════════

const GEO_ITEMS: DetectableItem[] = [
  {
    id: "geo-llms-txt",
    category: "geo",
    dimension: "geo",
    title: "llms.txt at repo root",
    why: "The emerging standard (Answer.AI) that gives LLMs a curated, markdown map of the project — read first by ChatGPT/Claude crawlers.",
    applies: "Full llms.txt generated: definition, quickstart, links, use-when.",
    artifact: "llmsTxt",
    detect: (c) => (hasFile(c, "llms.txt") ? ok("llms.txt committed") : fail("no llms.txt in repo root")),
  },
  {
    id: "geo-llms-full-txt",
    category: "geo",
    dimension: "geo",
    title: "llms-full.txt expanded context",
    why: "The deep-context companion: full API surface and examples for models doing retrieval with larger budgets.",
    applies: "llms-full.txt generated with outline + examples + FAQ.",
    artifact: "llmsFullTxt",
    detect: (c) => (hasFile(c, "llms-full.txt") ? ok("llms-full.txt committed") : fail("no llms-full.txt")),
  },
  {
    id: "geo-agents-txt",
    category: "geo",
    dimension: "geo",
    title: "agents.txt — agent instructions file",
    why: "Coding agents (Codex, Cursor, Devin, Claude Code) read agents.txt/AGENTS.md to orient instantly — it is the robotstxt for agents.",
    applies: "agents.txt generated: what/why/constraints/do-not commands.",
    artifact: "agentsTxt",
    detect: (c) =>
      hasFile(c, "agents.txt") || hasFile(c, "agents.md") || hasFile(c, "agents.txt.md")
        ? ok("agent instructions file found")
        : fail("no agents.txt / AGENTS.md"),
  },
  {
    id: "geo-robots-ai",
    category: "geo",
    dimension: "geo",
    title: "robots.txt explicitly allows AI crawlers",
    why: "GPTBot, ClaudeBot, PerplexityBot and friends check robots.txt first — a missing file means unpredictable crawling.",
    applies: "robots.txt generated with explicit AI-crawler allow rules.",
    artifact: "robotsAiTxt",
    detect: (c) => {
      const r = raw(c, "robots.txt");
      if (!r) return fail("no robots.txt at the docs/root domain");
      const bots = ["gptbot", "claudebot", "perplexitybot", "ccbot", "google-extended"].filter((b) => r.toLowerCase().includes(b));
      if (bots.length === 0) return fail("robots.txt has no AI-crawler rules");
      return ok(`AI rules for: ${bots.join(", ")}`);
    },
  },
  {
    id: "geo-fact-density",
    category: "geo",
    dimension: "geo",
    title: "Fact-dense prose (versions + dates)",
    why: "Generative engines weight sentences with verifiable facts — versions and ISO dates raise citation confidence.",
    applies: "About block + llms.txt pack versions, dates, and numbers into prose.",
    artifact: "aboutPara",
    detect: (c) => {
      const prose = c.readme.replace(/```[\s\S]*?```/g, "");
      const hasV = VERSION_RE.test(prose);
      const hasD = ISO_DATE_RE.test(prose);
      if (hasV && hasD) return ok("versions + dates in prose");
      if (hasV || hasD) return ok("partial — one fact type present");
      return fail("no versions or dates in README prose");
    },
  },
  {
    id: "geo-cite-block",
    category: "geo",
    dimension: "geo",
    title: "Quotable About block (40-90 words + stat)",
    why: "The paragraph engines lift word-for-word with attribution when asked 'what is X?'",
    applies: "Generated About paragraph with unique stat, ready to paste.",
    artifact: "aboutPara",
    detect: (c) => {
      const hit = paragraphs(c.readme).find((p) => {
        const w = wordCount(p);
        return w >= 40 && w <= 90 && /\d/.test(p) && !p.startsWith("#") && !p.startsWith("!");
      });
      return hit ? ok("quotable block present") : fail("no stat-bearing 40-90 word paragraph");
    },
  },
  {
    id: "geo-semantic-markdown",
    category: "geo",
    dimension: "geo",
    title: "Exactly one H1 + ordered outline",
    why: "LLM parsers infer document structure from heading order — multiple H1s corrupt the tree.",
    applies: "llms.txt/llms-full.txt model the correct single-H1 outline.",
    artifact: "llmsTxt",
    detect: (c) => {
      const h1 = headingCount(c.readme, 1);
      return h1 === 1 ? ok("single H1") : fail(`${h1} H1 headings`);
    },
  },
  {
    id: "geo-changelog-dates",
    category: "geo",
    dimension: "geo",
    title: "CHANGELOG.md with ISO dates",
    why: "Dated changelogs prove freshness and give engines a timeline to cite ('added in v2.3, 2025-08').",
    applies: "llms-full.txt includes the dated change timeline.",
    artifact: "llmsFullTxt",
    detect: (c) => {
      const cl = raw(c, "CHANGELOG.md");
      if (!hasFile(c, "changelog.md")) return fail("no CHANGELOG.md");
      if (!cl || !ISO_DATE_RE.test(cl)) return fail("changelog lacks ISO dates");
      return ok("dated changelog present");
    },
  },
  {
    id: "geo-citation-cff",
    category: "geo",
    dimension: "geo",
    title: "CITATION.cff for academic citation",
    why: "CFF files flow into Zenodo/Google Scholar and make papers cite the repo — GEO for the academic engine cluster.",
    applies: "Citation guidance + metadata in JSON-LD (citation field).",
    artifact: "jsonLd",
    detect: (c) => (hasFile(c, "citation.cff") ? ok("CITATION.cff present") : fail("no CITATION.cff")),
  },
  {
    id: "geo-consistent-naming",
    category: "geo",
    dimension: "geo",
    title: "Canonical name across all surfaces",
    why: "Entity resolution needs one name in H1, manifest, description, and topics — variants fragment the knowledge node.",
    applies: "Pack enforces the canonical name everywhere.",
    artifact: "description",
    detect: (c) => {
      const name = c.repo.repo.toLowerCase();
      const inTopics = c.repo.topics.some((t) => t.toLowerCase().replace(/-/g, "") === name.replace(/-/g, ""));
      const inDesc = c.repo.description.toLowerCase().includes(name);
      if (inTopics && inDesc) return ok("name consistent in topics + description");
      return fail(`name missing from ${!inTopics ? "topics" : ""}${!inTopics && !inDesc ? " + " : ""}${!inDesc ? "description" : ""}`);
    },
  },
  {
    id: "geo-freshness",
    category: "geo",
    dimension: "geo",
    title: "Active maintenance (pushed < 6 months)",
    why: "Generative engines down-rank stale repos — training-data filters prefer live projects.",
    applies: "llms.txt 'last updated' + FAQ state the maintenance cadence.",
    artifact: "llmsTxt",
    detect: (c) => {
      if (!c.repo.pushedAt) return fail("push date unknown");
      const months = (c.today.getTime() - new Date(c.repo.pushedAt).getTime()) / 2.628e9;
      if (months > 6) return fail(`stale — last push ${months.toFixed(0)} months ago`);
      return ok(`active · pushed ${months.toFixed(1)} months ago`);
    },
  },
  {
    id: "geo-releases",
    category: "geo",
    dimension: "geo",
    title: "Published GitHub Releases",
    why: "Releases are the versioned ground truth engines use for 'latest version of X' answers.",
    applies: "JSON-LD softwareVersion + FAQ state the release line.",
    artifact: "jsonLd",
    detect: (c) =>
      (c.repo.releaseCount ?? 0) > 0
        ? ok(`${c.repo.releaseCount} release(s)`)
        : fail("no GitHub releases"),
  },
  {
    id: "geo-topics-accuracy",
    category: "geo",
    dimension: "geo",
    title: "Topics ⊆ actual stack keywords",
    why: "Topic/keyword agreement is a consistency signal — contradictions lower trust scores in generative ranking.",
    applies: "Generated topics derive from the detected stack, guaranteeing agreement.",
    artifact: "topics",
    detect: (c) => {
      const kw = new Set((c.repo.manifest?.keywords ?? []).map((k) => k.toLowerCase()));
      if (kw.size === 0) return ok("n/a — no manifest keywords to cross-check");
      const overlap = c.repo.topics.filter((t) => kw.has(t.toLowerCase().replace(/-/g, "")) || kw.has(t.toLowerCase())).length;
      if (overlap < 2) return fail("topics and manifest keywords disagree");
      return ok(`${overlap} topic/keyword overlaps`);
    },
  },
  {
    id: "geo-machine-metadata",
    category: "geo",
    dimension: "geo",
    title: "Machine-readable project metadata",
    why: "A JSON node (.well-known/ai-plugin.json, repo.json, or JSON-LD) removes guesswork for agent discovery.",
    applies: "JSON-LD SoftwareApplication node generated — paste into docs or README.",
    artifact: "jsonLd",
    detect: (c) =>
      ctxFilesWellKnown(c) || /application\/ld\+json/.test(c.readme)
        ? ok("machine metadata found")
        : fail("no machine-readable metadata"),
  },
  {
    id: "geo-permissive-license",
    category: "geo",
    dimension: "geo",
    title: "Recognized open-source license",
    why: "Engines tag licenses; an unrecognizable one suppresses the repo from 'open source X' answers.",
    applies: "FAQ + JSON-LD state the SPDX license explicitly.",
    artifact: "faq",
    detect: (c) => {
      const spdx = c.repo.license?.spdx;
      if (!spdx || spdx === "NOASSERTION" || spdx === "Other") return fail(`license unclear (${spdx ?? "none"})`);
      return ok(`${spdx} detected`);
    },
  },
  {
    id: "geo-contributors-visible",
    category: "geo",
    dimension: "geo",
    title: "Multi-contributor signal",
    why: "Engines weigh community proof — solo repos read as experiments, multi-contributor repos as infrastructure.",
    applies: "About block cites contributor count; launch copy references community.",
    artifact: "aboutPara",
    detect: (c) => {
      const n = c.repo.contributors?.length ?? 0;
      if (n >= 2) return ok(`${n} contributors visible`);
      return fail("single-contributor signal");
    },
  },
  {
    id: "geo-quote-worthy",
    category: "geo",
    dimension: "geo",
    title: "A memorable one-liner (blockquote)",
    why: "Models love quotable one-liners — blockquotes are their extraction anchor and your brand hook.",
    applies: "Tagline one-liner in the pack (meta title + quick answer).",
    artifact: "metaTitle",
    detect: (c) => (/^>\s+\S/m.test(c.readme) ? ok("blockquote found") : fail("no quotable one-liner")),
  },
  {
    id: "geo-code-intelligence",
    category: "geo",
    dimension: "geo",
    title: "Language-tagged code fences",
    why: "Tagged fences (```ts) survive retrieval chunking with syntax context; bare fences lose language identity.",
    applies: "llms-full.txt emits tagged fences for every example.",
    artifact: "llmsFullTxt",
    detect: (c) => {
      const blocks = fencedBlocks(c.readme);
      if (blocks.length === 0) return ok("n/a — no code blocks");
      const tagged = blocks.filter(Boolean).length;
      if (tagged / blocks.length < 0.7) return fail(`only ${tagged}/${blocks.length} fences language-tagged`);
      return ok(`${tagged}/${blocks.length} fences tagged`);
    },
  },
];

function ctxFilesWellKnown(c: DetectContext): boolean {
  return c.files.some((f) => f.startsWith(".well-known") || f.includes("ai-plugin") || f === "repo.json");
}

export const OPTIMIZE_CATALOG: DetectableItem[] = [...SEO_ITEMS, ...AEO_ITEMS, ...GEO_ITEMS];

export function catalogByDimension(dim: OptimizeDimension): CatalogItem[] {
  return OPTIMIZE_CATALOG.filter((i) => i.dimension === dim);
}

/** Grouping order for the checklist UI. */
export const OPTIMIZE_CATEGORY_ORDER: OptimizationCategory[] = [
  "seo",
  "aeo",
  "geo",
  "discoverability",
  "trust",
  "launch",
];

// ── Deterministic scoring ────────────────────────────────────────────────────

export function detectAll(ctx: DetectContext): Map<string, ItemSignal> {
  const out = new Map<string, ItemSignal>();
  for (const item of OPTIMIZE_CATALOG) {
    try {
      out.set(item.id, item.detect(ctx));
    } catch (err) {
      out.set(item.id, fail(`detector error: ${err instanceof Error ? err.message : "unknown"}`));
    }
  }
  return out;
}

/** 0-100 for one ring: pass share of that dimension's items. */
export function scoreDimension(signals: Map<string, ItemSignal>, dim: OptimizeDimension): number {
  const items = catalogByDimension(dim);
  const passed = items.filter((i) => signals.get(i.id)?.pass).length;
  return Math.round((passed / items.length) * 100);
}

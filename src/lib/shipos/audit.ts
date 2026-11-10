// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Upgrader Audit Engine: the deterministic 100-point README scorecard
// 8 weighted categories · every check is content-based (regex on the README)
// so the upgrade composer can guarantee a 100/100 result without inventing facts.
// ─────────────────────────────────────────────────────────────────────────────
import type { AuditCategory, AuditCheck, ReadmeAudit, ReadmeStats } from "./upgrade-types";
import { auditTier } from "./upgrade-types";

function countWords(md: string): number {
  return md.replace(/<[^>]+>/g, " ").split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
}

function codeBlockContents(md: string): string[] {
  const out: string[] = [];
  const re = /```[\w+-]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) out.push(m[1]);
  return out;
}

const TEST_CMD_RE =
  /\b(npm|yarn|pnpm|bun)\s+(run\s+)?test|\bpytest\b|\bgo test\b|\bcargo test\b|\bvitest\b|\bjest\b|\bmvn test\b|\bgradle test\b/i;

interface CheckDef {
  id: string;
  label: string;
  weight: number;
  guidance: string;
  test: (md: string, s: ReadmeStats, code: string[]) => { pass: boolean; detail: string };
}

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  checks: CheckDef[];
}

// ── The rubric: 8 categories, 100 points total ───────────────────────────────

const RUBRIC: CategoryDef[] = [
  {
    id: "docs",
    name: "Documentation",
    icon: "FileText",
    checks: [
      {
        id: "doc-title",
        label: "H1 title",
        weight: 3,
        guidance: "Start the README with a single `# Project Name` heading — it is the anchor every viewer and search engine reads first.",
        test: (md) => {
          const h1 = md.match(/^#\s+(.+)$/m);
          return { pass: !!h1, detail: h1 ? `"${h1[1].trim().slice(0, 48)}"` : "no H1 heading found" };
        },
      },
      {
        id: "doc-tagline",
        label: "One-line tagline / intro",
        weight: 3,
        guidance: "Add a one-line description (blockquote or paragraph) directly under the title so a reader knows what this is in 5 seconds.",
        test: (md) => {
          const intro = md.slice(0, 900);
          const line = intro.match(/^(?!#|!\[|[-*]\s|\s*$|[<|>])(.{25,})$/m);
          const quote = intro.match(/^>\s+(.{10,})$/m);
          const hit = quote ?? line;
          return { pass: !!hit, detail: hit ? `"${hit[1].trim().slice(0, 60)}…"` : "no tagline in the first screen" };
        },
      },
      {
        id: "doc-problem",
        label: "Problem statement",
        weight: 3,
        guidance: "Add a `## The Problem` section — name the pain your project kills, with a concrete example.",
        test: (md) => {
          const hit = md.match(/^##\s+.*(problem|challenge|why|pain|motivation)/im);
          return { pass: !!hit, detail: hit ? `"${hit[0].replace(/^##\s+/, "")}"` : "no problem section" };
        },
      },
      {
        id: "doc-solution",
        label: "Solution / what it does",
        weight: 3,
        guidance: "Add a `## The Solution` (or `## What is X?`) section explaining what the project does differently.",
        test: (md) => {
          const hit = md.match(/^##\s+.*(solution|what is|what it does|overview|about|introduction)/im);
          return { pass: !!hit, detail: hit ? `"${hit[0].replace(/^##\s+/, "")}"` : "no solution section" };
        },
      },
      {
        id: "doc-features",
        label: "Features list or table",
        weight: 3,
        guidance: "Add a `## Features` section — a scannable table beats paragraphs; judges and users scan, they don't read.",
        test: (md) => {
          const hit = md.match(/^##\s+.*feature|^\|\s*feature/im);
          return { pass: !!hit, detail: hit ? `features section found` : "no features section" };
        },
      },
      {
        id: "doc-stack",
        label: "Tech stack section",
        weight: 3,
        guidance: "Add a `## Tech Stack` section listing exact technologies — it sets expectations and helps SEO.",
        test: (md) => {
          const hit = md.match(/^##\s+.*(tech stack|stack|built with|built using|technologies)/im);
          return { pass: !!hit, detail: hit ? `"${hit[0].replace(/^##\s+/, "")}"` : "no tech stack section" };
        },
      },
      {
        id: "doc-arch",
        label: "Architecture diagram",
        weight: 3,
        guidance: "Embed a Mermaid architecture diagram — GitHub renders it natively; show how data flows.",
        test: (md) => {
          const mermaid = /```mermaid/.test(md);
          const section = /^##\s+.*(architecture|system design|how it works)/im.test(md);
          return { pass: mermaid || section, detail: mermaid ? "mermaid diagram embedded" : section ? "architecture section found" : "no diagram or architecture section" };
        },
      },
      {
        id: "doc-structure",
        label: "Project structure",
        weight: 2,
        guidance: "Add a `## Project Structure` folder tree with one-line explanations per top-level entry.",
        test: (md) => {
          const hit = md.match(/^##\s+.*(structure|layout|folder)/im);
          return { pass: !!hit, detail: hit ? `"${hit[0].replace(/^##\s+/, "")}"` : "no project structure section" };
        },
      },
      {
        id: "doc-toc",
        label: "Table of contents",
        weight: 2,
        guidance: "Add a linked `## Table of Contents` — anchors keep long READMEs navigable.",
        test: (md) => {
          const hit = /table of contents|^- \[[^\]]+\]\(#/im.test(md);
          return { pass: hit, detail: hit ? "TOC with anchors found" : "no table of contents" };
        },
      },
      {
        id: "doc-depth",
        label: "Content depth ≥ 400 words",
        weight: 1,
        guidance: "Grow the README past 400 words — thin READMEs rank poorly and read as abandonware.",
        test: (md, s) => ({ pass: s.words >= 400, detail: `${s.words} words` }),
      },
    ],
  },
  {
    id: "tests",
    name: "Tests",
    icon: "FlaskConical",
    checks: [
      {
        id: "test-section",
        label: "Testing section",
        weight: 5,
        guidance: "Add a `## Testing` section documenting the test suite, what it covers, and how to run it.",
        test: (md) => {
          const hit = /^##\s+.*(test|quality)/im.test(md);
          return { pass: hit, detail: hit ? "testing section found" : "no testing section" };
        },
      },
      {
        id: "test-command",
        label: "Test run command in a code block",
        weight: 5,
        guidance: "Show the exact test command in a fenced code block (e.g. `npm test`) — copy-paste must work.",
        test: (md, _s, code) => {
          const hit = code.some((c) => TEST_CMD_RE.test(c));
          return { pass: hit, detail: hit ? "test command found in a code block" : "no runnable test command in any code block" };
        },
      },
      {
        id: "test-ci",
        label: "CI status surfaced",
        weight: 2,
        guidance: "Mention CI / GitHub Actions (or add a CI badge) so readers know regressions are caught automatically.",
        test: (md) => {
          const hit = /\bci\b|github actions|continuous integration|build passing/i.test(md);
          return { pass: hit, detail: hit ? "CI referenced" : "no CI mention" };
        },
      },
      {
        id: "test-coverage",
        label: "Coverage / test-status statement",
        weight: 2,
        guidance: "State the test status honestly (coverage number, 'tests passing', or 'coverage not yet measured').",
        test: (md) => {
          const hit = /coverage|\btested\b|test status|tests passing|test suite/i.test(md);
          return { pass: hit, detail: hit ? "test status stated" : "no coverage or test-status statement" };
        },
      },
    ],
  },
  {
    id: "badges",
    name: "Badges",
    icon: "Award",
    checks: [
      {
        id: "badge-row",
        label: "Badge row present",
        weight: 5,
        guidance: "Add a shields.io badge row under the title — badges are the visual proof layer of a README.",
        test: (md, s) => ({ pass: s.badgeCount > 0, detail: `${s.badgeCount} shields.io badges` }),
      },
      {
        id: "badge-count",
        label: "≥ 5 badges",
        weight: 4,
        guidance: "Grow the badge row to at least 5 (build, license, stars, tests, stack) — one line, big signal.",
        test: (md, s) => ({ pass: s.badgeCount >= 5, detail: `${s.badgeCount}/5 badges` }),
      },
      {
        id: "badge-dynamic",
        label: "Dynamic repo badges (stars/license/build)",
        weight: 3,
        guidance: "Use live shields.io endpoints (github/stars, github/license, v/release) instead of hard-coded values — they never go stale.",
        test: (md) => {
          const hit = /img\.shields\.io\/github\/(stars|license|v\/release|last-commit|issues)/i.test(md);
          return { pass: hit, detail: hit ? "dynamic GitHub badges live" : "no dynamic GitHub badges" };
        },
      },
      {
        id: "badge-stack",
        label: "Stack / quality badges",
        weight: 2,
        guidance: "Add language/framework badges (and a tests badge) so the stack is visible before the first paragraph.",
        test: (md) => {
          const hit = /img\.shields\.io\/badge\//i.test(md);
          return { pass: hit, detail: hit ? "static stack badges present" : "no static stack badges" };
        },
      },
    ],
  },
  {
    id: "install",
    name: "Installation",
    icon: "Download",
    checks: [
      {
        id: "inst-prereq",
        label: "Prerequisites",
        weight: 3,
        guidance: "Add a `## Prerequisites` section: runtime version, package manager, system deps — before any install command.",
        test: (md) => {
          const hit = /##\s+.*prerequisites|##\s+.*requirements|prerequisite/i.test(md);
          return { pass: hit, detail: hit ? "prerequisites listed" : "no prerequisites section" };
        },
      },
      {
        id: "inst-steps",
        label: "Install steps with commands",
        weight: 4,
        guidance: "Document real install commands (`git clone`, `npm install`, `pip install -r …`) in fenced code blocks.",
        test: (md, _s, code) => {
          const inBlock = code.some((c) => /\b(git clone|npm install|yarn|pnpm install|bun install|pip install|cargo build|go mod download|composer install)\b/i.test(c));
          const section = /^##\s+.*install/im.test(md);
          return { pass: inBlock || section, detail: inBlock ? "install commands in code blocks" : section ? "install section present" : "no install steps" };
        },
      },
      {
        id: "inst-quickstart",
        label: "Quick start (clone → run)",
        weight: 4,
        guidance: "Add a `## Quick Start` — clone, install, run in under 60 seconds, copy-paste safe.",
        test: (md) => {
          const hit = /^##\s+.*(quick start|getting started|setup|run it|start)/im.test(md);
          return { pass: hit, detail: hit ? "quick start path exists" : "no quick start section" };
        },
      },
      {
        id: "inst-env",
        label: "Environment variables documented",
        weight: 3,
        guidance: "Document every env var in a table (or state clearly that none are required) — 'works on my machine' starts here.",
        test: (md) => {
          const hit = /environment variables|\.env\b|\|\s*`[A-Z][A-Z0-9_]+`\s*\|/i.test(md);
          return { pass: hit, detail: hit ? "env vars covered" : "env vars not documented" };
        },
      },
    ],
  },
  {
    id: "usage",
    name: "Usage",
    icon: "Terminal",
    checks: [
      {
        id: "usage-section",
        label: "Usage section",
        weight: 4,
        guidance: "Add a `## Usage` section showing the project in action — real commands, real output.",
        test: (md) => {
          const hit = /^##\s+.*(usage|use it|how to use|commands|examples?)/im.test(md);
          return { pass: hit, detail: hit ? "usage section found" : "no usage section" };
        },
      },
      {
        id: "usage-examples",
        label: "Runnable code examples",
        weight: 4,
        guidance: "Include at least 2 fenced code examples (bash/JS/Python…) — abstract docs lose the reader.",
        test: (md, s, code) => {
          const runnable = code.filter((c) => c.trim().length > 8).length;
          return { pass: runnable >= 2 || s.codeBlocks >= 3, detail: `${Math.max(runnable, 0)} runnable blocks (${s.codeBlocks} total)` };
        },
      },
      {
        id: "usage-scripts",
        label: "Commands / scripts reference",
        weight: 2,
        guidance: "List the project's scripts/commands (npm run dev, make target…) in a table or list.",
        test: (md) => {
          const hit = /\b(npm run|yarn run|pnpm run|bun run|make|go run|cargo run)\s+\w+/i.test(md);
          return { pass: hit, detail: hit ? "command reference found" : "no command reference" };
        },
      },
    ],
  },
  {
    id: "visuals",
    name: "Visuals & Demo",
    icon: "ImageIcon",
    checks: [
      {
        id: "vis-hero",
        label: "Hero banner / visual anchor",
        weight: 3,
        guidance: "Add a hero banner (capsule-render works natively on GitHub) so the page opens with a visual, not a wall of text.",
        test: (md) => {
          const hit = /capsule-render|<div align="center">|<img[^>]+width="100%"/i.test(md);
          return { pass: hit, detail: hit ? "hero banner present" : "no hero banner" };
        },
      },
      {
        id: "vis-demo",
        label: "Demo section (live link or run-it-locally)",
        weight: 3,
        guidance: "Add a `## Demo` section — link the live deployment or show exactly how to see it running locally.",
        test: (md) => {
          const hit = /^##\s+.*(demo|live|playground|try it)/im.test(md);
          return { pass: hit, detail: hit ? "demo section found" : "no demo section" };
        },
      },
      {
        id: "vis-media",
        label: "Embedded media",
        weight: 2,
        guidance: "Embed visual media (banner, diagram, screenshot or GIF) — `![](...)` images render on GitHub.",
        test: (md, s) => ({ pass: s.images >= 2, detail: `${s.images} embedded images` }),
      },
    ],
  },
  {
    id: "trust",
    name: "Trust",
    icon: "ShieldCheck",
    checks: [
      {
        id: "trust-license",
        label: "License section",
        weight: 3,
        guidance: "Add a `## License` section naming the license and linking the file — no license kills adoption.",
        test: (md) => {
          const hit = /^##\s+.*licen[cs]e/im.test(md);
          return { pass: hit, detail: hit ? "license section found" : "no license section" };
        },
      },
      {
        id: "trust-contrib",
        label: "Contributing guide",
        weight: 2,
        guidance: "Add a `## Contributing` section: fork → branch → commit → PR steps, so newcomers never guess.",
        test: (md) => {
          const hit = /^##\s+.*contribut/im.test(md);
          return { pass: hit, detail: hit ? "contributing guide found" : "no contributing section" };
        },
      },
      {
        id: "trust-coc",
        label: "Code of conduct",
        weight: 1,
        guidance: "Reference a Code of Conduct — it signals a healthy, welcoming community.",
        test: (md) => {
          const hit = /code of conduct/i.test(md);
          return { pass: hit, detail: hit ? "code of conduct referenced" : "no code of conduct" };
        },
      },
      {
        id: "trust-security",
        label: "Security policy",
        weight: 2,
        guidance: "Add a `## Security` section — how to report vulnerabilities and how secrets are handled.",
        test: (md) => {
          const hit = /##\s+.*security|responsible disclosure/i.test(md);
          return { pass: hit, detail: hit ? "security policy found" : "no security section" };
        },
      },
      {
        id: "trust-changelog",
        label: "Changelog",
        weight: 1,
        guidance: "Add a `## Changelog` (even generated from commits) — readers want to know the project moves.",
        test: (md) => {
          const hit = /^##\s+.*changelog|^##\s+.*history|^##\s+.*what.?s new/im.test(md);
          return { pass: hit, detail: hit ? "changelog found" : "no changelog" };
        },
      },
      {
        id: "trust-faq",
        label: "FAQ (AEO)",
        weight: 1,
        guidance: "Add an FAQ with direct Q&A pairs — answer engines and featured snippets quote exactly this.",
        test: (md) => {
          const hit = /^##\s+.*faq|<details>/im.test(md);
          return { pass: hit, detail: hit ? "FAQ present" : "no FAQ" };
        },
      },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    icon: "Rocket",
    checks: [
      {
        id: "growth-cta",
        label: "CTA (star / fork / try it)",
        weight: 2,
        guidance: "Close with a call-to-action: star the repo, clone it, try the demo — tell the reader the next step.",
        test: (md) => {
          const hit = /⭐|star this repo|give it a star|star the repo|drop a star|hit the star/i.test(md);
          return { pass: hit, detail: hit ? "CTA present" : "no call-to-action" };
        },
      },
      {
        id: "growth-authors",
        label: "Authors / acknowledgments",
        weight: 1,
        guidance: "Credit the humans: `## Acknowledgments` with authors and inspirations.",
        test: (md) => {
          const hit = /^##\s+.*(acknowledg|authors?|credits?|team|contributors)/im.test(md);
          return { pass: hit, detail: hit ? "credits found" : "no authors/credits section" };
        },
      },
      {
        id: "growth-roadmap",
        label: "Roadmap",
        weight: 1,
        guidance: "Add a `## Roadmap` — what's next (and what's explicitly not planned) builds trust.",
        test: (md) => {
          const hit = /^##\s+.*roadmap|^##\s+.*what.?s next/im.test(md);
          return { pass: hit, detail: hit ? "roadmap found" : "no roadmap" };
        },
      },
    ],
  },
];

function computeStats(md: string): ReadmeStats {
  return {
    words: countWords(md),
    h2Count: (md.match(/^##\s+/gm) ?? []).length,
    badgeCount: (md.match(/!\[[^\]]*\]\(https:\/\/img\.shields\.io/g) ?? []).length,
    links: (md.match(/\]\((https?:\/\/[^)]+)\)/g) ?? []).length,
    codeBlocks: (md.match(/```/g) ?? []).length / 2,
    images: (md.match(/!\[[^\]]*\]\(/g) ?? []).length,
    chars: md.length,
  };
}

/**
 * Audit a README against the 100-point rubric.
 * Purely content-based: every check is measurable from the markdown itself.
 */
export function auditReadme(readme: string | null | undefined): ReadmeAudit {
  const hasReadme = !!(readme && readme.trim().length > 0);
  const md = hasReadme ? readme! : "";
  const stats = computeStats(md);
  const code = codeBlockContents(md);

  const categories: AuditCategory[] = RUBRIC.map((cat) => {
    const checks: AuditCheck[] = cat.checks.map((c) => {
      const r = hasReadme ? c.test(md, stats, code) : { pass: false, detail: "no README found in this repository" };
      return { id: c.id, label: c.label, weight: c.weight, pass: r.pass, detail: r.detail, guidance: c.guidance };
    });
    const score = checks.filter((c) => c.pass).reduce((s, c) => s + c.weight, 0);
    const max = checks.reduce((s, c) => s + c.weight, 0);
    return { id: cat.id, name: cat.name, icon: cat.icon, score, max, checks };
  });

  const score = categories.reduce((s, c) => s + c.score, 0);
  const passedCount = categories.reduce((s, c) => s + c.checks.filter((k) => k.pass).length, 0);
  const failedCount = categories.reduce((s, c) => s + c.checks.filter((k) => !k.pass).length, 0);

  return {
    score,
    tier: auditTier(score),
    hasReadme,
    categories,
    stats,
    passedCount,
    failedCount,
  };
}

/** Map a check id → the README section the upgrader renders to fix it. */
export const FIX_SECTIONS: Record<string, string> = {
  "doc-title": "Hero banner",
  "doc-tagline": "Hero banner + TL;DR",
  "doc-problem": "The Problem",
  "doc-solution": "The Solution",
  "doc-features": "Features",
  "doc-stack": "Tech Stack",
  "doc-arch": "Architecture",
  "doc-structure": "Project Structure",
  "doc-toc": "Table of Contents",
  "doc-depth": "Full README rewrite",
  "test-section": "Testing",
  "test-command": "Testing",
  "test-ci": "Testing",
  "test-coverage": "Testing",
  "badge-row": "Badge row",
  "badge-count": "Badge row",
  "badge-dynamic": "Badge row",
  "badge-stack": "Badge row",
  "inst-prereq": "Prerequisites",
  "inst-steps": "Installation",
  "inst-quickstart": "Quick Start",
  "inst-env": "Environment Variables",
  "usage-section": "Usage",
  "usage-examples": "Usage",
  "usage-scripts": "Usage",
  "vis-hero": "Hero banner",
  "vis-demo": "Demo",
  "vis-media": "Hero banner + Architecture diagram",
  "trust-license": "License",
  "trust-contrib": "Contributing",
  "trust-coc": "Contributing",
  "trust-security": "Security",
  "trust-changelog": "Changelog",
  "trust-faq": "FAQ",
  "growth-cta": "Star the repo (CTA)",
  "growth-authors": "Acknowledgments",
  "growth-roadmap": "Roadmap",
};

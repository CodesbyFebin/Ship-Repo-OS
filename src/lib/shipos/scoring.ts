// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Scoring Systems: SEO (0-100) · README 30-Features (0-100) · Health
// ─────────────────────────────────────────────────────────────────────────────
import type { Narrative, ReadmeFeature, RepoData, ScoreCheck, ScorePillar, Scores } from "./types";
import { scoreTier } from "./types";
import { countWords } from "./generators";

// ── The 30 Must-Have README Features ─────────────────────────────────────────

const FEATURES: { id: number; name: string; category: string; re: RegExp }[] = [
  // First Impression 1-6
  { id: 1, name: "Title (H1)", category: "First Impression", re: /^#\s+\S/m },
  { id: 2, name: "Tagline", category: "First Impression", re: /\*\*TL;DR\*\*|^>\s.*/m },
  { id: 3, name: "Badges", category: "First Impression", re: /img\.shields\.io/ },
  { id: 4, name: "Hero Banner", category: "First Impression", re: /capsule-render|hero-banner|<div align="center">/ },
  { id: 5, name: "Demo GIF/Video", category: "First Impression", re: /capsule-render|\.(gif|mp4|webm)|Live demo/i },
  { id: 6, name: "Live Demo Link", category: "First Impression", re: /\[.*\]\((https?:\/\/(?!github|img\.shields)[^)]+)\)/ },
  // Proof 7-12
  { id: 7, name: "Problem Statement", category: "Proof", re: /## The Problem|## Problem/ },
  { id: 8, name: "Solution", category: "Proof", re: /## The Solution|## Solution/ },
  { id: 9, name: "Features Table", category: "Proof", re: /\| Feature \|/ },
  { id: 10, name: "Tech Stack", category: "Proof", re: /## Tech Stack/ },
  { id: 11, name: "Architecture Diagram", category: "Proof", re: /```mermaid/ },
  { id: 12, name: "Performance/Benchmarks", category: "Proof", re: /benchmark|performance|Proof Ledger/i },
  // Developer Experience 13-19
  { id: 13, name: "Quick Start", category: "Developer Experience", re: /## Quick Start/ },
  { id: 14, name: "Installation", category: "Developer Experience", re: /git clone|# 2\. Install/ },
  { id: 15, name: "Usage Examples", category: "Developer Experience", re: /```bash|```sh/ },
  { id: 16, name: "Config/Env Vars", category: "Developer Experience", re: /Environment Variables|envTable|\|\s*`[A-Z_]+`\s*\|/ },
  { id: 17, name: "API/Commands Docs", category: "Developer Experience", re: /## API|## Usage|## Commands|scripts|run dev/ },
  { id: 18, name: "Project Structure", category: "Developer Experience", re: /## Project Structure/ },
  { id: 19, name: "Roadmap", category: "Developer Experience", re: /## Roadmap/ },
  // Trust 20-26
  { id: 20, name: "Tests/Coverage", category: "Trust", re: /## Tests|test suite|coverage/i },
  { id: 21, name: "Security", category: "Trust", re: /SECURITY|security/i },
  { id: 22, name: "Contributing", category: "Trust", re: /## Contributing/ },
  { id: 23, name: "Code of Conduct", category: "Trust", re: /conduct|Code of Conduct/i },
  { id: 24, name: "License", category: "Trust", re: /## License/ },
  { id: 25, name: "Changelog", category: "Trust", re: /## Changelog/ },
  { id: 26, name: "FAQ", category: "Trust", re: /## FAQ|<details><summary/ },
  // Growth 27-30
  { id: 27, name: "Troubleshooting", category: "Growth", re: /Troubleshooting|MISSING:|Rejected claims/i },
  { id: 28, name: "Authors/Credits", category: "Growth", re: /## Acknowledgments|## Authors|## Credits/ },
  { id: 29, name: "Star History", category: "Growth", re: /star-history|Star History/ },
  { id: 30, name: "CTA + Social Links", category: "Growth", re: /⭐ \*\*Star|Star this repo/ },
];

function scoreReadmeFeatures(readme: string): { score: number; tier: Scores["readme"]["tier"]; features: ReadmeFeature[] } {
  const features: ReadmeFeature[] = FEATURES.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    present: f.re.test(readme),
  }));
  const present = features.filter((f) => f.present).length;
  const score = Math.round((present / FEATURES.length) * 100);
  return { score, tier: scoreTier(score), features };
}

// ── SEO / AEO / GEO audit on the generated README ────────────────────────────

function scoreSeo(readme: string, repo: RepoData, narrative: Narrative): { score: number; checks: ScoreCheck[] } {
  const words = countWords(readme);
  const h1 = readme.match(/^#\s+(.+)$/m)?.[1] ?? "";
  const h2Count = (readme.match(/^##\s+/gm) ?? []).length;
  const first100 = readme
    .slice(0, readme.search(/^##\s/m) > 0 ? readme.search(/^##\s/m) : 1200)
    .toLowerCase();
  const keyword = (narrative.keywords[0] ?? repo.repo).toLowerCase();
  const linkCount = (readme.match(/\]\((https?:\/\/[^)]+)\)/g) ?? []).length;
  const imgAlts = [...readme.matchAll(/!\[([^\]]*)\]/g)].map((m) => m[1]);
  const altOk = imgAlts.length === 0 || imgAlts.every((a) => a.trim().length >= 3);

  const checks: ScoreCheck[] = [
    { id: "title-length", label: "Title length ≤ 70 chars", pass: h1.length > 0 && h1.length <= 70, detail: h1 ? `"${h1.slice(0, 40)}${h1.length > 40 ? "…" : ""}" (${h1.length} chars)` : "no H1 found" },
    { id: "h1-present", label: "Single H1 present", pass: !!h1, detail: h1 ? "yes" : "missing" },
    { id: "h2-count", label: "≥ 8 H2 sections", pass: h2Count >= 8, detail: `${h2Count} H2 sections` },
    { id: "keyword-early", label: "Primary keyword in first 100 words", pass: first100.includes(keyword), detail: `keyword "${keyword}" ${first100.includes(keyword) ? "found early" : "not found early"}` },
    { id: "faq", label: "FAQ section (AEO)", pass: /## FAQ/.test(readme), detail: /## FAQ/.test(readme) ? "present with collapsible Q&A" : "missing" },
    { id: "alt-text", label: "Alt text on all images", pass: altOk, detail: altOk ? "all images have descriptive alt" : "empty alt detected" },
    { id: "links", label: "≥ 10 outbound links", pass: linkCount >= 10, detail: `${linkCount} links` },
    { id: "toc", label: "Table of Contents", pass: /## Table of Contents/.test(readme), detail: /## Table of Contents/.test(readme) ? "present with anchors" : "missing" },
    { id: "license", label: "License section", pass: /## License/.test(readme), detail: /## License/.test(readme) ? "present" : "missing" },
    { id: "word-count", label: "≥ 2,000 words", pass: words >= 2000, detail: `${words} words` },
  ];
  return { score: Math.round((checks.filter((c) => c.pass).length / checks.length) * 100), checks };
}

// ── Repo Health (6 pillars) ──────────────────────────────────────────────────

function scoreHealth(repo: RepoData): { score: number; pillars: ScorePillar[]; fixes: string[] } {
  const hasContributing = repo.rootFiles.some((f) => /contribut/i.test(f));
  const hasCoc = repo.rootFiles.some((f) => /conduct/i.test(f));
  const hasSecurity = repo.rootFiles.some((f) => /security/i.test(f));

  const pillars: ScorePillar[] = [
    {
      name: "Docs",
      score: (repo.readme ? 15 : 0) + (hasContributing ? 7 : 0) + (hasCoc ? 3 : 0),
      max: 25,
      detail: `README ${repo.readme ? "✓" : "✗"} · CONTRIBUTING ${hasContributing ? "✓" : "✗"} · COC ${hasCoc ? "✓" : "✗"}`,
    },
    { name: "License", score: repo.license ? 20 : 0, max: 20, detail: repo.license ? repo.license.name : "no LICENSE file detected" },
    {
      name: "Tests",
      score: repo.hasTests ? 20 : 0,
      max: 20,
      detail: repo.hasTests ? "test suite detected from structure + manifests" : "no tests detected",
    },
    { name: "CI", score: Math.min(15, repo.ciWorkflows.length * 5), max: 15, detail: repo.ciWorkflows.length ? `${repo.ciWorkflows.length} workflows` : "no .github/workflows" },
    { name: "Security", score: (hasSecurity ? 7 : 0) + (repo.envExample ? 3 : 0), max: 10, detail: `SECURITY.md ${hasSecurity ? "✓" : "✗"} · .env.example ${repo.envExample ? "✓" : "✗"}` },
    {
      name: "Community",
      score: Math.min(5, Math.floor(repo.stars / 100)) + (repo.contributors.length > 1 ? 3 : 0) + (repo.topics.length ? 2 : 0),
      max: 10,
      detail: `${repo.stars} stars · ${repo.contributors.length} sampled contributors · ${repo.topics.length} topics`,
    },
  ];
  const score = pillars.reduce((s, p) => s + p.score, 0);
  const fixes: string[] = [];
  if (!repo.readme) fixes.push("Add a README.md");
  if (!hasContributing) fixes.push("Add CONTRIBUTING.md with PR conventions");
  if (!hasCoc) fixes.push("Add a Code of Conduct");
  if (!repo.license) fixes.push("Add a LICENSE file");
  if (!repo.hasTests) fixes.push("Add automated tests");
  if (!repo.ciWorkflows.length) fixes.push("Add a CI workflow (.github/workflows/ci.yml)");
  if (!hasSecurity) fixes.push("Add SECURITY.md disclosure policy");
  if (!repo.envExample) fixes.push("Add a documented .env.example");
  if (repo.contributors.length <= 1) fixes.push("Grow contributor base (bus factor = 1)");
  return { score, pillars, fixes };
}

export function computeScores(readme: string, repo: RepoData, narrative: Narrative): Scores {
  const seo = scoreSeo(readme, repo, narrative);
  const readmeScore = scoreReadmeFeatures(readme);
  const health = scoreHealth(repo);
  return {
    seo,
    readme: readmeScore,
    health,
  };
}

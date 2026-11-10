// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Story Engine (deterministic narrative layer over the audit).
// "The Audit scores the code. The Story Engine sells the vision."
//
// Everything here derives from the SAME audit job the score came from:
//   Real Picture → editable problem/vision framing
//   Project Report → executive markdown document
//   deckSmithPro → 50 slides in 6 acts (Hook · Reveal · Audit · Fix · Story · Close)
//   landingPagePro → SEO + AEO + GEO landing page (JSON-LD: SoftwareApplication,
//                    FAQPage, HowTo, SpeakableSpecification)
//   Cinematic Narrator → 5-act video script with caption timings + SRT/VTT + brief
// ─────────────────────────────────────────────────────────────────────────────

import type { AuditJobResponse, RepoAudit, RepoAuditCategory } from "./audit-types";
import { effortMinutes } from "./audit-types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RealPicture {
  problem: string;
  provides: string[];
  serves: { who: string; why: string }[];
  why: string[];
  source: "auto" | "ai" | "edited";
}

export type SlideAct = "hook" | "reveal" | "audit" | "fix" | "story" | "close";

export const SLIDE_ACTS: { id: SlideAct; label: string; from: number; to: number; accent: string }[] = [
  { id: "hook", label: "I · Hook", from: 1, to: 5, accent: "#6c5ce7" },
  { id: "reveal", label: "II · Reveal", from: 6, to: 15, accent: "#00cec9" },
  { id: "audit", label: "III · Audit", from: 16, to: 25, accent: "#f59e0b" },
  { id: "fix", label: "IV · Fix", from: 26, to: 35, accent: "#10b981" },
  { id: "story", label: "V · Story", from: 36, to: 45, accent: "#8b5cf6" },
  { id: "close", label: "VI · Close", from: 46, to: 50, accent: "#f43f5e" },
];

export type SlideVisual =
  | "cover"
  | "gauge"
  | "bars"
  | "radar"
  | "risk"
  | "roadmap"
  | "diff"
  | "graph"
  | "checklist"
  | "arch"
  | "quote"
  | "cta"
  | "stars";

export interface StorySlide {
  n: number;
  act: SlideAct;
  title: string;
  kicker: string;
  bullets: string[];
  visual: SlideVisual;
}

export type SceneVisual = "gauge" | "stars" | "arch" | "diff" | "graph" | "cta" | "intro" | "repo" | "terminal";

export interface VideoScene {
  id: string;
  act: string;
  actLabel: string;
  title: string;
  duration: number; // seconds at 1x
  vo: string[]; // voiceover lines = caption chunks
  onScreen: string[];
  visual: SceneVisual;
  goal: string;
  /** Optional audit facts injected for canvas players (standalone/offline). */
  meta?: { stars: number; passed: number; total: number };
}

export interface VideoScript {
  title: string;
  scenes: VideoScene[];
  totalDuration: number;
}

export interface CaptionChunk {
  index: number;
  start: number;
  end: number;
  text: string;
  sceneId: string;
}

// ── Small helpers ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function failedChecks(a: RepoAudit): { cat: RepoAuditCategory; id: string; label: string; weight: number; detail: string }[] {
  return a.categories.flatMap((cat) =>
    cat.checks.filter((c) => !c.pass && !c.na).map((c) => ({ cat, id: c.id, label: c.label, weight: c.weight, detail: c.detail }))
  );
}

function topFixes(a: RepoAudit, n: number) {
  return a.fixes.slice(0, n);
}

function stackLine(job: AuditJobResponse): string {
  const meta = job.repoMeta;
  const parts: string[] = [];
  if (meta?.language) parts.push(meta.language);
  if (meta?.packageManager) parts.push(meta.packageManager);
  if (meta?.ciWorkflows?.length) parts.push(`${meta.ciWorkflows.length} CI workflow${meta.ciWorkflows.length === 1 ? "" : "s"}`);
  parts.push(meta?.hasTests ? "tests ✓" : "tests missing");
  return parts.join(" · ");
}

function quickWinCount(a: RepoAudit): number {
  return a.roadmap.filter((r) => r.quickWin).length;
}

function minutesFor(a: RepoAudit): number {
  return a.fixes.reduce((sum, f) => sum + effortMinutes(f.effort), 0);
}

// ── 1. Real Picture ──────────────────────────────────────────────────────────

export function buildRealPicture(job: AuditJobResponse): RealPicture {
  const audit = job.audit;
  if (!audit) {
    return {
      problem: "This repository has not been audited yet — run the audit first.",
      provides: [],
      serves: [],
      why: [],
      source: "auto",
    };
  }

  const meta = job.repoMeta;
  const name = `${job.owner}/${job.repo}`;
  const failed = failedChecks(audit);
  const heavy = [...failed].sort((a, b) => b.weight - a.weight);
  const catById = new Map(audit.categories.map((c) => [c.id, c]));
  const docsLost = audit.stats.pointsAtStake - 0 >= 0 ? audit.categories.find((c) => c.id === "docs") : null;
  const docsGap = docsLost ? docsLost.max - docsLost.score : 0;
  const secGap = (() => {
    const c = catById.get("security");
    return c ? c.max - c.score : 0;
  })();
  const ciGap = (() => {
    const c = catById.get("devops");
    return c ? c.max - c.score : 0;
  })();

  const problems: string[] = [];
  if (ciGap > 0) problems.push(`${ciGap} DevOps points are on the table because pipelines and hygiene workflows aren't wired up yet`);
  if (secGap > 0) problems.push(`${secGap} Security points sit with unverified guardrails — the gaps a supply-chain auditor would flag first`);
  if (docsGap > 0) problems.push(`${docsGap} Documentation points leak trust with every new visitor who can't find setup, tests or contribution rules`);
  if (problems.length === 0) problems.push(`${audit.stats.checksTotal} checks are already green — the remaining gap is polish, not survival`);

  const problem = `${name} works — ${meta?.description ? `it ${lowerFirst(trimDot(meta.description))}` : `it solves a real problem for ${audienceFor(meta?.language)} `}— but the audit found ${audit.stats.checksFailed} failing checks worth ${audit.stats.pointsAtStake} points. ${capitalize(problems[0])}. None of these are code problems: they are proof problems, and they cost the repo its ${audit.tier} credibility today.`;

  const provides: string[] = [];
  if (meta?.description) provides.push(capitalize(trimDot(meta.description)) + ".");
  if (meta?.language) provides.push(`${meta.language}${meta.languages.length > 1 ? ` + ${meta.languages.slice(1).map((l) => l.name).join(", ")}` : ""} implementation, ${meta.packageManager ? `managed with ${meta.packageManager}` : "zero-config to run"}.`);
  if (meta?.ciWorkflows?.length) provides.push(`Automated CI via ${meta.ciWorkflows.slice(0, 3).join(", ")} — every push is verified.`);
  if (meta?.hasTests) provides.push("A test suite that already guards the core behaviour.");
  if (meta?.license) provides.push(`Open-sourced under ${meta.license} — safe to adopt, fork and embed.`);
  if (provides.length < 3) {
    provides.push(`${audit.stats.checksPassed} of ${audit.stats.checksTotal} audit checks already pass — the foundation is real.`);
    provides.push(`A ranked roadmap of ${audit.fixes.length} fixes that recovers every missing point with copy-paste code.`);
  }
  if (provides.length < 4) provides.push(`A measurable quality bar: ${audit.score}/100 today, engineered to hit 100/100.`);

  const serves = personasFor(meta?.language, meta?.topics ?? []);

  const why: string[] = [
    `${audit.percentile} of repos score like this — the gap to 100/100 is exactly ${audit.stats.pointsAtStake} points and every one has a named fix.`,
    quickWinCount(audit) > 0
      ? `${quickWinCount(audit)} of the fixes are quick wins (≤5 min each) — visible momentum in a single sitting.`
      : `The full fix path takes ~${minutesFor(audit)} minutes — one focused afternoon to a perfect audit.`,
    `Trust compounds: ${heavy.length ? `closing "${heavy[0].label}" alone recovers ${heavy[0].weight} points and removes the loudest objection` : "a perfect audit makes every future contribution cheaper to accept"}.`,
  ];

  return { problem, provides: provides.slice(0, 5), serves, why, source: "auto" };
}

function audienceFor(lang?: string | null): string {
  switch (lang) {
    case "TypeScript":
    case "JavaScript":
      return "web developers";
    case "Python":
      return "data and backend teams";
    case "Go":
      return "infrastructure teams";
    case "Rust":
      return "systems engineers";
    default:
      return "developers";
  }
}

function personasFor(lang: string | null | undefined, topics: string[]): { who: string; why: string }[] {
  const t = new Set(topics.map((x) => x.toLowerCase()));
  const out: { who: string; why: string }[] = [];
  out.push({
    who: "Solo developers & OSS maintainers",
    why: `they need the project to look trustworthy in 30 seconds — badges, docs and CI do that work while they sleep`,
  });
  if (lang === "TypeScript" || lang === "JavaScript" || t.has("react") || t.has("nextjs")) {
    out.push({ who: "Startup product teams shipping on the web", why: "drop-in integration with the JS stack they already run, with types to keep refactors cheap" });
  }
  if (lang === "Python") out.push({ who: "Data & ML engineers", why: "scriptable, notebook-friendly workflows that slot into existing pipelines" });
  if (lang === "Go") out.push({ who: "Platform & SRE teams", why: "single static binary, boring ops, easy to pin in infrastructure repos" });
  if (out.length < 3) out.push({ who: "Open-source contributors", why: "clear setup, tests and contribution rules make the first PR a 10-minute job" });
  return out.slice(0, 3);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
function trimDot(s: string): string {
  return s.replace(/\.$/, "").trim();
}

// ── 2. Project Report ────────────────────────────────────────────────────────

export function buildStoryReportMarkdown(job: AuditJobResponse): string {
  const audit = job.audit;
  if (!audit) return "";
  const pic = buildRealPicture(job);
  const meta = job.repoMeta;
  const risks = [...audit.risks].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : b.severity === "critical" ? 1 : a.severity === "high" ? -1 : b.severity === "high" ? 1 : 0));
  const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  risks.sort((a, b) => order[a.severity] - order[b.severity]);

  const L: string[] = [];
  L.push(`# Project Report — ${job.owner}/${job.repo}`);
  L.push("");
  L.push(`> Deterministic Full Repo Audit · ${audit.score}/100 · Grade ${audit.grade} · ${audit.tier} · ${audit.percentile} · ${audit.strictness} strictness`);
  L.push("");
  L.push(`## Executive Summary`);
  L.push("");
  L.push(
    `${job.owner}/${job.repo} is a ${stackLine(job)} project scoring **${audit.score}/100** (Grade ${audit.grade}, ${audit.tier}). ` +
      `The deterministic audit ran ${audit.stats.checksTotal} checks across 5 weighted categories — Documentation 25 · Code Quality 25 · Security 20 · DevOps 15 · Community 15 — and found **${audit.stats.checksPassed} passing**, ${audit.stats.checksFailed} failing, with **${audit.stats.pointsAtStake} points recoverable** through ${audit.fixes.length} ranked fixes. ` +
      `Applying all fixes projects the repo to exactly **100/100** in roughly **${minutesFor(audit)} minutes** of copy-paste work.`
  );
  L.push("");
  L.push(`## Problem`);
  L.push("");
  L.push(pic.problem);
  L.push("");
  L.push(`## Solution`);
  L.push("");
  pic.provides.forEach((p) => L.push(`- ${p}`));
  L.push("");
  L.push(`## Who It Serves`);
  L.push("");
  L.push("| Audience | Why it fits |");
  L.push("|---|---|");
  pic.serves.forEach((s) => L.push(`| ${s.who} | ${s.why} |`));
  L.push("");
  L.push(`## Stack`);
  L.push("");
  if (meta) {
    L.push(`- **Language:** ${meta.languages.map((l) => `${l.name} ${l.pct}%`).join(", ") || meta.language || "Unknown"}`);
    L.push(`- **Package manager:** ${meta.packageManager ?? "—"}`);
    L.push(`- **CI:** ${meta.ciWorkflows.length ? meta.ciWorkflows.join(", ") : "none detected"}`);
    L.push(`- **Tests:** ${meta.hasTests ? "detected" : "not detected"}`);
    L.push(`- **License:** ${meta.license ?? "none"}`);
    L.push(`- **Community:** ${meta.stars.toLocaleString()} ★ · ${meta.forks.toLocaleString()} forks${meta.releaseCount ? ` · ${meta.releaseCount} releases` : ""}`);
  } else {
    L.push(`- Offline audit — stack inferred from the pasted file list only.`);
  }
  L.push("");
  L.push(`## Score Breakdown`);
  L.push("");
  L.push("| Category | Score | Max | Pass |");
  L.push("|---|---|---|---|");
  audit.categories.forEach((c) => {
    const passed = c.checks.filter((x) => x.pass && !x.na).length;
    L.push(`| ${c.name} | ${c.score} | ${c.max} | ${passed}/${c.checks.length} |`);
  });
  L.push(`| **Total** | **${audit.score}** | **100** | ${audit.stats.checksPassed}/${audit.stats.checksTotal} |`);
  L.push("");
  L.push(`## Risk Assessment`);
  L.push("");
  if (risks.length === 0) L.push(`No security or reliability risks flagged at ${audit.strictness} strictness.`);
  risks.forEach((r) => L.push(`- **[${r.severity.toUpperCase()}] ${r.title}** — ${r.detail}`));
  L.push("");
  L.push(`## Roadmap to 100`);
  L.push("");
  L.push("| # | Fix | Points | Effort | Cumulative |");
  L.push("|---|---|---|---|---|");
  audit.roadmap.slice(0, 12).forEach((r) => L.push(`| ${r.rank} | ${r.title}${r.quickWin ? " ⚡" : ""} | +${r.points} | ${r.effort} | ${r.cumulative}/100 |`));
  if (audit.roadmap.length > 12) L.push(`| … | ${audit.roadmap.length - 12} more fixes | … | … | 100/100 |`);
  L.push("");
  L.push(`## Next Steps`);
  L.push("");
  L.push(`1. **Apply fix #1 — ${topFixes(audit, 1)[0]?.title ?? "open the Auto Fix tab"}** (+${topFixes(audit, 1)[0]?.points ?? 0} pts, ${topFixes(audit, 1)[0]?.effort ?? "5 min"}). Full code is in the Auto Fix tab.`);
  L.push(`2. **Clear the quick wins** — ${quickWinCount(audit)} fixes take ≤5 min each and move the score fastest per minute spent.`);
  L.push(`3. **Re-audit and publish the badge** — the README badge and shareable report turn the new score into proof for every visitor.`);
  L.push("");
  L.push(`---`);
  L.push("");
  L.push(`*Generated by ShipOS Full Repo Auditor — deterministic scoring, zero LLM guessing. The same repo always scores the same.*`);
  return L.join("\n");
}

// ── 3. deckSmithPro — 50 slides in 6 acts ────────────────────────────────────

export function buildSlides(job: AuditJobResponse): StorySlide[] {
  const audit = job.audit;
  if (!audit) return [];
  const pic = buildRealPicture(job);
  const meta = job.repoMeta;
  const name = `${job.owner}/${job.repo}`;
  const fixes = topFixes(audit, 6);
  const quickWins = audit.roadmap.filter((r) => r.quickWin).slice(0, 4);
  const risks = [...audit.risks].slice(0, 3);
  const lost = failedChecks(audit)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  const S: StorySlide[] = [];
  let n = 0;
  const push = (act: SlideAct, title: string, kicker: string, bullets: string[], visual: SlideVisual) => {
    n += 1;
    S.push({ n, act, title, kicker, bullets, visual });
  };

  // ── Act I · Hook (1-5)
  push("hook", name, "FULL REPO AUDIT — A SHIPOS STORY", [`${audit.score}/100 · Grade ${audit.grade} · ${audit.tier}`, `${audit.stats.checksFailed} failing checks · ${audit.stats.pointsAtStake} points at stake`], "cover");
  push("hook", "Every repo tells two stories", "THE HOOK", ["The code works.", "The proof doesn't — yet.", "Strangers decide in 30 seconds."], "quote");
  push("hook", "What strangers actually check", "THE HOOK", ["Is there a README worth reading?", "Does CI run on every push?", "Would a security team sign off?", "Can I contribute without a treasure map?"], "checklist");
  push("hook", `${name} today`, "THE HOOK", [`${audit.stats.checksPassed}/${audit.stats.checksTotal} checks pass`, `${meta?.stars ? `${meta.stars.toLocaleString()} ★ and climbing` : "growing community"}`, `But ${audit.stats.pointsAtStake} points sit unrecovered`], "stars");
  push("hook", "The promise of this deck", "THE HOOK", [`From ${audit.score} → 100/100`, "Every point mapped to a named fix", "Full code included — no guessing"], "roadmap");

  // ── Act II · Reveal (6-15)
  push("reveal", `What ${job.repo} is`, "THE REVEAL", [meta?.description ? capitalize(trimDot(meta.description)) + "." : "A project that solves a real problem.", ...pic.provides.slice(1, 4)], "cover");
  push("reveal", "The stack", "THE REVEAL", [stackLine(job), meta?.license ? `Licensed ${meta.license}` : "License: none — a fixable risk", ...(meta?.homepage ? [`Homepage: ${meta.homepage}`] : [])], "arch");
  push("reveal", "Who it serves", "THE REVEAL", pic.serves.map((s) => `${s.who} — ${s.why}`), "checklist");
  push("reveal", "Why it matters", "THE REVEAL", pic.why, "quote");
  push("reveal", "How the audit works", "THE ENGINE", ["50 deterministic checks", "5 weighted categories, 100 points", "Same repo → same score. Zero LLM guessing."], "arch");
  push("reveal", "The scoring rubric", "THE ENGINE", ["Documentation — 25 pts", "Code Quality — 25 pts", "Security — 20 pts", "DevOps — 15 pts", "Community — 15 pts"], "bars");
  push("reveal", "What gets scanned", "THE ENGINE", ["Metadata, tree, manifests, README", ".github folder: workflows, templates, funding", "Dockerfile, .env examples, git history"], "checklist");
  push("reveal", "What comes out", "THE ENGINE", ["A 0-100 score with grade + percentile", "Points-lost breakdown, check by check", "Ranked fixes with full copy-paste code"], "graph");
  push("reveal", "Evidence, not vibes", "THE ENGINE", ["Every check cites real file paths", "Every fix targets the actual stack", "Deterministic: re-run and compare"], "diff");
  push("reveal", "The number that started it", "TEASER", [`${audit.score}/100`, "Good. Not yet perfect.", "Let's see exactly where it leaks."], "gauge");

  // ── Act III · Audit (16-25)
  push("audit", `The verdict: ${audit.score}/100`, "THE AUDIT", [`Grade ${audit.grade} · ${audit.tier} · ${audit.percentile}`, `${audit.stats.checksFailed} checks failed`, `${audit.stats.pointsAtStake} points recoverable`], "gauge");
  push("audit", "What the grade means", "THE AUDIT", [`Grade ${audit.grade} = ${audit.tier} on the repo ladder`, `${audit.percentile} of repositories audited`, `Every re-audit uses the identical rubric — progress is real`], "bars");
  audit.categories.forEach((c, i) => {
    const weakest = c.checks.filter((x) => !x.pass && !x.na).slice(0, 2).map((x) => x.label);
    push("audit", `${c.name}: ${c.score}/${c.max}`, "CATEGORY DEEP DIVE", [`${c.checks.filter((x) => x.pass && !x.na).length} of ${c.checks.length} checks pass`, ...(weakest.length ? [`Losing points on: ${weakest.join("; ")}`] : ["Category is clean."]), i === 0 ? "Docs weigh as much as code — by design." : ""].filter(Boolean), "bars");
  });
  push("audit", "Where the points went", "POINTS LOST", lost.map((l) => `-${l.weight} · ${l.label}`), "bars");
  push("audit", "Evidence, check by check", "THE AUDIT", [`${audit.stats.fixFiles.length} real files referenced across fixes`, "Every failed check cites the exact file path", `Re-run any time — ${audit.stats.checksTotal} checks, same result`], "checklist");
  push("audit", "Risk assessment", "SECURITY LENS", risks.length ? risks.map((r) => `[${r.severity.toUpperCase()}] ${r.title}`) : ["No risks flagged at this strictness."], "risk");

  // ── Act IV · Fix (26-35)
  push("fix", "The ranked path to 100", "THE FIX", ["Fixes ordered by points recovered", "Each one: full code, not hints", `~${minutesFor(audit)} minutes end-to-end`], "roadmap");
  fixes.forEach((f) => {
    push("fix", `+${f.points} pts · ${f.title}`, "RANKED FIX", [f.why, `Effort: ${f.effort} · Priority: ${f.priority}`, f.files.map((x) => x.path).slice(0, 3).join(" · ")], "diff");
  });
  push("fix", "Quick wins first", "MOMENTUM", quickWins.length ? quickWins.map((q) => `⚡ ${q.title} → ${q.cumulative}/100`) : ["All remaining fixes are quick wins."], "checklist");
  push("fix", "The time math", "THE FIX", [`Total effort: ~${minutesFor(audit)} minutes`, `${audit.stats.fixFiles.length} files, generated not hand-written`, `Points per minute: ${(audit.stats.pointsAtStake / Math.max(1, minutesFor(audit))).toFixed(1)} — the best hour this repo can buy`], "bars");
  push("fix", "One-click Auto Fix (PRO)", "AUTOMATION", ["Apply every fix in order", "Watch the score climb live", "Download the full bundle or open a PR"], "graph");

  // ── Act V · Story (36-45)
  push("story", "The real picture", "THE STORY", [pic.problem], "quote");
  push("story", "What it provides", "THE STORY", pic.provides, "checklist");
  push("story", "The audience", "THE STORY", pic.serves.map((s) => s.who), "checklist");
  push("story", "Why now", "THE STORY", pic.why, "quote");
  push("story", "Before → After", "THE STORY", [`${audit.score}/100 — today, ${audit.tier}`, `100/100 — after ${audit.fixes.length} fixes`, `${audit.stats.fixFiles.length} files touched, all generated`], "gauge");
  push("story", "The badge effect", "GROWTH", ["README badge = instant credibility", "Shareable public report", "Perfect-score wall + leaderboard"], "graph");
  push("story", "Compounding trust", "GROWTH", ["Higher score → more contributors", "More contributors → faster fixes", "Faster fixes → higher score"], "graph");
  push("story", "Score trend tracking", "GROWTH", ["Re-audit after each change", "History + versioning built in", "Alerts when the score drops"], "arch");
  push("story", "Team mode", "SCALE", ["Workspaces, roles, assignments", "Slack + Discord hooks", "PR bot that fixes on mention"], "arch");
  push("story", "The hero shot", "THE STORY", [`${name} — Grade S. 100/100.`, "Every check green.", "This is the plan."], "cta");

  // ── Act VI · Close (46-50)
  push("close", "The KPIs", "THE CLOSE", [`${audit.score} → 100 score`, `${audit.fixes.length} fixes, ${audit.stats.fixFiles.length} files`, `~${minutesFor(audit)} minutes of work`, "0 LLM guesses"], "bars");
  push("close", "The 30-day roadmap", "THE CLOSE", ["Week 1: apply the ranked fixes", "Week 2: scheduled audits + score alerts", "Week 4: team workspace + PR bot"], "roadmap");
  push("close", "Monetization honesty", "THE MODEL", ["Free: 3 audits/day, 20 checks, first fixes", "PRO: everything, unlocked, one-time or monthly", "PRO TEAM: workspaces, bot, API, SSO"], "checklist");
  push("close", "One command to start", "THE CLOSE", [`1. Audit ${name}`, "2. Open Story Engine", "3. Apply Auto Fix → watch it climb"], "roadmap");
  push("close", "Star it. Fix it. Ship it.", "CTA", [`The audit scored the code.`, "The Story Engine sells the vision.", `${name}: ${audit.score} → 100.`], "cta");

  return S.slice(0, 50);
}

export function buildSlidesMarkdown(slides: StorySlide[], job: AuditJobResponse): string {
  const L: string[] = [];
  L.push(`# ${job.owner}/${job.repo} — ${slides.length}-Slide Deck (deckSmithPro)`);
  L.push("");
  L.push(`> Generated from the deterministic audit: ${job.audit?.score ?? 0}/100 · Grade ${job.audit?.grade ?? "—"} · ${job.audit?.percentile ?? ""}`);
  L.push("");
  let currentAct: SlideAct | null = null;
  for (const s of slides) {
    if (s.act !== currentAct) {
      currentAct = s.act;
      const meta = SLIDE_ACTS.find((a) => a.id === s.act);
      L.push(`## Act ${meta?.label ?? s.act} (slides ${meta?.from}-${meta?.to})`);
      L.push("");
    }
    L.push(`### Slide ${s.n} — ${s.title}`);
    L.push(`*${s.kicker} · visual: ${s.visual}*`);
    L.push("");
    s.bullets.forEach((b) => L.push(`- ${b}`));
    L.push("");
  }
  return L.join("\n");
}

export function slideMarkdown(s: StorySlide): string {
  const L = [`## Slide ${s.n} — ${s.title}`, `*${s.kicker} · visual: ${s.visual}*`, "", ...s.bullets.map((b) => `- ${b}`)];
  return L.join("\n");
}

// ── 4. landingPagePro — SEO + AEO + GEO single-file landing ─────────────────

export function buildLandingHtml(job: AuditJobResponse): string {
  const audit = job.audit;
  if (!audit) return "";
  const meta = job.repoMeta;
  const pic = buildRealPicture(job);
  const name = `${job.owner}/${job.repo}`;
  const title = `${job.repo} — ${audit.score}/100 Full Repo Audit | ShipOS`;
  const desc = `${job.repo} scores ${audit.score}/100 (Grade ${audit.grade}) on the deterministic ShipOS audit. ${audit.stats.pointsAtStake} recoverable points, ${audit.fixes.length} ranked fixes with full code. See the breakdown and the path to 100/100.`;
  const url = job.repoUrl;

  const faqs: { q: string; a: string }[] = [
    { q: `What score does ${job.repo} have?`, a: `${job.repo} currently scores ${audit.score} out of 100 on the ShipOS deterministic audit — Grade ${audit.grade} (${audit.tier}, ${audit.percentile}).` },
    { q: `How can ${job.repo} reach 100/100?`, a: `Applying ${audit.fixes.length} ranked fixes recovers ${audit.stats.pointsAtStake} points. The roadmap is ordered by points-per-effort, and the top quick win is "${audit.roadmap[0]?.title ?? "—"}" (+${audit.roadmap[0]?.points ?? 0} pts, ${audit.roadmap[0]?.effort ?? "5 min"}).` },
    { q: "What does the audit check?", a: "50 deterministic checks across five weighted categories: Documentation (25), Code Quality (25), Security (20), DevOps (15) and Community (15). Checks cite real file paths and never use LLM guessing." },
    { q: "Is the same repo always scored the same?", a: "Yes. Scoring is fully deterministic — the same repository always produces the same score, so progress between re-audits is real progress." },
  ];

  const howtoSteps = [
    `Audit ${name} with the 50-check rubric`,
    `Review the ${audit.stats.pointsAtStake} lost points in the breakdown`,
    `Apply the ranked fixes (full copy-paste code included)`,
    `Re-audit and watch the score climb to 100/100`,
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: job.repo,
      applicationCategory: "DeveloperApplication",
      operatingSystem: meta?.language ? `${meta.language}` : "Cross-platform",
      description: meta?.description ?? desc,
      url,
      softwareVersion: meta?.releaseCount ? `latest of ${meta.releaseCount} releases` : "1.0.0",
      author: { "@type": "Organization", name: job.owner },
      aggregateRating: { "@type": "AggregateRating", ratingValue: String(Math.round((audit.score / 100) * 50) / 10), bestRating: "5", ratingCount: "1" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How ${job.repo} reaches a 100/100 repo audit`,
      totalTime: "PT1H",
      step: howtoSteps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      speakable: { "@type": "SpeakableSpecification", cssSelector: [".speakable-hero", ".speakable-summary"] },
    },
  ];

  const cats = audit.categories;
  const bars = cats
    .map(
      (c) => `        <div class="cat"><div class="cat-head"><span>${esc(c.name)}</span><span class="cat-score">${c.score}/${c.max}</span></div>
          <div class="cat-bar"><div class="cat-fill" style="width:${Math.round((c.score / c.max) * 100)}%"></div></div></div>`
    )
    .join("\n");

  const proofRows = audit.roadmap
    .slice(0, 5)
    .map(
      (r) =>
        `          <tr><td>${r.rank}</td><td>${esc(r.title)}${r.quickWin ? ' <span class="qwin">quick win</span>' : ""}</td><td>+${r.points}</td><td>${esc(r.effort)}</td><td>${r.cumulative}/100</td></tr>`
    )
    .join("\n");

  const faqHtml = faqs.map((f) => `        <details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n");
  const problemBullets = pic.provides.slice(0, 3).map((p) => `          <li>${esc(p)}</li>`).join("\n");
  const whyBullets = pic.why.map((w) => `          <li>${esc(w)}</li>`).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="keywords" content="${esc(`${job.repo}, repo audit, code quality, ${meta?.language ?? "developer tools"}, CI/CD, security audit, 100/100`)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="https://opengraph.githubassets.com/1/${esc(`${job.owner}/${job.repo}`)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="robots" content="index, follow, max-snippet:-1" />
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <style>
    :root { --primary: #6c5ce7; --secondary: #00cec9; --bg: #0b0c10; --card: #14161c; --text: #eef0f4; --muted: #9aa3b2; --ok: #10b981; --warn: #f59e0b; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    a { color: var(--secondary); }
    .container { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
    /* hero video-background simulation */
    .hero { position: relative; overflow: hidden; padding: 96px 0 72px; text-align: center; }
    .hero::before { content: ""; position: absolute; inset: -50%; background:
      radial-gradient(600px 300px at 20% 30%, rgba(108,92,231,.28), transparent 60%),
      radial-gradient(700px 340px at 80% 60%, rgba(0,206,201,.22), transparent 60%),
      radial-gradient(500px 260px at 50% 90%, rgba(108,92,231,.18), transparent 60%);
      animation: heroFlow 16s ease-in-out infinite alternate; z-index: 0; }
    @keyframes heroFlow { from { transform: translate3d(-3%, -2%, 0) scale(1); } to { transform: translate3d(3%, 2%, 0) scale(1.12); } }
    .hero > * { position: relative; z-index: 1; }
    .kicker { font-family: ui-monospace, monospace; letter-spacing: .28em; font-size: 12px; color: var(--secondary); text-transform: uppercase; }
    h1 { font-size: clamp(32px, 6vw, 58px); line-height: 1.08; margin: 14px auto 12px; max-width: 820px; }
    h1 .grad { background: linear-gradient(92deg, var(--primary), var(--secondary)); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .speakable-hero { font-size: 18px; color: var(--muted); max-width: 720px; margin: 0 auto; }
    /* gauge */
    .gauge-wrap { display: inline-block; margin-top: 34px; position: relative; }
    .gauge-num { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .gauge-num b { font-size: 44px; }
    .gauge-num span { font-family: ui-monospace, monospace; font-size: 11px; color: var(--muted); letter-spacing: .2em; }
    .ring { transform: rotate(-90deg); }
    .ring .bg { stroke: #262a33; fill: none; stroke-width: 9; }
    .ring .val { stroke: url(#gaugeGrad); fill: none; stroke-width: 9; stroke-linecap: round; stroke-dasharray: 327; stroke-dashoffset: 327; animation: ringFill 1.8s cubic-bezier(.22,1,.36,1) .3s forwards; }
    @keyframes ringFill { to { stroke-dashoffset: ${(327 * (1 - audit.score / 100)).toFixed(1)}; } }
    .cta-row { margin-top: 36px; display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
    .btn { display: inline-block; padding: 14px 26px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 15px; }
    .btn-primary { background: linear-gradient(92deg, var(--primary), var(--secondary)); color: #08090c; }
    .btn-ghost { border: 1px solid #2a2f3a; color: var(--text); }
    section { padding: 64px 0; }
    section:nth-of-type(even) { background: var(--card); }
    h2 { font-size: clamp(24px, 3.4vw, 34px); margin-bottom: 10px; }
    .lede { color: var(--muted); max-width: 760px; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 22px; margin-top: 28px; }
    .card { background: var(--card); border: 1px solid #232733; border-radius: 16px; padding: 22px; }
    section:nth-of-type(even) .card { background: #0b0c10; }
    .card h3 { margin-bottom: 8px; font-size: 17px; }
    .card ul { padding-left: 18px; color: var(--muted); }
    .card li + li { margin-top: 6px; }
    /* score section */
    .cats { margin-top: 26px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px 26px; }
    .cat-head { display: flex; justify-content: space-between; font-size: 13px; font-family: ui-monospace, monospace; margin-bottom: 6px; }
    .cat-bar { height: 8px; background: #232733; border-radius: 99px; overflow: hidden; }
    .cat-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--primary), var(--secondary)); animation: grow 1.4s cubic-bezier(.22,1,.36,1) both; }
    @keyframes grow { from { width: 0; } }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #232733; }
    th { font-family: ui-monospace, monospace; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; color: var(--muted); }
    .qwin { background: rgba(16,185,129,.14); color: var(--ok); font-size: 11px; padding: 2px 8px; border-radius: 99px; margin-left: 6px; }
    details.faq-item { border-bottom: 1px solid #232733; padding: 16px 4px; }
    details.faq-item summary { cursor: pointer; font-weight: 600; }
    details.faq-item p { color: var(--muted); margin-top: 8px; }
    .final { text-align: center; padding: 84px 0; position: relative; overflow: hidden; }
    .final::before { content: ""; position: absolute; inset: 0; background:
      radial-gradient(500px 240px at 50% 100%, rgba(108,92,231,.25), transparent 65%); }
    .final > * { position: relative; }
    footer { padding: 28px 0; color: var(--muted); font-size: 13px; border-top: 1px solid #1c202a; text-align: center; }
    .diagram { margin-top: 30px; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; font-family: ui-monospace, monospace; font-size: 13px; }
    .node { border: 1px solid #2a2f3a; background: #14161c; border-radius: 10px; padding: 10px 14px; }
    .node.hot { border-color: var(--secondary); color: var(--secondary); }
    .flow { color: var(--muted); animation: dash 1.2s linear infinite; }
    @keyframes dash { 50% { opacity: .35; } }
  </style>
</head>
<body>
  <header class="hero">
    <div class="container">
      <p class="kicker">Full Repo Audit · Deterministic · ${audit.stats.checksTotal} checks</p>
      <h1 class="speakable-hero">${esc(job.repo)} scores <span class="grad">${audit.score}/100</span>.<br />The path to a perfect audit is ${audit.fixes.length} fixes away.</h1>
      <p class="speakable-summary" style="margin-top:10px">${esc(desc)}</p>
      <div class="gauge-wrap" aria-label="Audit score ${audit.score} out of 100">
        <svg class="ring" width="120" height="120" viewBox="0 0 120 120" role="img">
          <defs><linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--primary)" /><stop offset="1" stop-color="var(--secondary)" />
          </linearGradient></defs>
          <circle class="bg" cx="60" cy="60" r="52" />
          <circle class="val" cx="60" cy="60" r="52" />
        </svg>
        <div class="gauge-num"><b>${audit.score}</b><span>/ 100 · GRADE ${esc(audit.grade)}</span></div>
      </div>
      <div class="cta-row">
        <a class="btn btn-primary" href="${esc(url)}">Star it. Clone it. Build it.</a>
        <a class="btn btn-ghost" href="#score">See the score breakdown</a>
      </div>
    </div>
  </header>

  <section id="problem">
    <div class="container">
      <h2>The problem this project solves</h2>
      <p class="lede">${esc(pic.problem)}</p>
      <div class="cols">
        <div class="card"><h3>What it provides</h3><ul>
${problemBullets}
        </ul></div>
        <div class="card"><h3>Why it matters</h3><ul>
${whyBullets}
        </ul></div>
        <div class="card"><h3>Who it serves</h3><ul>
${pic.serves.map((s) => `          <li><strong>${esc(s.who)}</strong> — ${esc(s.why)}</li>`).join("\n")}
        </ul></div>
      </div>
      <div class="diagram" aria-hidden="true">
        <span class="node">your repo</span><span class="flow">──▶</span>
        <span class="node hot">50-check audit</span><span class="flow">──▶</span>
        <span class="node">ranked fixes</span><span class="flow">──▶</span>
        <span class="node hot">100/100</span>
      </div>
    </div>
  </section>

  <section id="score">
    <div class="container">
      <h2>Score breakdown — exactly where the points leak</h2>
      <p class="lede">${audit.stats.checksPassed} of ${audit.stats.checksTotal} checks pass. ${audit.stats.pointsAtStake} points are recoverable through ranked fixes, each with full copy-paste code grounded in the real stack.</p>
      <div class="cats">
${bars}
      </div>
      <table>
        <thead><tr><th>#</th><th>Roadmap fix</th><th>Points</th><th>Effort</th><th>Cumulative</th></tr></thead>
        <tbody>
${proofRows}
        </tbody>
      </table>
    </div>
  </section>

  <section id="how">
    <div class="container">
      <h2>How the audit works</h2>
      <p class="lede">Deterministic, evidence-based, zero LLM guessing — the same repo always scores the same.</p>
      <div class="cols">
        ${howtoSteps.map((s, i) => `<div class="card"><h3>Step ${i + 1}</h3><p style="color:var(--muted)">${esc(s)}</p></div>`).join("\n        ")}
      </div>
    </div>
  </section>

  <section id="faq">
    <div class="container">
      <h2>FAQ</h2>
${faqHtml}
    </div>
  </section>

  <section class="final">
    <div class="container">
      <p class="kicker">Ready?</p>
      <h2>${esc(name)}: ${audit.score} → 100.</h2>
      <p class="lede" style="margin:12px auto 0">${audit.stats.pointsAtStake} points. ${audit.fixes.length} fixes. One focused afternoon.</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="${esc(url)}">Star it. Clone it. Build it.</a>
      </div>
    </div>
  </section>

  <footer>
    Generated by ShipOS Full Repo Auditor — deterministic 100-point repo audits. This page ships full SEO meta, Open Graph, canonical URL and JSON-LD (SoftwareApplication · FAQPage · HowTo · Speakable) for AI answer engines.
  </footer>
</body>
</html>`;
}

// ── 5. Cinematic Narrator — 5-act video script ──────────────────────────────

export function buildVideoScript(job: AuditJobResponse): VideoScript {
  const audit = job.audit;
  if (!audit) return { title: "", scenes: [], totalDuration: 0 };
  const pic = buildRealPicture(job);
  const name = `${job.owner}/${job.repo}`;
  const fix1 = topFixes(audit, 1)[0];
  const fix2 = topFixes(audit, 2)[1];
  const quickWin = audit.roadmap.find((r) => r.quickWin);

  const scenes: VideoScene[] = [
    {
      id: "act1",
      act: "act1",
      actLabel: "Act I · The Gap",
      title: `${name} — ${audit.score}/100`,
      duration: 24,
      goal: "CINE.MAP: gauge-spin + whoosh — open on the score, not the logo.",
      visual: "gauge",
      vo: [
        `Every repository tells two stories. The code — and the proof.`,
        `${name} works. ${metaDescClause(job.repoMeta?.description)}`,
        `But the deterministic audit says ${audit.score} out of one hundred.`,
        `${audit.stats.checksFailed} checks failed. ${audit.stats.pointsAtStake} points are sitting on the table.`,
        `This is the story of how every point comes back.`,
      ],
      onScreen: [`${audit.score}/100`, `${audit.stats.checksFailed} failing checks`, `${audit.stats.pointsAtStake} pts at stake`],
    },
    {
      id: "act2",
      act: "act2",
      actLabel: "Act II · The Discovery",
      title: "What the audit actually found",
      duration: 26,
      goal: "CINE.MAP: stars → count-up + coin-drop — make the invisible visible.",
      visual: "stars",
      vo: [
        `The audit ran ${audit.stats.checksTotal} deterministic checks. Five categories. One hundred points.`,
        pic.problem.split(". ")[1] ? pic.problem.split(". ")[1].replace(/\.$/, "") + "." : `Documentation, code quality, security, DevOps, community — measured, not guessed.`,
        `${audit.stats.checksPassed} checks already pass. The bones are good.`,
        pic.why[0] ?? `The gap to perfection is known, named, and ranked.`,
        `No LLM guessing. The same repo always scores the same.`,
      ],
      onScreen: [`${audit.stats.checksTotal} checks · 5 categories`, `${audit.stats.checksPassed} passed ✓`, "0 LLM guesses"],
    },
    {
      id: "act3",
      act: "act3",
      actLabel: "Act III · The Climb",
      title: "Ranked fixes, full code",
      duration: 26,
      goal: "CINE.MAP: arch → mermaid-flow, then diff-scroll + success-chime.",
      visual: "arch",
      vo: [
        `The engine turns every lost point into a ranked fix — with the full code attached.`,
        fix1 ? `Fix number one: ${fix1.title}. Plus ${fix1.points} points in ${fix1.effort}.` : `The first fix recovers the heaviest chunk of points.`,
        fix2 ? `Then: ${fix2.title.toLowerCase()}. Another ${fix2.points} points.` : `Then the next fix, and the next — each one copy-paste ready.`,
        quickWin ? `Quick wins come first: “${quickWin.title}” moves the needle in under five minutes.` : `Each fix is small. Together they are total.`,
        `${audit.stats.fixFiles.length} files. All generated. All grounded in the real stack.`,
      ],
      onScreen: [`${audit.fixes.length} ranked fixes`, `+${fix1?.points ?? 0} · ${fix1?.title ?? ""}`, `${audit.stats.fixFiles.length} files generated`],
    },
    {
      id: "act4",
      act: "act4",
      actLabel: "Act IV · The Proof",
      title: `${audit.score} → 100`,
      duration: 24,
      goal: "CINE.MAP: proof → commit-graph — the score climbs and stays.",
      visual: "graph",
      vo: [
        `One click. Auto Fix applies every fix in ranked order.`,
        `Watch the gauge climb: ${audit.score}... ${Math.min(100, audit.score + 20)}... one hundred.`,
        `Grade S. Platinum. Every check green.`,
        `Then the badge ships to the README, and the public report does the bragging.`,
        `Re-audit any time. The number holds — because the scoring holds.`,
      ],
      onScreen: [`${audit.score} → 100/100`, `Grade ${audit.grade} → S`, "README badge shipped"],
    },
    {
      id: "act5",
      act: "act5",
      actLabel: "Act V · The Launch",
      title: "Star it. Fix it. Ship it.",
      duration: 20,
      goal: "CINE.MAP: cta — end on the command, not the credits.",
      visual: "cta",
      vo: [
        `The audit scored the code. The Story Engine sells the vision.`,
        `Star the repo. Apply the fixes. Ship the perfect audit.`,
        `${name}: from ${audit.score} to one hundred.`,
        `ShipOS. Every point earns its way back.`,
      ],
      onScreen: [`Star it. Fix it. Ship it.`, `${name} → 100/100`, "ShipOS Story Engine"],
    },
  ];

  return {
    title: `${name} — Cinematic Audit Story`,
    scenes,
    totalDuration: scenes.reduce((s, x) => s + x.duration, 0),
  };
}

function metaDescClause(desc?: string | null): string {
  if (!desc) return `It solves a real problem for real developers.`;
  const clean = trimDot(desc);
  return lowerFirst(clean).endsWith(".") ? clean : `${capitalize(lowerFirst(clean))}.`;
}

/** Flatten a script into absolute-timed caption chunks. */
export function scriptCaptions(script: VideoScript): CaptionChunk[] {
  const out: CaptionChunk[] = [];
  let t = 0;
  let index = 1;
  for (const scene of script.scenes) {
    const lines = scene.vo;
    const lineDur = lines.length ? scene.duration / lines.length : scene.duration;
    lines.forEach((text, i) => {
      const start = t + i * lineDur;
      out.push({ index: index++, start, end: Math.min(t + scene.duration, start + lineDur), text, sceneId: scene.id });
    });
    t += scene.duration;
  }
  return out;
}

function srtTime(sec: number): string {
  const ms = Math.floor((sec % 1) * 1000);
  const s = Math.floor(sec) % 60;
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function vttTime(sec: number): string {
  const ms = Math.floor((sec % 1) * 1000);
  const s = Math.floor(sec) % 60;
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function formatSrt(chunks: CaptionChunk[]): string {
  return chunks
    .map((c) => `${c.index}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}`)
    .join("\n\n");
}

export function formatVtt(chunks: CaptionChunk[]): string {
  const body = chunks.map((c) => `${c.index}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}`).join("\n\n");
  return `WEBVTT\n\n${body}`;
}

export function sceneAt(script: VideoScript, time: number): { scene: VideoScene | null; index: number } {
  let t = 0;
  for (let i = 0; i < script.scenes.length; i++) {
    const sc = script.scenes[i];
    if (time < t + sc.duration) return { scene: sc, index: i };
    t += sc.duration;
  }
  return { scene: script.scenes[script.scenes.length - 1] ?? null, index: script.scenes.length - 1 };
}

export function sceneStart(script: VideoScript, index: number): number {
  return script.scenes.slice(0, index).reduce((s, x) => s + x.duration, 0);
}

/** Video Brief for Runway / Sora / Pika — paste into any LLM video tool. */
export function buildVideoBrief(job: AuditJobResponse, script: VideoScript): string {
  const audit = job.audit;
  if (!audit) return "";
  const name = `${job.owner}/${job.repo}`;
  const L: string[] = [];
  L.push(`# VIDEO BRIEF — ${script.title}`);
  L.push("");
  L.push(`**Target tools:** Runway Gen-3 · Sora · Pika · Kling`);
  L.push(`**Aspect / Quality:** 16:9 · 4K 3840×2160 (PRO) or 1080p`);
  L.push(`**Duration:** ~${Math.round(script.totalDuration)}s (5 acts)`);
  L.push("");
  L.push(`## Style`);
  L.push(`Cinematic tech keynote. Dark UI surfaces (#0b0c10) with violet #6c5ce7 and cyan #00cec9 accents. Slow Ken Burns pushes, parallax layers, neon grading, film grain 4%, shallow depth of field. Motion design language: smooth gauge rings, count-up numbers, flowing mermaid-style diagrams, diff-scroll code panels, commit-graph lines drawing on.`);
  L.push("");
  L.push(`## Voice`);
  L.push(`Authoritative, inspiring, fast-paced keynote narrator. Confident but warm. Rate: measured. Music: minimal analog synth pad, sidechained to VO. SFX: soft whoosh on gauge spin, coin-drop tick on count-ups, subtle success chime when the score hits 100.`);
  L.push("");
  L.push(`## Scenes`);
  let t = 0;
  script.scenes.forEach((sc, i) => {
    const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    L.push(`### Scene ${i + 1} — ${sc.actLabel} · ${fmt(t)}–${fmt(t + sc.duration)}`);
    L.push(`- **Visual (${sc.visual}):** ${sc.goal}`);
    L.push(`- **On-screen:** ${sc.onScreen.join(" · ")}`);
    L.push(`- **VO:** ${sc.vo.join(" ")}`);
    L.push("");
    t += sc.duration;
  });
  L.push(`## Montage beat (0:00–0:10)`);
  L.push(`0:00–0:03 — black screen, single violet ring draws in; 0:03–0:07 — gauge spins up to ${audit.score}, whoosh, number count-up lands hard; 0:07–0:10 — quick-cut flash of failing checks then cut to black. Cut to Act I title.`);
  L.push("");
  L.push(`## Negative prompt`);
  L.push(`no watermark, no logos other than repo name, no stock-photo handshakes, no cheesy lens flares, no text artifacts, no warped letters, no extra fingers, no jumpscares, no over-saturated colors, no vertical format`);
  return L.join("\n");
}

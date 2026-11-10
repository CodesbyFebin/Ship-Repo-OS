// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Full Repo Auditor contract (client ⇄ server)
// "Every missing point gets a ranked fix with full copy-paste code."
// ─────────────────────────────────────────────────────────────────────────────

export type RepoAuditTier = "Needs Work" | "Bronze" | "Silver" | "Gold" | "Platinum";

export function repoTier(score: number): RepoAuditTier {
  if (score >= 95) return "Platinum";
  if (score >= 85) return "Gold";
  if (score >= 70) return "Silver";
  if (score >= 50) return "Bronze";
  return "Needs Work";
}

/** Grading system: S (95+), A (85+), B (70+), C (50+), D (35+), F. */
export type AuditGrade = "S" | "A" | "B" | "C" | "D" | "F";

export function gradeFor(score: number): AuditGrade {
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

/** Human percentile band for a score (heuristic, deterministic). */
export function percentileFor(score: number): string {
  if (score >= 95) return "Top 1%";
  if (score >= 90) return "Top 3%";
  if (score >= 85) return "Top 5%";
  if (score >= 80) return "Top 10%";
  if (score >= 70) return "Top 25%";
  if (score >= 60) return "Top 40%";
  if (score >= 50) return "Average";
  return "Below average";
}

/** Strictness modes shift thresholds, never the rubric itself. */
export type Strictness = "lenient" | "balanced" | "strict";

export const DEFAULT_STRICTNESS: Strictness = "balanced";

export const STRICTNESS_LABELS: Record<Strictness, string> = {
  lenient: "Lenient — friendly thresholds",
  balanced: "Balanced — recommended defaults",
  strict: "Strict — production-grade bar",
};

export type RiskSeverity = "critical" | "high" | "medium" | "low";

/** A concrete security/quality risk surfaced by failed checks. */
export interface AuditRisk {
  id: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  checkId: string;
}

export const RISK_SEVERITY_ORDER: Record<RiskSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type FixPriority = "critical" | "high" | "medium" | "low";

/** One file the fix writes, with full copy-paste-ready content. */
export interface FixFile {
  path: string; // e.g. ".github/workflows/ci.yml"
  language: string; // syntax hint for the code block
  content: string; // FULL file content
  /** Derived by the engine from the repo tree; guides are stamped by builders. */
  status?: "NEW" | "UPDATED" | "GUIDE";
  note?: string; // optional one-liner shown above the code
}

/** A ranked, actionable fix — possibly resolving several failed checks at once. */
export interface CodeFix {
  id: string;
  rank: number;
  title: string;
  checkIds: string[]; // failed checks this fix resolves
  points: number; // total points recovered
  priority: FixPriority;
  effort: string; // "2 min" | "5 min" | "10 min"
  why: string; // 1-2 sentences of motivation
  docsUrl?: string; // official guide link
  files: FixFile[];
  /** Manual guidance when no template can be generated for this fix. */
  manualSteps?: string[];
}

/** One measurable repo check with a point weight. */
export interface RepoAuditCheck {
  id: string;
  label: string;
  weight: number;
  pass: boolean;
  detail: string;
  /** True when the check does not apply to this stack (auto-pass, "n/a"). */
  na?: boolean;
}

/** A weighted category of checks — the five categories sum to exactly 100. */
export interface RepoAuditCategory {
  id: string;
  name: string;
  icon: string; // lucide icon name, mapped in the UI
  score: number;
  max: number;
  checks: RepoAuditCheck[];
}

export interface RepoAuditStats {
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  pointsAtStake: number;
  fixFiles: string[]; // unique real files across all fixes (guides excluded)
  minutesTotal: number; // sum of fix effort, for the time-saved calculator
}

export interface RoadmapStep {
  rank: number;
  fixId: string;
  title: string;
  points: number;
  effort: string;
  quickWin: boolean; // effort ≤ 5 min
  cumulative: number; // projected score after applying fixes #1..#rank
}

/** Deterministic 100-point full-repo audit result. */
export interface RepoAudit {
  score: number;
  grade: AuditGrade;
  tier: RepoAuditTier;
  percentile: string;
  strictness: Strictness;
  categories: RepoAuditCategory[];
  risks: AuditRisk[];
  fixes: CodeFix[];
  roadmap: RoadmapStep[];
  stats: RepoAuditStats;
}

/** Slim repo facts surfaced in the report header. */
export interface AuditRepoMeta {
  description: string;
  language: string;
  languages: { name: string; pct: number }[];
  stars: number;
  forks: number;
  license: string | null;
  topics: string[];
  hasTests: boolean;
  ciWorkflows: string[];
  packageManager: string | null;
  homepage: string | null;
  commitCount: number | null;
  releaseCount: number | null;
}

export type AuditStage = "queued" | "ingesting" | "scanning" | "scoring" | "composing" | "done";
export type AuditStatus = "processing" | "ready" | "error";

export type AuditSource = "github" | "file-list";

/** GET /api/audit/[id] response. */
export interface AuditJobResponse {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  status: AuditStatus;
  stage: AuditStage;
  source: AuditSource;
  strictness: Strictness;
  error: string | null;
  score: number;
  fixesCount: number;
  checksFailed: number;
  audit: RepoAudit | null;
  repoMeta: AuditRepoMeta | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/audit response item. */
export interface AuditJobListItem {
  id: string;
  owner: string;
  repo: string;
  repoUrl: string;
  status: AuditStatus;
  stage: AuditStage;
  score: number;
  fixesCount: number;
  checksFailed: number;
  createdAt: string;
}

export const FIX_PRIORITY_ORDER: Record<FixPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Parse "2 min" / "10 min" effort strings into minutes. */
export function effortMinutes(effort: string): number {
  const m = effort.match(/(\d+)\s*min/i);
  return m ? Number(m[1]) : 10;
}

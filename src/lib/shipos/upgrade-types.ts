// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Upgrader contract (client ⇄ server)
// "Check your score. Fix every gap. Ship the 100/100 README."
// ─────────────────────────────────────────────────────────────────────────────

/** One measurable README check with a point weight and fix guidance. */
export interface AuditCheck {
  id: string;
  label: string;
  weight: number;
  pass: boolean;
  detail: string;
  guidance: string;
}

/** A weighted category of checks (Docs, Tests, Badges, …) summing with others to 100. */
export interface AuditCategory {
  id: string;
  name: string;
  icon: string; // lucide icon name, mapped in the UI
  score: number;
  max: number;
  checks: AuditCheck[];
}

export interface ReadmeStats {
  words: number;
  h2Count: number;
  badgeCount: number;
  links: number;
  codeBlocks: number;
  images: number;
  chars: number;
}

export type AuditTier = "Bronze" | "Silver" | "Gold" | "Platinum";

/** Deterministic 100-point README audit result. */
export interface ReadmeAudit {
  score: number;
  tier: AuditTier;
  hasReadme: boolean;
  categories: AuditCategory[];
  stats: ReadmeStats;
  passedCount: number;
  failedCount: number;
}

/** How a failed before-check was fixed in the upgraded README. */
export interface AppliedFix {
  checkId: string;
  label: string;
  category: string;
  guidance: string;
  section: string;
  fixed: boolean;
}

/** Slim repo facts surfaced in the report header. */
export interface RepoMeta {
  description: string;
  language: string;
  frameworks: string[];
  license: string | null;
  stars: number;
  forks: number;
  commitCount: number | null;
  hasTests: boolean;
  ciWorkflows: string[];
  packageManager: string | null;
  homepage: string | null;
  topics: string[];
}

export type UpgradeStage =
  | "queued"
  | "ingesting"
  | "scoring"
  | "upgrading"
  | "auditing"
  | "done";

export type UpgradeStatus = "processing" | "ready" | "error";

/** GET /api/upgrade/[id] response. */
export interface UpgradeJobResponse {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  status: UpgradeStatus;
  stage: UpgradeStage;
  error: string | null;
  hadReadme: boolean;
  beforeScore: number;
  afterScore: number;
  wordCountBefore: number;
  wordCountAfter: number;
  before: ReadmeAudit | null;
  after: ReadmeAudit | null;
  fixes: AppliedFix[];
  originalReadme: string | null;
  upgradedReadme: string | null;
  repoMeta: RepoMeta | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/upgrade response item. */
export interface UpgradeJobListItem {
  id: string;
  owner: string;
  repo: string;
  repoUrl: string;
  status: UpgradeStatus;
  stage: UpgradeStage;
  beforeScore: number;
  afterScore: number;
  hadReadme: boolean;
  createdAt: string;
}

export function auditTier(score: number): AuditTier {
  if (score >= 90) return "Platinum";
  if (score >= 70) return "Gold";
  if (score >= 50) return "Silver";
  return "Bronze";
}

// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Shared contract between ingestion, provenance, generators and UI
// "The README is the Source of Truth."
// ─────────────────────────────────────────────────────────────────────────────

export type ClaimStatus = "VERIFIED" | "PARTIAL" | "REJECTED";

export type CommitType =
  | "feat"
  | "fix"
  | "chore"
  | "docs"
  | "refactor"
  | "test"
  | "style"
  | "perf"
  | "ci"
  | "other";

export interface RepoCommit {
  sha: string;
  message: string;
  type: CommitType;
  author: string;
  date: string; // ISO
}

export interface DetectedStack {
  language: string;
  languages: { name: string; pct: number }[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  packageManager: string | null;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface RepoManifest {
  name: string | null;
  version: string | null;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  // Optional richer metadata (package.json only) — used by the Full Repo Auditor
  description?: string | null;
  keywords?: string[];
  licenseField?: string | null;
  author?: string | null;
  repository?: string | null;
  bugs?: string | null;
  homepage?: string | null;
  type?: string | null;
}

export interface RepoData {
  owner: string;
  repo: string;
  url: string;
  description: string;
  topics: string[];
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number | null;
  license: { spdx: string; name: string } | null;
  defaultBranch: string;
  createdAt: string | null;
  pushedAt: string | null;
  commitCount: number | null;
  releaseCount: number | null;
  homepage: string | null;
  commits: RepoCommit[];
  contributors: { login: string; count: number }[];
  rootFiles: string[];
  /** Names of files/directories inside .github/ (workflows, templates, dependabot…) */
  githubFiles: string[];
  ciWorkflows: string[];
  hasTests: boolean;
  readme: string | null;
  readmeTruncated: boolean;
  manifest: RepoManifest | null;
  envExample: { file: string; vars: { name: string; comment: string }[] } | null;
  detected: DetectedStack;
  source: "github-api" | "web-scrape";
  ingestedAt: string;
  /** True for offline file-list audits — GitHub-only checks auto-pass as "n/a". */
  offline?: boolean;
  /** tsconfig.json content when the pipeline probed it (type-strictness check). */
  tsconfigRaw?: string | null;
}

export interface ClaimEntry {
  id: string;
  claim: string;
  category: "tech" | "feature" | "traction" | "quality" | "community" | "other";
  status: ClaimStatus;
  confidence: number; // 0..1
  evidence: string; // human-readable receipt, e.g. `package.json · commit a1b2c3d`
  commitSha: string | null;
  filePath: string | null;
  reason: string;
}

export interface ClaimLedger {
  claims: ClaimEntry[];
  summary: { total: number; verified: number; partial: number; rejected: number };
  generatedAt: string;
}

export interface DemoScene {
  index: number;
  title: string;
  phase: "Hook" | "Chaos" | "Reveal" | "Proof" | "CTA";
  startSec: number;
  endSec: number;
  narration: string;
  visual: string;
  words: number;
}

export interface DemoScript {
  preset: string;
  durationSec: number;
  wpm: number;
  wordBudget: number;
  wordsUsed: number;
  scenes: DemoScene[];
  missing: string[];
}

export interface DeckSlide {
  index: number;
  title: string;
  bullets: string[];
  notes: string;
}

export interface Deck {
  slides: DeckSlide[];
  markdown: string;
  speakerNotes: string;
}

export interface ScoreCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface ReadmeFeature {
  id: number;
  name: string;
  category: string;
  present: boolean;
}

export interface ScorePillar {
  name: string;
  score: number;
  max: number;
  detail: string;
}

export interface Scores {
  seo: { score: number; checks: ScoreCheck[] };
  readme: {
    score: number;
    tier: "Bronze" | "Silver" | "Gold" | "Platinum";
    features: ReadmeFeature[];
  };
  health: { score: number; pillars: ScorePillar[]; fixes: string[] };
}

export interface HeroSpec {
  gradient: string; // preset id
  pattern: string;
  layout: string;
  html: string; // GitHub-safe HTML block
}

export interface Gate {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface Artifacts {
  hero: HeroSpec;
  badges: { markdown: string; count: number; categories: string[] };
  mermaid: string;
  readme: string;
  envTable: string | null;
  structureTree: string;
  changelog: string;
  demoScript: DemoScript;
  storyboardJson: string;
  deck: Deck;
  report: string;
  vivaPrep: string;
  checklist: { gates: Gate[]; markdown: string };
  distTree: string;
}

export interface Narrative {
  tagline: string;
  problem: string;
  solution: string;
  features: { title: string; description: string; evidenceHint: string }[];
  roadmap: string[];
  faqs: { q: string; a: string }[];
  keywords: string[];
  claims: {
    claim: string;
    category: ClaimEntry["category"];
    evidenceHint: string;
  }[];
  missing: string[];
}

/** Full pipeline result persisted in the DB */
export interface ShipResult {
  repo: RepoData;
  ledger: ClaimLedger;
  artifacts: Artifacts;
  scores: Scores;
  narrative: Narrative | null;
}

/** GET /api/projects/[id] response */
export interface ProjectResponse {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  preset: string;
  status: "processing" | "ready" | "error";
  stage: "queued" | "ingesting" | "verifying" | "generating" | "scoring" | "done";
  error: string | null;
  wordCount: number;
  verifiedCount: number;
  rejectedCount: number;
  createdAt: string;
  updatedAt: string;
  data: ShipResult | null;
}

/** GET /api/projects response */
export interface ProjectListItem {
  id: string;
  owner: string;
  repo: string;
  repoUrl: string;
  preset: string;
  status: string;
  stage: string;
  stars: number;
  verifiedCount: number;
  rejectedCount: number;
  wordCount: number;
  createdAt: string;
}

export function scoreTier(score: number): "Bronze" | "Silver" | "Gold" | "Platinum" {
  if (score >= 90) return "Platinum";
  if (score >= 70) return "Gold";
  if (score >= 50) return "Silver";
  return "Bronze";
}

// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Full Repo Optimization Engine contract (client ⇄ server).
// Three visibility rings — Search SEO · Answer Engines (AEO) · Generative
// Engines (GEO) — each scored 0–100 from the observed repository.
// The pack = 4 headline assets (description · topics · agents.txt · llms.txt)
// + 50 other optimizations = 54 catalog items in optimize-catalog.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";

export type OptimizeDimension = "seo" | "aeo" | "geo";

export type OptimizationCategory =
  | "seo"
  | "aeo"
  | "geo"
  | "discoverability"
  | "trust"
  | "launch";

export const OPTIMIZE_CATEGORY_LABELS: Record<OptimizationCategory, string> = {
  seo: "Search SEO",
  aeo: "Answer Engines",
  geo: "Generative Engines",
  discoverability: "Discoverability",
  trust: "Trust & Signals",
  launch: "Launch Copy",
};

/** Keys into the generated artifact pack — items tagged with an artifact are
 *  satisfied by copying a card from the pack (the 4 headline assets + extras). */
export type ArtifactKey =
  | "description"
  | "topics"
  | "keywords"
  | "metaTitle"
  | "metaDescription"
  | "quickAnswer"
  | "agentsTxt"
  | "llmsTxt"
  | "llmsFullTxt"
  | "faq"
  | "jsonLd"
  | "robotsAiTxt"
  | "aboutPara"
  | "comparison"
  | "social";

export const ARTIFACT_LABELS: Record<ArtifactKey, string> = {
  description: "Repo description",
  topics: "GitHub topics",
  keywords: "Search keywords",
  metaTitle: "Meta title",
  metaDescription: "Meta description",
  quickAnswer: "Quick answer block",
  agentsTxt: "agents.txt",
  llmsTxt: "llms.txt",
  llmsFullTxt: "llms-full.txt",
  faq: "FAQ.md",
  jsonLd: "JSON-LD schema",
  robotsAiTxt: "robots.txt (AI rules)",
  aboutPara: "Quotable About block",
  comparison: "Comparison table",
  social: "Launch copy pack",
};

/** What the detector saw in the repo before optimization. */
export interface ItemSignal {
  pass: boolean;
  detail: string;
}

export interface CatalogItem {
  id: string;
  category: OptimizationCategory;
  /** Which 0-100 ring this item counts toward. */
  dimension: OptimizeDimension;
  title: string;
  /** Why the engine (Google / Perplexity / ChatGPT / …) rewards it. */
  why: string;
  /** What the pack or a one-paste fix provides. */
  applies: string;
  /** Set when the generated pack satisfies this item outright. */
  artifact?: ArtifactKey;
}

// ── Generated pack (LLM output, zod-validated; template fallback exists) ────

export const SocialPackSchema = z.object({
  x: z.string(),
  linkedin: z.string(),
  hn: z.string(),
  reddit: z.string(),
  productHunt: z.string(),
  devto: z.string(),
});

/** Call 1 — short copy (kept small so the response never truncates). */
export const CopyPackSchema = z.object({
  description: z.string().min(10).max(400),
  topics: z.array(z.string()).min(8).max(24),
  keywords: z.array(z.string()).min(4).max(16),
  metaTitle: z.string().min(6).max(90),
  metaDescription: z.string().min(50).max(220),
  quickAnswer: z.string().min(60).max(1200),
  aboutPara: z.string().min(60).max(1200),
  faq: z.array(z.object({ q: z.string().min(5), a: z.string().min(20) })).min(3).max(10),
  comparison: z.object({
    headers: z.array(z.string()).min(3).max(6),
    rows: z.array(z.array(z.string())).min(3).max(8),
  }),
  social: SocialPackSchema,
});

/** Call 2 — the machine files. */
export const FilePackSchema = z.object({
  agentsTxt: z.string().min(100),
  llmsTxt: z.string().min(100),
  llmsFullTxt: z.string().min(100),
  robotsAiTxt: z.string().min(40),
  jsonLd: z.record(z.string(), z.unknown()),
});

export const PackSchema = z.object({
  /** Repo description — ≤350 chars, front-loads the primary keyword. */
  description: z.string().min(10).max(350),
  /** 15-20 GitHub topics, lowercase-hyphen. */
  topics: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).min(10).max(20),
  keywords: z.array(z.string()).min(6).max(14),
  metaTitle: z.string().min(10).max(70),
  metaDescription: z.string().min(50).max(160),
  /** 40-70 word direct answer to "What is <project>?" */
  quickAnswer: z.string().min(60).max(900),
  agentsTxt: z.string().min(100),
  llmsTxt: z.string().min(100),
  llmsFullTxt: z.string().min(100),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).min(4).max(8),
  jsonLd: z.record(z.string(), z.unknown()),
  robotsAiTxt: z.string().min(40),
  /** 40-90 word quotable About paragraph containing at least one number. */
  aboutPara: z.string().min(80).max(900),
  comparison: z.object({
    headers: z.array(z.string()).min(3).max(5),
    rows: z.array(z.array(z.string())).min(3).max(6),
  }),
  social: SocialPackSchema,
});
export type OptimizationPack = z.infer<typeof PackSchema>;

// ── API shapes ───────────────────────────────────────────────────────────────

export interface DimensionBreakdown {
  seo: number;
  aeo: number;
  geo: number;
}

export interface ChecklistEntry {
  item: CatalogItem;
  before: ItemSignal;
  /** The observed pass remains unchanged until a new repository scan. */
  after: ItemSignal;
}

export function optimizationGuidance(item: CatalogItem, before: ItemSignal): ItemSignal {
  if (before.pass) return { pass: true, detail: "Observed in the scanned repository." };
  const guidance = item.artifact ? `Review and apply the ${ARTIFACT_LABELS[item.artifact]} draft. ` : "";
  return { pass: false, detail: `${guidance}${item.applies}` };
}

export interface OptimizeJobListItem {
  id: string;
  owner: string;
  repo: string;
  repoUrl: string;
  status: string;
  stage: string;
  packSource: string;
  createdAt: string;
}

export interface OptimizeJobResponse {
  id: string;
  owner: string;
  repo: string;
  repoUrl: string;
  status: "processing" | "ready" | "error";
  stage: "queued" | "ingesting" | "scoring" | "generating" | "auditing" | "done";
  error: string | null;
  packSource: "llm" | "fallback";
  before: DimensionBreakdown | null;
  after: DimensionBreakdown | null;
  checklist: ChecklistEntry[] | null;
  artifacts: OptimizationPack | null;
  repoMeta: {
    description: string;
    topics: string[];
    stars: number;
    forks: number;
    license: string | null;
    language: string | null;
    homepage: string | null;
    pushedAt: string | null;
  } | null;
  createdAt: string;
}

/** Convert RepoData-ish metadata into the UI snapshot. */
export function repoMetaSnapshot(meta: {
  description?: string;
  topics?: string[];
  stars?: number;
  forks?: number;
  license?: { spdx: string; name: string } | null;
  homepage?: string | null;
  pushedAt?: string | null;
  detected?: { language?: string };
}): OptimizeJobResponse["repoMeta"] {
  return {
    description: meta.description ?? "",
    topics: meta.topics ?? [],
    stars: meta.stars ?? 0,
    forks: meta.forks ?? 0,
    license: meta.license?.spdx ?? null,
    language: meta.detected?.language ?? null,
    homepage: meta.homepage ?? null,
    pushedAt: meta.pushedAt ?? null,
  };
}

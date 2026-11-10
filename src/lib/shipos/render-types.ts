// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Render Cloud stage machine (Path B: HF Spaces ZeroGPU worker model).
// One source of truth for the API (server) and the dashboard (client): the job
// pipeline is a pure function of elapsed time, so any poller computes the same
// stage/progress without a background worker process.
//
// GPU budget model (free tier, per UTC day):
//   300s quota · 26s GPU per video (Kokoro VO 8s + SDXL banners 5s + Whisper 13s)
//   → ~9 fully-rendered videos/day. Remotion + ffmpeg run on CPU: unlimited.
// ─────────────────────────────────────────────────────────────────────────────

export const GPU_QUOTA_PER_DAY = 300;
export const GPU_SECONDS_PER_JOB = 26;
export const RENDER_TOTAL_SECONDS = 66;

export type RenderStageId =
  | "queued"
  | "ingesting"
  | "verifying"
  | "tts"
  | "banners"
  | "captions"
  | "rendering"
  | "muxing"
  | "bundling"
  | "done";

export interface RenderStage {
  id: RenderStageId;
  label: string;
  /** seconds into the job when this stage begins */
  at: number;
  /** GPU seconds consumed when this stage completes (cumulative) */
  gpu: number;
  detail: string;
  kind: "gpu" | "cpu" | "wait";
}

export const RENDER_STAGES: RenderStage[] = [
  { id: "queued", label: "Queued", at: 0, gpu: 0, detail: "waiting for a free GPU window", kind: "wait" },
  { id: "ingesting", label: "Ingesting", at: 5, gpu: 0, detail: "repo metadata + scene schema", kind: "cpu" },
  { id: "verifying", label: "Verifying", at: 15, gpu: 0, detail: "schema → Remotion composition", kind: "cpu" },
  { id: "tts", label: "Voiceover", at: 23, gpu: 8, detail: "Kokoro TTS burst · 8s GPU", kind: "gpu" },
  { id: "banners", label: "Banners", at: 33, gpu: 13, detail: "SDXL act banners · 5s GPU", kind: "gpu" },
  { id: "captions", label: "Captions", at: 41, gpu: 26, detail: "Whisper alignment · 13s GPU", kind: "gpu" },
  { id: "rendering", label: "Rendering", at: 49, gpu: 26, detail: "Remotion CPU render · free, unlimited", kind: "cpu" },
  { id: "muxing", label: "Muxing", at: 58, gpu: 26, detail: "ffmpeg mux + burn-in · free", kind: "cpu" },
  { id: "bundling", label: "Bundling", at: 63, gpu: 26, detail: "zip + delivery", kind: "cpu" },
  { id: "done", label: "Complete", at: RENDER_TOTAL_SECONDS, gpu: GPU_SECONDS_PER_JOB, detail: "bundle ready to download", kind: "cpu" },
];

export interface StageState {
  stage: RenderStageId;
  stageIndex: number;
  /** 0-100 overall job progress */
  progress: number;
  /** GPU seconds burned so far */
  gpuSoFar: number;
  /** seconds remaining until the bundle is ready (when not held) */
  eta: number;
}

const STAGE_SPANS = RENDER_STAGES.map((s, i) => {
  const next = RENDER_STAGES[i + 1];
  return { ...s, end: next ? next.at : RENDER_TOTAL_SECONDS + 2, index: i };
});

/** Pure pipeline: elapsed seconds → current stage / progress / gpu / eta. */
export function stageAt(elapsedSeconds: number): StageState {
  const t = Math.max(0, elapsedSeconds);
  if (t >= RENDER_TOTAL_SECONDS) {
    return { stage: "done", stageIndex: STAGE_SPANS.length - 1, progress: 100, gpuSoFar: GPU_SECONDS_PER_JOB, eta: 0 };
  }
  const span = STAGE_SPANS.find((s) => t >= s.at && t < s.end) ?? STAGE_SPANS[0];
  const spanPct = span.end > span.at ? (t - span.at) / (span.end - span.at) : 1;
  const progress = Math.min(99, Math.round(((span.index + spanPct) / STAGE_SPANS.length) * 100));
  return {
    stage: span.id,
    stageIndex: span.index,
    progress,
    gpuSoFar: span.gpu,
    eta: Math.max(0, Math.ceil(RENDER_TOTAL_SECONDS - t)),
  };
}

/** UTC date key for the quota ledger. */
export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Seconds until the daily quota resets (next UTC midnight). */
export function secondsUntilUtcReset(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return Math.max(0, Math.round((next - now.getTime()) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Response shape for the quota dashboard (GET /api/render). */
export interface QuotaSnapshot {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  resetsIn: number;
  /** jobs still pending right now */
  queueLength: number;
  /** videos completed today */
  renderedToday: number;
  /** true when remaining < GPU_SECONDS_PER_JOB — new jobs park until reset */
  exhausted: boolean;
}

/** GET /api/render job item (list view). */
export interface RenderJobListItem {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  preset: string;
  resolution: string;
  voice: string;
  status: string;
  stage: string;
  progress: number;
  gpuSeconds: number;
  etaSeconds: number;
  quotaHeld: boolean;
  createdAt: string;
  completedAt: string | null;
}

/** GET /api/render/[id] response. */
export interface RenderJobDetail extends RenderJobListItem {
  auditJobId: string | null;
  stageIndex: number;
  stages: { id: RenderStageId; label: string; detail: string; kind: string; state: "done" | "active" | "todo" }[];
  queuePosition: number;
}

export const RENDER_PRESETS = ["meta-hackathon", "yc-pitch", "academic", "product-launch"] as const;
export const RENDER_VOICES = ["calm", "energetic", "authoritative"] as const;

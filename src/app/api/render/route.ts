// ─────────────────────────────────────────────────────────────────────────────
// ShipOS Render Cloud — queue dashboard + job submission (Path B).
//   GET  /api/render        → quota snapshot + recent jobs
//   POST /api/render        → submit { repoUrl, auditId?, preset, resolution, voice, scriptJson? }
// The render "worker" is a pure stage machine over elapsed time (render-types),
// so any poller sees identical progress without a background process. GPU
// seconds are metered per UTC day against the 300s free ZeroGPU budget.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildVideoScript, type VideoScript } from "@/lib/shipos/story-engine";
import {
  GPU_QUOTA_PER_DAY,
  GPU_SECONDS_PER_JOB,
  RENDER_PRESETS,
  RENDER_STAGES,
  RENDER_VOICES,
  RENDER_TOTAL_SECONDS,
  secondsUntilUtcReset,
  stageAt,
  todayUtc,
  type QuotaSnapshot,
  type RenderJobListItem,
} from "@/lib/shipos/render-types";
import type { AuditJobResponse, AuditRepoMeta, RepoAudit } from "@/lib/shipos/audit-types";
import { advanceActiveJobs } from "@/lib/shipos/render-worker";

export const runtime = "nodejs";

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function quotaSnapshot(): Promise<QuotaSnapshot> {
  const today = todayUtc();
  const [row, queueLength, renderedToday] = await Promise.all([
    db.gpuQuota.findUnique({ where: { date: today } }),
    db.renderJob.count({ where: { status: { in: ["queued", "rendering"] } } }),
    db.renderJob.count({ where: { status: "done", completedAt: { gte: new Date(`${today}T00:00:00.000Z`) } } }),
  ]);
  const used = row?.secondsUsed ?? 0;
  const remaining = Math.max(0, GPU_QUOTA_PER_DAY - used);
  return {
    date: today,
    used,
    limit: GPU_QUOTA_PER_DAY,
    remaining,
    resetsIn: secondsUntilUtcReset(),
    queueLength,
    renderedToday,
    exhausted: remaining < GPU_SECONDS_PER_JOB,
  };
}

export async function GET() {
  // Advance every active job first so stage/progress/quota persist exactly
  // once regardless of which endpoint observes the transition.
  await advanceActiveJobs();

  const [quota, jobs] = await Promise.all([
    quotaSnapshot(),
    db.renderJob.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const items: RenderJobListItem[] = jobs.map((j) => {
    const elapsed = (Date.now() - j.createdAt.getTime()) / 1000;
    const live = j.status === "queued" || j.status === "rendering" ? stageAt(elapsed) : null;
    const isDone = j.status === "done";
    return {
      id: j.id,
      repoUrl: j.repoUrl,
      owner: j.owner,
      repo: j.repo,
      preset: j.preset,
      resolution: j.resolution,
      voice: j.voice,
      status: j.status,
      stage: j.quotaHeld && j.status === "queued" ? "queued" : (live?.stage ?? (isDone ? "done" : j.stage)),
      progress: live ? live.progress : isDone ? 100 : j.progress,
      gpuSeconds: live ? live.gpuSoFar : j.gpuSeconds,
      etaSeconds: live ? live.eta : 0,
      quotaHeld: j.quotaHeld,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ ok: true, quota, jobs: items, stages: RENDER_STAGES });
}

export async function POST(req: Request) {
  let body: {
    repoUrl?: string;
    auditId?: string;
    preset?: string;
    resolution?: string;
    voice?: string;
    scriptJson?: VideoScript;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = (body.repoUrl ?? "").trim();
  if (!repoUrl) {
    return NextResponse.json({ ok: false, error: "Repository URL is required — run an audit first, the Render Cloud renders the story from the audit." }, { status: 400 });
  }

  const preset = RENDER_PRESETS.includes((body.preset ?? "") as (typeof RENDER_PRESETS)[number]) ? body.preset! : "meta-hackathon";
  const voice = RENDER_VOICES.includes((body.voice ?? "") as (typeof RENDER_VOICES)[number]) ? body.voice! : "authoritative";
  const resolution = body.resolution === "4k" ? "4k" : "1080p";

  // 4K is a PRO capability — checked against the server license record.
  if (resolution === "4k") {
    const pro = await db.proState.findUnique({ where: { id: "main" } });
    const active = pro?.tier === "PRO" || pro?.tier === "TEAM";
    if (!active) {
      return NextResponse.json(
        { ok: false, error: "4K rendering is a PRO capability. Upgrade to unlock 3840×2160." },
        { status: 402 }
      );
    }
  }

  // Resolve the audit this render tells the story of.
  const candidates = await db.auditJob.findMany({
    where: body.auditId ? { id: body.auditId } : { repoUrl },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const auditJob = candidates.find((j) => j.status === "ready" && j.auditJson);
  if (!auditJob) {
    return NextResponse.json(
      { ok: false, error: "No ready audit found for this repo. Run the Full Repo Auditor first — the video renders the audit's story." },
      { status: 400 }
    );
  }

  const audit = parse<RepoAudit | null>(auditJob.auditJson, null);
  const repoMeta = parse<AuditRepoMeta | null>(auditJob.repoMetaJson, null);
  const jobResp: AuditJobResponse = {
    id: auditJob.id,
    repoUrl: auditJob.repoUrl,
    owner: auditJob.owner,
    repo: auditJob.repo,
    status: "ready",
    stage: "done",
    source: "github",
    strictness: "balanced",
    error: null,
    score: auditJob.score,
    fixesCount: auditJob.fixesCount,
    checksFailed: auditJob.checksFailed,
    audit,
    repoMeta,
    createdAt: auditJob.createdAt.toISOString(),
    updatedAt: auditJob.updatedAt.toISOString(),
  };

  // Snapshot the script: client-edited schema wins, deterministic otherwise.
  let script: VideoScript;
  if (body.scriptJson && Array.isArray(body.scriptJson.scenes) && body.scriptJson.scenes.length > 0) {
    script = body.scriptJson;
  } else {
    script = buildVideoScript(jobResp);
  }

  const quota = await quotaSnapshot();
  const job = await db.renderJob.create({
    data: {
      auditJobId: auditJob.id,
      repoUrl: auditJob.repoUrl,
      owner: auditJob.owner,
      repo: auditJob.repo,
      preset,
      resolution,
      voice,
      status: "rendering",
      stage: "queued",
      etaSeconds: RENDER_TOTAL_SECONDS,
      quotaHeld: quota.exhausted,
      scriptJson: JSON.stringify(script),
      auditJson: auditJob.auditJson,
      metaJson: auditJob.repoMetaJson,
    },
  });

  return NextResponse.json({
    ok: true,
    id: job.id,
    quotaHeld: quota.exhausted,
    message: quota.exhausted
      ? `Job ${job.id} queued — GPU budget is exhausted today (${quota.used}s/${quota.limit}s used). Renders resume at the next reset.`
      : `Job ${job.id} accepted — ${GPU_SECONDS_PER_JOB}s GPU budgeted, ~${RENDER_TOTAL_SECONDS}s pipeline.`,
    quota,
  });
}

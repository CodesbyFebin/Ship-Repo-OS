// ─────────────────────────────────────────────────────────────────────────────
// ShipOS Render Cloud — job detail.
//   GET  /api/render/[id]              → live stage machine state + queue position
//   GET  /api/render/[id]?download=zip → the full submission bundle (jszip)
//   DELETE /api/render/[id]            → cancel a job that hasn't finished
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import JSZip from "jszip";
import { db } from "@/lib/db";
import {
  buildLandingHtml,
  buildSlides,
  buildSlidesMarkdown,
  buildVideoBrief,
  formatSrt,
  scriptCaptions,
  type VideoScript,
} from "@/lib/shipos/story-engine";
import { RENDER_STAGES, stageAt } from "@/lib/shipos/render-types";
import { advanceJob } from "@/lib/shipos/render-worker";
import type { AuditJobResponse, AuditRepoMeta, RepoAudit } from "@/lib/shipos/audit-types";
import { buildBundleReadme, buildHfSpaceFiles, buildStandalonePlayerHtml, type BundleMeta } from "@/lib/shipos/hf-bundle";

export const runtime = "nodejs";
export const maxDuration = 60;

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function loadJob(id: string) {
  return db.renderJob.findUnique({ where: { id } });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);

  let job = await loadJob(id);
  if (!job) return NextResponse.json({ ok: false, error: "Render job not found" }, { status: 404 });
  job = await advanceJob(job);

  const script = parse<VideoScript | null>(job.scriptJson, null);

  // ── Bundle download ────────────────────────────────────────────────────────
  if (url.searchParams.get("download") === "zip") {
    if (job.status !== "done") {
      return NextResponse.json({ ok: false, error: "Job is not complete yet — the bundle appears when the pipeline finishes." }, { status: 409 });
    }
    if (!script) {
      return NextResponse.json({ ok: false, error: "Scene schema snapshot missing for this job." }, { status: 500 });
    }

    const audit = parse<RepoAudit | null>(job.auditJson, null);
    const repoMeta = parse<AuditRepoMeta | null>(job.metaJson, null);
    const jobResp: AuditJobResponse = {
      id: job.auditJobId ?? job.id,
      repoUrl: job.repoUrl,
      owner: job.owner,
      repo: job.repo,
      status: "ready",
      stage: "done",
      source: "github",
      strictness: "balanced",
      error: null,
      score: audit?.score ?? 0,
      fixesCount: audit?.fixes.length ?? 0,
      checksFailed: audit?.stats.checksFailed ?? 0,
      audit,
      repoMeta,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
    const meta: BundleMeta = {
      repo: job.repo,
      owner: job.owner,
      repoUrl: job.repoUrl,
      preset: job.preset,
      resolution: job.resolution,
      voice: job.voice,
    };

    // Give the standalone player real audit facts for the count-up scenes.
    const playable: VideoScript = audit
      ? {
          ...script,
          scenes: script.scenes.map((s, i) =>
            i === 1 ? { ...s, meta: { stars: repoMeta?.stars ?? 0, passed: audit.stats.checksPassed, total: audit.stats.checksTotal } } : s
          ),
        }
      : script;

    const zip = new JSZip();
    zip.file("README.md", buildBundleReadme(meta, script));
    zip.file("scene-schema.json", JSON.stringify(script, null, 2));
    zip.file("brief.md", buildVideoBrief(jobResp, script));
    zip.file("captions.srt", formatSrt(scriptCaptions(script)));
    zip.file("landing.html", buildLandingHtml(jobResp));
    zip.file("slides.md", buildSlidesMarkdown(buildSlides(jobResp), jobResp));
    zip.file("player.html", buildStandalonePlayerHtml(playable, meta));
    for (const [path, content] of Object.entries(buildHfSpaceFiles(meta))) {
      zip.file(path, content);
    }

    const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${job.repo}-shipos-bundle.zip"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ── Status payload ─────────────────────────────────────────────────────────
  const ahead = await db.renderJob.count({
    where: { status: { in: ["queued", "rendering"] }, createdAt: { lt: job.createdAt } },
  });

  const live = job.status === "rendering" ? stageAt((Date.now() - job.createdAt.getTime()) / 1000) : null;
  const currentIndex = live
    ? live.stageIndex
    : job.status === "done"
      ? RENDER_STAGES.length - 1
      : job.status === "canceled"
        ? 0
        : RENDER_STAGES.findIndex((s) => s.id === job.stage);

  return NextResponse.json({
    ok: true,
    job: {
      id: job.id,
      auditJobId: job.auditJobId,
      repoUrl: job.repoUrl,
      owner: job.owner,
      repo: job.repo,
      preset: job.preset,
      resolution: job.resolution,
      voice: job.voice,
      status: job.status,
      stage: live?.stage ?? job.stage,
      stageIndex: currentIndex < 0 ? 0 : currentIndex,
      progress: live?.progress ?? (job.status === "done" ? 100 : job.progress),
      gpuSeconds: live?.gpuSoFar ?? job.gpuSeconds,
      etaSeconds: live?.eta ?? 0,
      quotaHeld: job.quotaHeld,
      queuePosition: ahead + 1,
      ahead,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      error: job.error,
      stages: RENDER_STAGES.map((s, i) => ({
        id: s.id,
        label: s.label,
        detail: s.detail,
        kind: s.kind,
        state: i < currentIndex ? ("done" as const) : i === currentIndex ? ("active" as const) : ("todo" as const),
      })),
    },
    sceneCount: script?.scenes.length ?? 0,
    totalDuration: script?.totalDuration ?? 0,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await db.renderJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ ok: false, error: "Render job not found" }, { status: 404 });
  if (job.status === "done") {
    return NextResponse.json({ ok: false, error: "Completed jobs cannot be canceled — download the bundle instead." }, { status: 409 });
  }
  await db.renderJob.update({ where: { id }, data: { status: "canceled", stage: "canceled" } });
  return NextResponse.json({ ok: true });
}

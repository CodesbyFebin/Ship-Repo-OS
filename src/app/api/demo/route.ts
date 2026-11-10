// ─────────────────────────────────────────────────────────────────────────────
// POST /api/demo — start a Demo Maker job (repo URL → 5-min demo film).
// GET  /api/demo — recent demo jobs (history rail).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRepoUrl } from "@/lib/shipos/ingest";
import { isDemoStyle, isDemoTarget, isDemoVoice, runDemoJob } from "@/lib/shipos/demo-runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { repoUrl?: unknown; targetSeconds?: unknown; style?: unknown; voice?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.repoUrl !== "string") {
    return NextResponse.json({ ok: false, error: "Repository URL must be a string" }, { status: 400 });
  }
  const repoUrl = body.repoUrl.trim();
  if (!repoUrl) {
    return NextResponse.json({ ok: false, error: "Repository URL is required" }, { status: 400 });
  }

  let normalized: { owner: string; repo: string; url: string };
  try {
    normalized = normalizeRepoUrl(repoUrl);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid repository URL" },
      { status: 400 },
    );
  }

  const targetSeconds = isDemoTarget(body.targetSeconds) ? body.targetSeconds : 300;
  const style = isDemoStyle(body.style) ? body.style : "launch";
  const voice = isDemoVoice(body.voice) ? body.voice : "authoritative";

  const job = await db.demoJob.create({
    data: {
      repoUrl: normalized.url,
      owner: normalized.owner,
      repo: normalized.repo,
      targetSeconds,
      style,
      voice,
      status: "processing",
      stage: "queued",
    },
  });

  // Fire-and-forget: the pipeline persists progress; the client polls.
  void runDemoJob(job.id, normalized.url, { targetSeconds, style, voice });

  return NextResponse.json({ ok: true, id: job.id });
}

export async function GET() {
  const jobs = await db.demoJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      repoUrl: true,
      owner: true,
      repo: true,
      status: true,
      stage: true,
      targetSeconds: true,
      style: true,
      voice: true,
      enhanced: true,
      createdAt: true,
    },
  });
  return NextResponse.json(jobs);
}

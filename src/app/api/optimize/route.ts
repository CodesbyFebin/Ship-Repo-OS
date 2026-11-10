import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRepoUrl } from "@/lib/shipos/ingest";
import { runOptimizeJob } from "@/lib/shipos/optimizer";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST /api/optimize — start a full repo optimization job. body: { repoUrl } */
export async function POST(req: Request) {
  let body: { repoUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = (body.repoUrl ?? "").trim();
  if (!repoUrl) {
    return NextResponse.json({ ok: false, error: "Repository URL is required" }, { status: 400 });
  }

  let normalized: { owner: string; repo: string; url: string };
  try {
    normalized = normalizeRepoUrl(repoUrl);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid repository URL" },
      { status: 400 }
    );
  }

  const job = await db.optimizeJob.create({
    data: {
      repoUrl: normalized.url,
      owner: normalized.owner,
      repo: normalized.repo,
      status: "processing",
      stage: "queued",
    },
  });

  // Fire-and-forget: the pipeline persists progress to DB; the client polls.
  void runOptimizeJob(job.id, normalized.url);

  return NextResponse.json({ ok: true, id: job.id });
}

/** GET /api/optimize — recent optimization jobs (history rail). */
export async function GET() {
  const jobs = await db.optimizeJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      owner: true,
      repo: true,
      repoUrl: true,
      status: true,
      stage: true,
      packSource: true,
      createdAt: true,
    },
  });
  return NextResponse.json(jobs);
}

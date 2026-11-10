import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRepoUrl } from "@/lib/shipos/ingest";
import { runAuditJob } from "@/lib/shipos/repo-auditor";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST /api/audit — start a full repo audit job. body: { repoUrl, strictness? } */
export async function POST(req: Request) {
  let body: { repoUrl?: string; strictness?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = (body.repoUrl ?? "").trim();
  if (!repoUrl) {
    return NextResponse.json({ ok: false, error: "Repository URL is required" }, { status: 400 });
  }
  const strictness = body.strictness === "lenient" || body.strictness === "strict" ? body.strictness : "balanced";

  let normalized: { owner: string; repo: string; url: string };
  try {
    normalized = normalizeRepoUrl(repoUrl);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid repository URL" },
      { status: 400 }
    );
  }

  const job = await db.auditJob.create({
    data: {
      repoUrl: normalized.url,
      owner: normalized.owner,
      repo: normalized.repo,
      status: "processing",
      stage: "queued",
      source: "github",
      strictness,
    },
  });

  // Fire-and-forget: the pipeline persists progress to DB; the client polls.
  void runAuditJob(job.id, normalized.url, strictness);

  return NextResponse.json({ ok: true, id: job.id });
}

/** GET /api/audit — recent audit jobs (for the history rail). */
export async function GET() {
  const jobs = await db.auditJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      owner: true,
      repo: true,
      repoUrl: true,
      status: true,
      stage: true,
      score: true,
      fixesCount: true,
      checksFailed: true,
      createdAt: true,
    },
  });
  return NextResponse.json(jobs);
}

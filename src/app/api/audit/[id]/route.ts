import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AuditJobResponse, AuditRepoMeta, RepoAudit } from "@/lib/shipos/audit-types";

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** GET /api/audit/[id] — full audit job (polled by the client). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await db.auditJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ ok: false, error: "Audit job not found" }, { status: 404 });
  }

  const payload: AuditJobResponse = {
    id: job.id,
    repoUrl: job.repoUrl,
    owner: job.owner,
    repo: job.repo,
    status: job.status as AuditJobResponse["status"],
    stage: job.stage as AuditJobResponse["stage"],
    source: job.source === "file-list" ? "file-list" : "github",
    strictness: job.strictness === "lenient" || job.strictness === "strict" ? job.strictness : "balanced",
    error: job.error,
    score: job.score,
    fixesCount: job.fixesCount,
    checksFailed: job.checksFailed,
    audit: parse<RepoAudit | null>(job.auditJson, null),
    repoMeta: parse<AuditRepoMeta | null>(job.repoMetaJson, null),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };

  return NextResponse.json(payload);
}

/** DELETE /api/audit/[id] — remove a job from the history rail. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.auditJob.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }
}

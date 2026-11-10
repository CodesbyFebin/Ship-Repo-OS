import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AppliedFix, ReadmeAudit, RepoMeta, UpgradeJobResponse } from "@/lib/shipos/upgrade-types";

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** GET /api/upgrade/[id] — full upgrade job (polled by the client). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await db.upgradeJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ ok: false, error: "Upgrade job not found" }, { status: 404 });
  }

  const payload: UpgradeJobResponse = {
    id: job.id,
    repoUrl: job.repoUrl,
    owner: job.owner,
    repo: job.repo,
    status: job.status as UpgradeJobResponse["status"],
    stage: job.stage as UpgradeJobResponse["stage"],
    error: job.error,
    hadReadme: job.hadReadme,
    beforeScore: job.beforeScore,
    afterScore: job.afterScore,
    wordCountBefore: job.wordCountBefore,
    wordCountAfter: job.wordCountAfter,
    before: parse<ReadmeAudit | null>(job.beforeJson, null),
    after: parse<ReadmeAudit | null>(job.afterJson, null),
    fixes: parse<AppliedFix[]>(job.fixesJson, []),
    originalReadme: job.originalReadme || null,
    upgradedReadme: job.upgradedReadme || null,
    repoMeta: parse<RepoMeta | null>(job.repoMetaJson, null),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };

  return NextResponse.json(payload);
}

/** DELETE /api/upgrade/[id] — remove a job from the history rail. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.upgradeJob.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }
}

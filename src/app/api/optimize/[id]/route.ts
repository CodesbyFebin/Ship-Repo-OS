import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type {
  ChecklistEntry,
  DimensionBreakdown,
  OptimizeJobResponse,
  OptimizationPack,
} from "@/lib/shipos/optimize-types";
import { optimizationGuidance } from "@/lib/shipos/optimize-types";

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** GET /api/optimize/[id] — full optimization job (polled by the client). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await db.optimizeJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ ok: false, error: "Optimization job not found" }, { status: 404 });
  }

  const fallbackMeta = {
    description: "",
    topics: [] as string[],
    stars: 0,
    forks: 0,
    license: null,
    language: null,
    homepage: null,
    pushedAt: null,
  };
  const repoMeta = parse<OptimizeJobResponse["repoMeta"]>(job.repoMetaJson, fallbackMeta);
  const checklist = parse<ChecklistEntry[] | null>(job.checklistJson, null);

  const payload: OptimizeJobResponse = {
    id: job.id,
    repoUrl: job.repoUrl,
    owner: job.owner,
    repo: job.repo,
    status: job.status as OptimizeJobResponse["status"],
    stage: job.stage as OptimizeJobResponse["stage"],
    error: job.error,
    packSource: job.packSource === "fallback" ? "fallback" : "llm",
    before: parse<DimensionBreakdown | null>(job.beforeJson, null),
    after: null,
    checklist: checklist?.map(({ item, before }) => ({ item, before, after: optimizationGuidance(item, before) })) ?? null,
    artifacts: parse<OptimizationPack | null>(job.artifactsJson, null),
    repoMeta,
    createdAt: job.createdAt.toISOString(),
  };

  return NextResponse.json(payload);
}

/** DELETE /api/optimize/[id] — remove a job from the history rail. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.optimizeJob.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }
}

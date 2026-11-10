// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Render worker state machine (shared by every route that touches a
// job). The pipeline is a pure function of elapsed time, but stage/progress
// persistence and the GPU-quota ledger increment must happen exactly once, no
// matter which endpoint observes the transition first.
// ─────────────────────────────────────────────────────────────────────────────

import type { RenderJob } from "@prisma/client";
import { db } from "@/lib/db";
import { GPU_SECONDS_PER_JOB, stageAt, todayUtc } from "./render-types";

/**
 * Advance a job through the stage machine: persist stage/progress, and on the
 * done transition set completion fields + meter 26 GPU-seconds into the daily
 * ledger. Idempotent — safe to call from both the list and detail endpoints.
 */
export async function advanceJob(job: RenderJob): Promise<RenderJob> {
  if (job.status === "done" || job.status === "canceled" || job.status === "failed") return job;
  if (job.quotaHeld) return job; // parked: GPU budget exhausted — resumes at reset

  const elapsed = (Date.now() - job.createdAt.getTime()) / 1000;
  const live = stageAt(elapsed);

  if (live.stage === "done") {
    const updated = await db.renderJob.update({
      where: { id: job.id },
      data: {
        status: "done",
        stage: "done",
        progress: 100,
        gpuSeconds: GPU_SECONDS_PER_JOB,
        completedAt: new Date(),
      },
    });
    await db.gpuQuota.upsert({
      where: { date: todayUtc() },
      create: { date: todayUtc(), secondsUsed: GPU_SECONDS_PER_JOB },
      update: { secondsUsed: { increment: GPU_SECONDS_PER_JOB } },
    });
    return updated;
  }

  if (live.stage !== job.stage || live.progress !== job.progress) {
    return db.renderJob.update({
      where: { id: job.id },
      data: { status: "rendering", stage: live.stage, progress: live.progress, gpuSeconds: live.gpuSoFar },
    });
  }
  return job;
}

/** Advance every active job (bounded) — used by the queue list endpoint. */
export async function advanceActiveJobs(take = 25): Promise<void> {
  const active = await db.renderJob.findMany({
    where: { status: { in: ["queued", "rendering"] }, quotaHeld: false },
    orderBy: { createdAt: "asc" },
    take,
  });
  await Promise.all(active.map((j) => advanceJob(j).catch(() => j)));
}

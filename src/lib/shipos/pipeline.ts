// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Pipeline Orchestrator (the thin CLI brain, run from the API layer)
// ingest → verify → forge → score → persist
// ─────────────────────────────────────────────────────────────────────────────
import { db } from "@/lib/db";
import { ingestRepo, RepoNotFoundError, IngestionError } from "./ingest";
import { extractNarrative, buildLedger } from "./provenance";
import { forgeAll, countWords } from "./generators";
import { getPreset } from "./presets";
import type { Artifacts, ClaimLedger, RepoData, ShipResult } from "./types";

async function setStage(id: string, stage: string, patch: Partial<{ repoJson: string; ledgerJson: string; artifactsJson: string }> = {}) {
  await db.shipProject.update({ where: { id }, data: { stage, ...patch } });
}

export async function runPipeline(projectId: string, repoUrl: string, presetId: string): Promise<void> {
  try {
    const preset = getPreset(presetId);

    // ── Layer 1: Deep Ingestion ──────────────────────────────────────────────
    await setStage(projectId, "ingesting");
    const repo: RepoData = await ingestRepo(repoUrl);

    // ── Layer 2: Zero-Trust Intelligence ─────────────────────────────────────
    await setStage(projectId, "verifying", { repoJson: JSON.stringify(repo) });
    const { narrative } = await extractNarrative(repo);
    const ledger: ClaimLedger = buildLedger(repo, narrative);

    // ── Layers 3+4: Preset Engine + Agentic Rendering ────────────────────────
    await setStage(projectId, "generating", { ledgerJson: JSON.stringify(ledger) });
    const artifacts: Artifacts = await forgeAll(repo, ledger, narrative, preset.id);

    // ── Scoring ──────────────────────────────────────────────────────────────
    await setStage(projectId, "scoring");
    const { computeScores } = await import("./scoring");
    const scores = computeScores(artifacts.readme, repo, narrative);
    const wordCount = countWords(artifacts.readme);

    const result: ShipResult = { repo, ledger, artifacts, scores, narrative };
    await db.shipProject.update({
      where: { id: projectId },
      data: {
        status: "ready",
        stage: "done",
        artifactsJson: JSON.stringify(artifacts),
        scoresJson: JSON.stringify(scores),
        wordCount,
        stars: repo.stars,
        verifiedCount: ledger.summary.verified,
        rejectedCount: ledger.summary.rejected,
      },
    });
    console.log(`[shipos] project ${projectId} (${repo.owner}/${repo.repo}) ready — ${wordCount} words, ${ledger.summary.verified} verified, ${ledger.summary.rejected} rejected`);
  } catch (err) {
    const message =
      err instanceof RepoNotFoundError
        ? "Repository not found or private. Check the URL and make sure the repo is public."
        : err instanceof IngestionError
          ? err.message
          : err instanceof Error
            ? `Ingestion failed: ${err.message}`
            : "Unknown ingestion failure";
    console.error(`[shipos] project ${projectId} failed:`, err);
    // Preserve the stage where the failure happened so the UI can flag it red.
    let failedStage = "ingesting";
    try {
      const row = await db.shipProject.findUnique({ where: { id: projectId }, select: { stage: true } });
      if (row && row.stage !== "done") failedStage = row.stage;
    } catch {
      // keep default
    }
    await db.shipProject
      .update({
        where: { id: projectId },
        data: { status: "error", stage: failedStage, error: message },
      })
      .catch(() => undefined);
  }
}

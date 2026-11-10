import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Artifacts, ClaimLedger, ProjectResponse, RepoData, Scores, ShipResult } from "@/lib/shipos/types";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.shipProject.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  let data: ShipResult | null = null;
  if (project.repoJson && project.ledgerJson && project.artifactsJson) {
    try {
      data = {
        repo: JSON.parse(project.repoJson) as RepoData,
        ledger: JSON.parse(project.ledgerJson) as ClaimLedger,
        artifacts: JSON.parse(project.artifactsJson) as Artifacts,
        scores: project.scoresJson
          ? (JSON.parse(project.scoresJson) as Scores)
          : { seo: { score: 0, checks: [] }, readme: { score: 0, tier: "Bronze", features: [] }, health: { score: 0, pillars: [], fixes: [] } },
        narrative: null,
      };
    } catch (err) {
      console.error("[shipos] failed to parse project data", err);
      data = null;
    }
  }

  const response: ProjectResponse = {
    id: project.id,
    repoUrl: project.repoUrl,
    owner: project.owner,
    repo: project.repo,
    preset: project.preset,
    status: project.status as ProjectResponse["status"],
    stage: project.stage as ProjectResponse["stage"],
    error: project.error,
    wordCount: project.wordCount,
    verifiedCount: project.verifiedCount,
    rejectedCount: project.rejectedCount,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    data,
  };

  return NextResponse.json(response);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.shipProject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }
}

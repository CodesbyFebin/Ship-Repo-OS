import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ProjectListItem } from "@/lib/shipos/types";

export const runtime = "nodejs";

export async function GET() {
  const rows = await db.shipProject.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      owner: true,
      repo: true,
      repoUrl: true,
      preset: true,
      status: true,
      stage: true,
      stars: true,
      verifiedCount: true,
      rejectedCount: true,
      wordCount: true,
      createdAt: true,
    },
  });

  const items: ProjectListItem[] = rows.map((r) => ({
    id: r.id,
    owner: r.owner,
    repo: r.repo,
    repoUrl: r.repoUrl,
    preset: r.preset,
    status: r.status,
    stage: r.stage,
    stars: r.stars,
    verifiedCount: r.verifiedCount,
    rejectedCount: r.rejectedCount,
    wordCount: r.wordCount,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json(items);
}

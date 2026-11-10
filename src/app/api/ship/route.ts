import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRepoUrl } from "@/lib/shipos/ingest";
import { PRESETS, DEFAULT_PRESET } from "@/lib/shipos/presets";
import { runPipeline } from "@/lib/shipos/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { repoUrl?: string; preset?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = (body.repoUrl ?? "").trim();
  const preset = PRESETS.some((p) => p.id === body.preset) ? body.preset! : DEFAULT_PRESET;

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

  const project = await db.shipProject.create({
    data: {
      repoUrl: normalized.url,
      owner: normalized.owner,
      repo: normalized.repo,
      preset,
      status: "processing",
      stage: "queued",
    },
  });

  // Fire-and-forget: pipeline persists progress to DB; the client polls.
  void runPipeline(project.id, normalized.url, preset);

  return NextResponse.json({ ok: true, id: project.id });
}

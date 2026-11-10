import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRepoUrl } from "@/lib/shipos/ingest";

export const runtime = "nodejs";

/** GET /api/scheduled — list scheduled auto-audits. */
export async function GET() {
  const items = await db.scheduledAudit.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(
    items.map((s) => ({
      id: s.id,
      repoUrl: s.repoUrl,
      owner: s.owner,
      repo: s.repo,
      frequency: s.frequency,
      enabled: s.enabled,
      lastScore: s.lastScore,
      lastRunAt: s.lastRunAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    }))
  );
}

/** POST /api/scheduled — add a repo to the schedule. body: { repoUrl, frequency } */
export async function POST(req: Request) {
  let body: { repoUrl?: string; frequency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const frequency = body.frequency === "weekly" ? "weekly" : "daily";
  let normalized: { owner: string; repo: string; url: string };
  try {
    normalized = normalizeRepoUrl(String(body.repoUrl ?? ""));
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Invalid repo URL" }, { status: 400 });
  }
  const existing = await db.scheduledAudit.findFirst({ where: { repoUrl: normalized.url, frequency } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "That repo is already on this schedule" }, { status: 409 });
  }
  const item = await db.scheduledAudit.create({
    data: { repoUrl: normalized.url, owner: normalized.owner, repo: normalized.repo, frequency },
  });
  return NextResponse.json({ ok: true, id: item.id });
}

/** PATCH /api/scheduled — toggle on/off. body: { id, enabled } */
export async function PATCH(req: Request) {
  let body: { id?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  try {
    const item = await db.scheduledAudit.update({
      where: { id: body.id },
      data: { enabled: body.enabled },
    });
    return NextResponse.json({ ok: true, enabled: item.enabled });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}

/** DELETE /api/scheduled?id=... */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  try {
    await db.scheduledAudit.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}

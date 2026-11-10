// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/demo/[id] — full demo job (script + meta), polled by the client.
// DELETE /api/demo/[id] — remove a demo run from the history rail.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toDemoJobResponse } from "@/lib/shipos/demo-runner";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await db.demoJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ ok: false, error: "Demo job not found" }, { status: 404 });
  }
  return NextResponse.json(toDemoJobResponse(job));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.demoJob.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Demo job not found" }, { status: 404 });
  }
}

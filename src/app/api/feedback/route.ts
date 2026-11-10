import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** POST /api/feedback — "was this fix helpful?". body: { fixId, helpful } */
export async function POST(req: Request) {
  let body: { fixId?: string; helpful?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.fixId) return NextResponse.json({ ok: false, error: "fixId required" }, { status: 400 });
  await db.feedback.create({ data: { fixId: String(body.fixId).slice(0, 60), helpful: !!body.helpful } });
  return NextResponse.json({ ok: true });
}

/** GET /api/feedback — aggregate helpfulness per fix (analytics). */
export async function GET() {
  const rows = await db.feedback.groupBy({
    by: ["fixId"],
    _count: { _all: true },
    where: { helpful: true },
  });
  const total = await db.feedback.count();
  return NextResponse.json({ total, helpful: rows.map((r) => ({ fixId: r.fixId, count: r._count._all })) });
}

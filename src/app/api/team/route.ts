import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

/** GET /api/team — member list. */
export async function GET() {
  const items = await db.teamMember.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(
    items.map((m) => ({
      id: m.id,
      name: m.name,
      handle: m.handle,
      role: m.role,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    }))
  );
}

/** POST /api/team — invite a member. body: { name, handle, role? } */
export async function POST(req: Request) {
  let body: { name?: string; handle?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const handle = (body.handle ?? "").trim().replace(/^@/, "");
  if (!handle) return NextResponse.json({ ok: false, error: "GitHub handle or email required" }, { status: 400 });
  const name = (body.name ?? "").trim().slice(0, 60) || handle;
  const role = ROLES.includes(String(body.role)) ? String(body.role) : "MEMBER";
  const count = await db.teamMember.count();
  if (count >= 10) return NextResponse.json({ ok: false, error: "Team is full (10 members)" }, { status: 409 });
  const item = await db.teamMember.create({ data: { name, handle, role, status: "invited" } });
  return NextResponse.json({
    ok: true,
    id: item.id,
    name: item.name,
    handle: item.handle,
    role: item.role,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
  });
}

/** PATCH /api/team — change role / accept invite. body: { id, role?, status? } */
export async function PATCH(req: Request) {
  let body: { id?: string; role?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const data: { role?: string; status?: string } = {};
  if (body.role && ROLES.includes(body.role)) data.role = body.role;
  if (body.status === "active" || body.status === "invited") data.status = body.status;
  try {
    await db.teamMember.update({ where: { id: body.id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}

/** DELETE /api/team?id=... */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  try {
    await db.teamMember.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}

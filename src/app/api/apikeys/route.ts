import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function newKey(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let core = "";
  for (let i = 0; i < 32; i++) core += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `skos_${core}`;
}

/** GET /api/apikeys — list keys (key material masked except last 4). */
export async function GET() {
  const items = await db.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(
    items.map((k) => ({
      id: k.id,
      key: k.key,
      label: k.label,
      usageCount: k.usageCount,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    }))
  );
}

/** POST /api/apikeys — generate a key. body: { label } */
export async function POST(req: Request) {
  let body: { label?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const count = await db.apiKey.count();
  if (count >= 5) {
    return NextResponse.json({ ok: false, error: "Key limit reached (5). Delete one first." }, { status: 409 });
  }
  const label = (body.label ?? "").trim().slice(0, 40) || "default";
  const item = await db.apiKey.create({ data: { key: newKey(), label } });
  return NextResponse.json({
    ok: true,
    id: item.id,
    key: item.key,
    label: item.label,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: item.createdAt.toISOString(),
  });
}

/** DELETE /api/apikeys?id=... */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  try {
    await db.apiKey.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}

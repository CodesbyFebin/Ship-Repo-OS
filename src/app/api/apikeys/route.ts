import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  authorizeAdminFromRequest,
  migratedApiKeyFields,
  newApiKey,
  storedApiKeyFields,
  toCreatedApiKey,
  toPublicApiKey,
} from "@/lib/shipos/api-keys.mjs";

export const runtime = "nodejs";

async function requireAdmin(req: Request) {
  const auth = authorizeAdminFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  return null;
}

async function maybeMigrate(record: { id: string; key: string; keyPrefix: string; keyLast4: string }) {
  const next = migratedApiKeyFields(record);
  if (!next) return record;
  return db.apiKey.update({ where: { id: record.id }, data: next });
}

/** GET /api/apikeys — list keys with secret material masked. */
export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const items = await db.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  const published: ReturnType<typeof toPublicApiKey>[] = [];
  for (const item of items) {
    const record = await maybeMigrate(item);
    published.push(toPublicApiKey(record));
  }
  return NextResponse.json(published);
}

/** POST /api/apikeys — generate a key. body: { label }. Full secret is returned only here. */
export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

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
  const secret = newApiKey();
  const item = await db.apiKey.create({
    data: { ...storedApiKeyFields(secret), label },
  });
  return NextResponse.json(toCreatedApiKey(item, secret));
}

/** DELETE /api/apikeys?id=... */
export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  try {
    await db.apiKey.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}

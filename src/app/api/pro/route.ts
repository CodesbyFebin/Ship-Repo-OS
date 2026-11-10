import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Plan → tier + expiry mapping for the demo checkout. */
const PLANS: Record<string, { tier: "PRO" | "TEAM"; months: number | null }> = {
  monthly: { tier: "PRO", months: 1 },
  lifetime: { tier: "PRO", months: null }, // one-time purchase — no expiry
  team: { tier: "TEAM", months: 1 },
};

async function getState() {
  let state = await db.proState.findUnique({ where: { id: "main" } });
  if (!state) {
    state = await db.proState.create({ data: { id: "main" } });
  }
  return state;
}

/** GET /api/pro — current license state. */
export async function GET() {
  const state = await getState();
  return NextResponse.json({
    tier: state.tier,
    plan: state.plan,
    activatedAt: state.activatedAt?.toISOString() ?? null,
    expiresAt: state.expiresAt?.toISOString() ?? null,
    active: state.tier !== "FREE",
  });
}

/**
 * POST /api/pro — demo license actions.
 * body: { action: "checkout", plan: "monthly"|"lifetime"|"team" }
 *     | { action: "cancel" }       → downgrade to FREE
 *     | { action: "restore" }      → re-activate the last paid plan
 */
export async function POST(req: Request) {
  let body: { action?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const state = await getState();

  if (body.action === "checkout") {
    const plan = String(body.plan ?? "");
    const mapped = PLANS[plan];
    if (!mapped) {
      return NextResponse.json({ ok: false, error: "Unknown plan. Use monthly | lifetime | team." }, { status: 400 });
    }
    const now = new Date();
    const expiresAt = mapped.months ? new Date(now.getTime() + mapped.months * 30 * 24 * 3600 * 1000) : null;
    const updated = await db.proState.update({
      where: { id: "main" },
      data: { tier: mapped.tier, plan, activatedAt: now, expiresAt },
    });
    return NextResponse.json({
      ok: true,
      tier: updated.tier,
      plan: updated.plan,
      activatedAt: updated.activatedAt?.toISOString() ?? null,
      expiresAt: updated.expiresAt?.toISOString() ?? null,
      active: true,
    });
  }

  if (body.action === "cancel") {
    const updated = await db.proState.update({
      where: { id: "main" },
      data: { tier: "FREE", plan: "", activatedAt: null, expiresAt: null },
    });
    return NextResponse.json({
      ok: true,
      tier: updated.tier,
      plan: "",
      activatedAt: null,
      expiresAt: null,
      active: false,
    });
  }

  if (body.action === "restore") {
    if (state.tier === "FREE") {
      // Demo restore: re-activate PRO lifetime so testers can unlock again.
      const updated = await db.proState.update({
        where: { id: "main" },
        data: { tier: "PRO", plan: "lifetime", activatedAt: new Date(), expiresAt: null },
      });
      return NextResponse.json({
        ok: true,
        tier: updated.tier,
        plan: updated.plan,
        activatedAt: updated.activatedAt?.toISOString() ?? null,
        expiresAt: null,
        active: true,
      });
    }
    return NextResponse.json({
      ok: true,
      tier: state.tier,
      plan: state.plan,
      activatedAt: state.activatedAt?.toISOString() ?? null,
      expiresAt: state.expiresAt?.toISOString() ?? null,
      active: true,
    });
  }

  return NextResponse.json({ ok: false, error: "Unknown action. Use checkout | cancel | restore." }, { status: 400 });
}

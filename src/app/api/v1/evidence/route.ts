import { NextResponse } from "next/server";
import {
  HMAC_KEY_ENV,
  buildQualityProfile,
  createReceipt,
  evaluateG0,
  gateStatusReport,
  runEvidenceSuite,
  verifyReceipt,
  verifySha256Sums,
} from "@/lib/shipos/evidence-engine/index.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

type EvidenceBody = {
  action?: string;
  snapshot?: Record<string, unknown>;
  repoUrl?: string;
  liveUrl?: string;
  manifest?: string;
  manifestPath?: string;
  artifacts?: Record<string, string>;
  payload?: unknown;
  receipt?: unknown;
};

/**
 * POST /api/v1/evidence
 * Trusted single-instance demo API for the P0 evidence engine.
 * body.action: profile | g0 | g6 | receipt | verify-receipt | suite
 */
export async function POST(req: Request) {
  let body: EvidenceBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action ?? "suite";
  const hmacKey = process.env[HMAC_KEY_ENV];

  try {
    if (action === "profile") {
      const profile = buildQualityProfile(body.snapshot ?? {});
      return NextResponse.json({ ok: true, profile, gates: gateStatusReport() });
    }
    if (action === "g0") {
      const g0 = await evaluateG0({ repoUrl: body.repoUrl, liveUrl: body.liveUrl });
      return NextResponse.json({ ok: true, g0, gates: gateStatusReport({ G0: g0 }) });
    }
    if (action === "g6") {
      if (typeof body.manifest !== "string") {
        return NextResponse.json({ ok: false, error: "manifest text is required" }, { status: 400 });
      }
      const g6 = verifySha256Sums(body.manifest, body.artifacts ?? {}, { manifestPath: body.manifestPath });
      return NextResponse.json({ ok: true, g6, gates: gateStatusReport({ G6: g6 }) });
    }
    if (action === "receipt") {
      const receipt = createReceipt(body.payload ?? body.snapshot ?? {}, { hmacKey });
      return NextResponse.json({ ok: true, receipt, g7: verifyReceipt(receipt, { hmacKey }) });
    }
    if (action === "verify-receipt") {
      if (!body.receipt) {
        return NextResponse.json({ ok: false, error: "receipt is required" }, { status: 400 });
      }
      const g7 = verifyReceipt(body.receipt, { hmacKey });
      return NextResponse.json({ ok: true, g7, gates: gateStatusReport({ G7: g7 }) });
    }
    if (action === "suite") {
      const result = await runEvidenceSuite({
        snapshot: body.snapshot ?? {},
        repoUrl: body.repoUrl,
        liveUrl: body.liveUrl,
        manifest: body.manifest,
        artifacts: body.artifacts,
        manifestPath: body.manifestPath,
        hmacKey,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Evidence evaluation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    engine: "ShipOS P0 evidence engine",
    actions: ["profile", "g0", "g6", "receipt", "verify-receipt", "suite"],
    gates: gateStatusReport(),
  });
}

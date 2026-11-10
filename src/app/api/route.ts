import { NextResponse } from "next/server";

// GET /api — service health + engine registry. Handy for uptime checks and
// for agents discovering the API surface without reading the source.
export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "ShipOS — The Universal Submission Engine",
    tagline: "One URL. Every Artifact. Zero Lies.",
    version: "1.0.0",
    engines: {
      ship: "POST /api/ship — full package (README · demo · deck · report · ledger)",
      audit: "POST /api/audit — full repo audit, 50 checks · 0–100 · graded S–F",
      offlineAudit: "POST /api/audit/offline — zero-network file-list audit",
      optimize: "POST /api/optimize — SEO · AEO · GEO → 100/100 · 54-point pack",
      demo: "POST /api/demo — repo URL → 5-minute demo film schema",
      upgrade: "POST /api/upgrade — README → 100/100",
      render: "POST /api/render — Path B 4K render on free GPU quota",
      publicApi: "POST /api/v1/audit — key-gated public audit (PRO TEAM)",
    },
    time: new Date().toISOString(),
  });
}

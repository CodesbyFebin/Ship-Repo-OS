// ─────────────────────────────────────────────────────────────────────────────
// POST /api/story — Story Engine AI enhancement (backend-only, z-ai-web-dev-sdk).
// Kinds:
//   real-picture → LLM rewrites the Problem / Provides / Serves / Why framing
//   video        → LLM rewrites the 5-act voiceover script lines
// Deterministic fallback: if the LLM is unavailable or returns junk, the
// client simply keeps the deterministic base — the Story Engine never breaks.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { chatJson } from "@/lib/shipos/llm";
import { buildRealPicture, buildVideoScript, type RealPicture, type VideoScript } from "@/lib/shipos/story-engine";
import type { AuditJobResponse, AuditRepoMeta, RepoAudit } from "@/lib/shipos/audit-types";

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const realPictureSchema = z.object({
  problem: z.string().min(40).max(900),
  provides: z.array(z.string().min(8).max(240)).min(3).max(5),
  serves: z.array(z.object({ who: z.string().min(4).max(120), why: z.string().min(8).max(240) })).min(2).max(3),
  why: z.array(z.string().min(10).max(240)).min(2).max(4),
});

const videoSchema = z.object({
  lines: z.array(z.array(z.string().min(6).max(260)).min(3).max(6)).length(5),
});

const SYSTEM = `You are the ShipOS Story Engine — Cinematic Narrator.
Voice: inspiring, authoritative, fast-paced keynote tone. Concrete, never generic. Short punchy sentences.
You speak about a repository based ONLY on the deterministic audit facts given to you. Never invent features, users, or numbers.
Always answer with strict JSON only — no markdown fences, no commentary.`;

export async function POST(req: Request) {
  let body: { jobId?: string; kind?: string };
  try {
    body = (await req.json()) as { jobId?: string; kind?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, kind } = body;
  if (!jobId || (kind !== "real-picture" && kind !== "video")) {
    return NextResponse.json({ ok: false, error: "jobId and kind ('real-picture' | 'video') are required" }, { status: 400 });
  }

  const row = await db.auditJob.findUnique({ where: { id: jobId } });
  if (!row || !row.auditJson) {
    return NextResponse.json({ ok: false, error: "Audit job not found or not ready" }, { status: 404 });
  }

  const audit = parse<RepoAudit | null>(row.auditJson, null);
  const repoMeta = parse<AuditRepoMeta | null>(row.repoMetaJson, null);
  if (!audit) {
    return NextResponse.json({ ok: false, error: "Audit payload unreadable" }, { status: 500 });
  }

  const job: AuditJobResponse = {
    id: row.id,
    repoUrl: row.repoUrl,
    owner: row.owner,
    repo: row.repo,
    status: row.status as AuditJobResponse["status"],
    stage: row.stage as AuditJobResponse["stage"],
    source: row.source === "file-list" ? "file-list" : "github",
    strictness: row.strictness === "lenient" || row.strictness === "strict" ? row.strictness : "balanced",
    error: row.error,
    score: row.score,
    fixesCount: row.fixesCount,
    checksFailed: row.checksFailed,
    audit,
    repoMeta,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  // ── Real Picture enhancement ───────────────────────────────────────────────
  if (kind === "real-picture") {
    const base = buildRealPicture(job);
    const facts = {
      repo: `${job.owner}/${job.repo}`,
      description: repoMeta?.description ?? null,
      language: repoMeta?.language ?? null,
      stars: repoMeta?.stars ?? null,
      license: repoMeta?.license ?? null,
      score: audit.score,
      grade: audit.grade,
      tier: audit.tier,
      percentile: audit.percentile,
      pointsAtStake: audit.stats.pointsAtStake,
      checksFailed: audit.stats.checksFailed,
      categories: audit.categories.map((c) => ({ name: c.name, score: c.score, max: c.max })),
      topFixes: audit.fixes.slice(0, 5).map((f) => ({ title: f.title, points: f.points, effort: f.effort })),
      risks: audit.risks.slice(0, 4).map((r) => ({ severity: r.severity, title: r.title })),
    };
    const user = `Audit facts:\n${JSON.stringify(facts, null, 2)}\n\nRewrite the story framing for this repo. JSON shape:
{"problem": "2-4 sentences: what this repo is and why its ${audit.stats.pointsAtStake} lost points hurt — concrete, keynote tone",
 "provides": ["3-5 concrete things the repo provides today"],
 "serves": [{"who": "audience", "why": "why it fits them"}],
 "why": ["2-4 reasons fixing the audit gap matters now"]}`;
    const ai = await chatJson({ system: SYSTEM, user, schema: realPictureSchema, retries: 1, maxTokens: 900 });
    if (!ai) {
      return NextResponse.json({ ok: true, realPicture: base, enhanced: false });
    }
    const result: RealPicture = { ...ai, source: "ai" };
    return NextResponse.json({ ok: true, realPicture: result, enhanced: true });
  }

  // ── Video script VO enhancement ────────────────────────────────────────────
  const baseScript: VideoScript = buildVideoScript(job);
  const facts = {
    repo: `${job.owner}/${job.repo}`,
    description: repoMeta?.description ?? null,
    score: audit.score,
    grade: audit.grade,
    pointsAtStake: audit.stats.pointsAtStake,
    checksFailed: audit.stats.checksFailed,
    checksTotal: audit.stats.checksTotal,
    topFixes: audit.fixes.slice(0, 3).map((f) => ({ title: f.title, points: f.points, effort: f.effort })),
  };
  const user = `Audit facts:\n${JSON.stringify(facts)}\n\nWrite a 5-act cinematic voiceover script. Keep each act's on-screen purpose:
Act 1 The Gap (open on the ${audit.score}/100 score) → Act 2 The Discovery (what the audit found) → Act 3 The Climb (ranked fixes with full code) → Act 4 The Proof (score climbs to 100) → Act 5 The Launch (call to action).
JSON shape: {"lines": [[act1 line1, act1 line2, ...], [act2...], [act3...], [act4...], [act5...]]}
3-5 short spoken lines per act (8-22 words each), keynote narrator tone, use ONLY the facts above.`;

  const ai = await chatJson({ system: SYSTEM, user, schema: videoSchema, retries: 1, maxTokens: 1200 });
  if (!ai) {
    return NextResponse.json({ ok: true, script: baseScript, enhanced: false });
  }
  const merged: VideoScript = {
    ...baseScript,
    scenes: baseScript.scenes.map((sc, i) => ({
      ...sc,
      vo: ai.lines[i] && ai.lines[i].length >= 2 ? ai.lines[i] : sc.vo,
    })),
  };
  return NextResponse.json({ ok: true, script: merged, enhanced: true });
}

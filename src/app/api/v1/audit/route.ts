import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRepoUrl, ingestRepo, RepoNotFoundError } from "@/lib/shipos/ingest";
import { fetchRaw } from "@/lib/shipos/scrape";
import { auditRepo, type AuditScan } from "@/lib/shipos/repo-audit";
import { DEFAULT_STRICTNESS, type Strictness } from "@/lib/shipos/audit-types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/v1/audit — Public API (PRO TEAM).
 * Header: x-api-key: skos_...
 * body: { repoUrl, strictness? }
 * Synchronous: returns the full audit JSON. Counts against key usage.
 */
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key") ?? "";
  if (!apiKey.startsWith("skos_")) {
    return NextResponse.json(
      { ok: false, error: "Missing or malformed x-api-key header. Generate a key in the PRO hub." },
      { status: 401 }
    );
  }
  const key = await db.apiKey.findUnique({ where: { key: apiKey } });
  if (!key) {
    return NextResponse.json({ ok: false, error: "Unknown API key" }, { status: 401 });
  }

  let body: { repoUrl?: string; strictness?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const strictness: Strictness =
    body.strictness === "lenient" || body.strictness === "strict" ? body.strictness : DEFAULT_STRICTNESS;

  let normalized: { owner: string; repo: string; url: string };
  try {
    normalized = normalizeRepoUrl(String(body.repoUrl ?? ""));
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Invalid repo URL" }, { status: 400 });
  }

  try {
    const repo = await ingestRepo(normalized.url);
    const wfNames = repo.ciWorkflows.slice(0, 4);
    const [wfResults] = await Promise.all([
      Promise.all(
        wfNames.map(async (name) => ({
          name,
          content: (await fetchRaw(repo.owner, repo.repo, repo.defaultBranch, `.github/workflows/${name}`)) ?? "",
        }))
      ),
    ]);
    const scan: AuditScan = { workflowContents: wfResults.filter((w) => w.content), raws: {} };
    if (repo.rootFiles.some((f) => /^tsconfig\.json$/i.test(f))) {
      repo.tsconfigRaw = await fetchRaw(repo.owner, repo.repo, repo.defaultBranch, "tsconfig.json");
    }
    const audit = auditRepo(repo, scan, strictness);

    await db.apiKey.update({
      where: { id: key.id },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      owner: repo.owner,
      repo: repo.repo,
      score: audit.score,
      grade: audit.grade,
      percentile: audit.percentile,
      strictness: audit.strictness,
      breakdown: audit.categories.map((c) => ({ id: c.id, name: c.name, score: c.score, max: c.max })),
      stats: audit.stats,
      risks: audit.risks,
      roadmap: audit.roadmap,
      fixes: audit.fixes,
    });
  } catch (err) {
    if (err instanceof RepoNotFoundError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Audit failed" },
      { status: 502 }
    );
  }
}

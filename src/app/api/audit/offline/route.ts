import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseFileList, auditFromFiles } from "@/lib/shipos/offline-audit";
import { DEFAULT_STRICTNESS, type AuditJobResponse, type Strictness } from "@/lib/shipos/audit-types";

export const runtime = "nodejs";

/**
 * POST /api/audit/offline — "Paste File List" audit mode.
 * body: { name?, files: string[] | string, readme? }
 * Deterministic, zero network. Persists to the same history table.
 */
export async function POST(req: Request) {
  let body: { name?: string; files?: string[] | string; readme?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawList = Array.isArray(body.files) ? body.files.join("\n") : String(body.files ?? "");
  const files = parseFileList(rawList);
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "Paste at least one file path (one per line)" }, { status: 400 });
  }

  const strictness: Strictness =
    (body as { strictness?: string }).strictness === "lenient" || (body as { strictness?: string }).strictness === "strict"
      ? ((body as { strictness?: string }).strictness as Strictness)
      : DEFAULT_STRICTNESS;

  const name = (body.name ?? "").trim().slice(0, 60) || "pasted-file-list";
  const audit = auditFromFiles({ name, files, readme: body.readme }, strictness);

  const job = await db.auditJob.create({
    data: {
      repoUrl: `file-list://${name}`,
      owner: "offline",
      repo: name,
      status: "ready",
      stage: "done",
      source: "file-list",
      strictness,
      score: audit.score,
      fixesCount: audit.fixes.length,
      checksFailed: audit.stats.checksFailed,
      auditJson: JSON.stringify(audit),
      repoMetaJson: JSON.stringify({
        description: "Offline audit from a pasted file list",
        language: "Unknown",
        languages: [],
        stars: 0,
        forks: 0,
        license: null,
        topics: [],
        hasTests: audit.categories.flatMap((c) => c.checks).some((c) => c.id === "qa-tests" && c.pass),
        ciWorkflows: [],
        packageManager: null,
        homepage: null,
        commitCount: null,
        releaseCount: null,
      }),
    },
  });

  const payload: AuditJobResponse = {
    id: job.id,
    repoUrl: job.repoUrl,
    owner: job.owner,
    repo: job.repo,
    status: "ready",
    stage: "done",
    source: "file-list",
    strictness,
    error: null,
    score: audit.score,
    fixesCount: audit.fixes.length,
    checksFailed: audit.stats.checksFailed,
    audit,
    repoMeta: JSON.parse(String(job.repoMetaJson)),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };

  return NextResponse.json({ ok: true, job: payload });
}

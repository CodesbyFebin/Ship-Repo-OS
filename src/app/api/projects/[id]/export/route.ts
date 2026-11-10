import { NextResponse } from "next/server";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { buildScriptMarkdown } from "@/lib/shipos/generators";
import type { Artifacts, ClaimLedger, RepoData } from "@/lib/shipos/types";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.shipProject.findUnique({ where: { id } });
  if (!project || !project.repoJson || !project.ledgerJson || !project.artifactsJson) {
    return NextResponse.json({ ok: false, error: "Project artifacts not ready" }, { status: 404 });
  }

  const repo = JSON.parse(project.repoJson) as RepoData;
  const ledger = JSON.parse(project.ledgerJson) as ClaimLedger;
  const artifacts = JSON.parse(project.artifactsJson) as Artifacts;

  const zip = new JSZip();
  const dist = zip.folder("dist")!;

  dist.file("README.md", artifacts.readme);
  dist.file("repo.json", JSON.stringify(repo, null, 2));

  const demo = dist.folder("demo")!;
  demo.file("script.md", buildScriptMarkdown(artifacts.demoScript));
  demo.file("storyboard.json", artifacts.storyboardJson);
  demo.file("claim_ledger.json", JSON.stringify(ledger, null, 2));

  const deck = dist.folder("deck")!;
  deck.file("slides.md", artifacts.deck.markdown);
  deck.file("speaker_notes.txt", artifacts.deck.speakerNotes);

  const report = dist.folder("report")!;
  report.file("project_report.md", artifacts.report);
  report.file("viva_preparation.md", artifacts.vivaPrep);
  report.file("architecture.mermaid", artifacts.mermaid);

  dist.folder("compliance")!.file("submission_checklist.md", artifacts.checklist.markdown);

  const badges = dist.folder("badges")!;
  badges.file("hero-banner.html", artifacts.hero.html);
  badges.file("badges.md", artifacts.badges.markdown);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="shipos-${repo.owner}-${repo.repo}.zip"`,
      "Content-Length": String(buffer.length),
    },
  });
}

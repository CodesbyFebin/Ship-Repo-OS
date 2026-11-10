"use client";

import { useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  Braces,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCheck,
  FileJson,
  FileText,
  Film,
  FolderOpen,
  Package,
  ShieldCheck,
  XCircle,
} from "@/ui/symbols";
import {
  Alert,
  Badge,
  Button,
  Card,
  CodeBlock,
  Icon,
  IconButton,
  Progress,
  SegmentedButton,
  Table,
  toast,
} from "@/ui";
import type { Column, IconGlyph } from "@/ui";
import type {
  ClaimEntry,
  ClaimStatus,
  DemoScene,
  DemoScript,
  ProjectResponse,
} from "@/lib/shipos/types";
import { getPreset } from "@/lib/shipos/presets";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────

const mdComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

function MarkdownView({ source, className }: { source: string; className?: string }) {
  return (
    <div className={cn("md-body text-body-sm", className)}>
      <ReactMarkdown components={mdComponents}>{source}</ReactMarkdown>
    </div>
  );
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outlined"
      size="xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
          toast({ title: "Copied to clipboard", tone: "success" });
        } catch {
          toast({ title: "Copy failed", tone: "danger" });
        }
      }}
    >
      <Icon icon={copied ? Check : Copy} size="sm" className={copied ? "text-positive" : undefined} />
      {label}
    </Button>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Badge tone="neutral" variant="outlined" className={cn("font-mono", className)}>
      {children}
    </Badge>
  );
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const STATUS_ORDER: Record<ClaimStatus, number> = {
  VERIFIED: 0,
  PARTIAL: 1,
  REJECTED: 2,
};

const STATUS_STYLES: Record<ClaimStatus, string> = {
  VERIFIED: "bg-positive-container text-on-positive-container",
  PARTIAL: "bg-premium-container text-on-premium-container",
  REJECTED: "bg-error-container text-on-error-container",
};

const PHASE_STYLES: Record<DemoScene["phase"], string> = {
  Hook: "bg-positive-container text-on-positive-container",
  Chaos: "bg-premium-container text-on-premium-container",
  Reveal: "bg-secondary-container text-on-secondary-container",
  Proof: "bg-tertiary-container text-on-tertiary-container",
  CTA: "bg-inverse-surface text-inverse-on-surface",
};

function scriptToMarkdown(script: DemoScript): string {
  const header = `# Demo Script — ${script.preset}\n\n> ${script.durationSec}s @ ${script.wpm} WPM · budget ${script.wordBudget} words · used ${script.wordsUsed}\n`;
  const scenes = script.scenes
    .map(
      (s) =>
        `## [${mmss(s.startSec)} - ${mmss(s.endSec)}] ${s.title} (${s.phase})\n\n${s.narration}\n\n> VISUAL: ${s.visual}\n`
    )
    .join("\n");
  const missing = script.missing.length
    ? `\n## MISSING (human input required)\n\n${script.missing.map((m) => `- ${m}`).join("\n")}\n`
    : "";
  return `${header}\n${scenes}${missing}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: README
// ─────────────────────────────────────────────────────────────────────────────

export function ReadmeTab({ project }: { project: ProjectResponse }) {
  const [mode, setMode] = useState("preview");
  const readme = project.data?.artifacts.readme ?? "";
  const hero = project.data?.artifacts.hero;
  const words = project.wordCount || readme.split(/\s+/).filter(Boolean).length;
  const readingMin = Math.max(1, Math.ceil(words / 220));

  // The README embeds raw HTML blocks (hero banner, star-history CTA) for GitHub.
  // react-markdown escapes raw HTML, so strip the hero block and unwrap the
  // remaining <div align="center"> wrappers for the on-screen preview only.
  const previewSource = useMemo(() => {
    const withoutHero = readme.replace(
      /<!--[\s\S]*?-->\s*<div align="center">[\s\S]*?<\/div>/,
      ""
    );
    return withoutHero.replace(/<div align="center">([\s\S]*?)<\/div>/g, "$1");
  }, [readme]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SegmentedButton
            label="README view"
            value={mode}
            onChange={setMode}
            options={[
              { value: "preview", label: "Preview" },
              { value: "raw", label: "Raw Markdown" },
            ]}
          />
          <Chip>{words} words</Chip>
          <Chip>~{readingMin} min read</Chip>
        </div>
        <CopyButton text={readme} label="Copy README" />
      </div>

      {mode === "preview" ? (
        <div className="flex flex-col gap-4">
          {hero && (
            <Card padding="md" className="flex flex-col gap-2">
              <p className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">
                Hero Banner (OG image block)
              </p>
              <div
                className="hero-html overflow-x-auto rounded-medium bg-surface-container-low"
                dangerouslySetInnerHTML={{ __html: hero.html }}
              />
            </Card>
          )}
          <Card padding="md" className="sm:p-6">
            <MarkdownView source={previewSource} />
          </Card>
        </div>
      ) : (
        <CodeBlock lang="text" className="max-h-[600px] overflow-y-auto">
          {readme}
        </CodeBlock>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Claim Ledger
// ─────────────────────────────────────────────────────────────────────────────

export function LedgerTab({ project }: { project: ProjectResponse }) {
  const ledger = project.data?.ledger;
  const sorted = useMemo(() => {
    if (!ledger) return [];
    return [...ledger.claims].sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    );
  }, [ledger]);

  const columns: Column<ClaimEntry>[] = useMemo(
    () => [
      {
        key: "status",
        header: "Status",
        cell: (claim) => (
          <Badge tone="neutral" className={cn("font-mono", STATUS_STYLES[claim.status])}>
            {claim.status}
          </Badge>
        ),
      },
      {
        key: "claim",
        header: "Claim",
        cell: (claim) => <span className="text-body-sm text-on-surface">{claim.claim}</span>,
      },
      {
        key: "category",
        header: "Category",
        cell: (claim) => (
          <span className="rounded-extra-small bg-surface-container-high px-1.5 py-0.5 font-mono text-label-sm text-on-surface-variant">
            {claim.category}
          </span>
        ),
      },
      {
        key: "confidence",
        header: "Confidence",
        cell: (claim) => (
          <div className="flex items-center gap-2">
            <Progress
              value={claim.confidence * 100}
              label={`Confidence ${claim.confidence.toFixed(2)}`}
              className="h-1 w-14"
            />
            <span className="font-mono text-label-sm tnum text-on-surface-variant">
              {claim.confidence.toFixed(2)}
            </span>
          </div>
        ),
      },
      {
        key: "evidence",
        header: "Evidence",
        cell: (claim) => {
          const commitHref = claim.commitSha
            ? `https://github.com/${project.owner}/${project.repo}/commit/${claim.commitSha}`
            : null;
          return commitHref ? (
            <a
              href={commitHref}
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-label-sm text-primary underline-offset-2 hover:underline"
            >
              {claim.evidence}
              <Icon icon={ExternalLink} size="sm" className="ml-1 inline h-3 w-3" />
            </a>
          ) : (
            <span className="break-all font-mono text-label-sm text-on-surface-variant">
              {claim.evidence}
            </span>
          );
        },
      },
      {
        key: "reason",
        header: "Reason",
        hideOnPhone: true,
        cell: (claim) => <span className="text-body-sm text-on-surface-variant">{claim.reason}</span>,
      },
    ],
    [project.owner, project.repo]
  );

  if (!ledger) return null;
  const { summary } = ledger;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Chip>{summary.total} claims</Chip>
        <Chip className="text-positive">{summary.verified} VERIFIED</Chip>
        <Chip className="text-premium">{summary.partial} PARTIAL</Chip>
        <Chip className="text-error">{summary.rejected} REJECTED</Chip>
      </div>

      <Alert tone="success" title="Zero-Trust receipt">
        Every claim is cross-referenced against commits, manifests and files.
        REJECTED claims are never rendered into outputs.
      </Alert>

      <div className="max-h-96 overflow-y-auto">
        <Table
          label="Claim ledger"
          columns={columns}
          rows={sorted}
          rowKey={(claim) => claim.id}
          empty={
            <p className="p-8 text-center text-body-sm text-on-surface-variant">
              No claims recorded.
            </p>
          }
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Demo Script
// ─────────────────────────────────────────────────────────────────────────────

export function DemoTab({ project }: { project: ProjectResponse }) {
  const script = project.data?.artifacts.demoScript;
  if (!script) return null;
  const preset = getPreset(script.preset);
  const overBudget = script.wordsUsed > script.wordBudget;
  const budgetPct = Math.min(100, Math.round((script.wordsUsed / Math.max(1, script.wordBudget)) * 100));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip>
          <span>{preset.emoji}</span>
          {preset.label}
        </Chip>
        <Chip>
          {script.durationSec}s @ {script.wpm} WPM
        </Chip>
        <div className="flex min-w-52 flex-1 items-center gap-2 sm:max-w-72">
          <Progress
            value={budgetPct}
            label="Word budget usage"
            className="h-1.5 flex-1"
          />
          <span
            className={cn(
              "font-mono text-label-sm",
              overBudget ? "text-error" : "text-positive"
            )}
          >
            {script.wordsUsed}/{script.wordBudget} words
          </span>
        </div>
        <CopyButton text={scriptToMarkdown(script)} label="Copy script" />
      </div>

      {script.missing.length > 0 && (
        <Alert tone="warning" title={`MISSING: ${script.missing.join(" · ")}`}>
          A human must add these — ShipOS refuses to invent them.
        </Alert>
      )}

      <div className="flex flex-col">
        {script.scenes.map((scene, i) => (
          <div key={scene.index} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <span className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-container font-mono text-label-sm text-on-primary-container">
                {String(scene.index).padStart(2, "0")}
              </span>
              {i < script.scenes.length - 1 && (
                <span className="w-px flex-1 bg-surface-container-highest" />
              )}
            </div>
            <Card padding="md" className="mb-4 flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-body-sm text-on-surface-variant">
                  {mmss(scene.startSec)} – {mmss(scene.endSec)}
                </span>
                <Badge tone="neutral" className={PHASE_STYLES[scene.phase]}>
                  {scene.phase}
                </Badge>
                <span className="ml-auto font-mono text-label-sm text-on-surface-variant/70">
                  {scene.words} words
                </span>
              </div>
              <p className="text-body-md font-semibold text-on-surface">{scene.title}</p>
              <p className="text-body-md leading-relaxed text-on-surface">{scene.narration}</p>
              <p className="flex items-start gap-1.5 font-mono text-label-md leading-relaxed text-on-surface-variant">
                <Icon icon={Film} size="sm" className="mt-0.5 shrink-0 text-on-surface-variant/70" />
                <span>
                  <span className="text-on-surface-variant/70">VISUAL:</span> {scene.visual}
                </span>
              </p>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Pitch Deck
// ─────────────────────────────────────────────────────────────────────────────

export function DeckTab({ project }: { project: ProjectResponse }) {
  const deck = project.data?.artifacts.deck;
  const [mode, setMode] = useState("slides");
  if (!deck) return null;
  const deckFilename = `${project.owner}-${project.repo}-deck.md`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedButton
          label="Deck view"
          value={mode}
          onChange={setMode}
          options={[
            { value: "slides", label: "Slides" },
            { value: "markdown", label: "View markdown" },
          ]}
        />
        <Button
          size="xs"
          variant="outlined"
          icon={Download}
          onClick={() => {
            downloadText(deckFilename, deck.markdown);
            toast({ title: "Deck downloaded", description: deckFilename, tone: "success" });
          }}
        >
          Download .md
        </Button>
      </div>

      {mode === "slides" ? (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
          {deck.slides.map((slide) => (
            <Card
              key={slide.index}
              padding="md"
              className="flex min-w-[260px] max-w-[320px] shrink-0 snap-start flex-col gap-3 sm:min-w-[300px]"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-display-sm text-primary/70">
                  {String(slide.index).padStart(2, "0")}
                </span>
                <span className="font-mono text-label-sm text-on-surface-variant/70">
                  slide {slide.index}/{deck.slides.length}
                </span>
              </div>
              <p className="text-body-md font-semibold leading-snug text-on-surface">{slide.title}</p>
              <ul className="flex flex-col gap-1.5">
                {slide.bullets.map((bullet, bi) => (
                  <li key={bi} className="flex items-start gap-1.5 text-body-sm leading-relaxed text-on-surface">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <p className="mt-auto border-t border-outline-variant pt-2 text-body-sm leading-relaxed text-on-surface-variant">
                <span className="font-mono text-label-sm text-on-surface-variant/70">NOTES: </span>
                {slide.notes}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <CodeBlock lang="text" className="max-h-[600px] overflow-y-auto">
          {deck.markdown}
        </CodeBlock>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Report (+ Viva Prep)
// ─────────────────────────────────────────────────────────────────────────────

export function ReportTab({ project }: { project: ProjectResponse }) {
  const report = project.data?.artifacts.report ?? "";
  const viva = project.data?.artifacts.vivaPrep ?? "";
  const [mode, setMode] = useState("preview");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedButton
          label="Report view"
          value={mode}
          onChange={setMode}
          options={[
            { value: "preview", label: "Preview" },
            { value: "raw", label: "Raw Markdown" },
          ]}
        />
        <CopyButton text={report} label="Copy report" />
      </div>

      {mode === "preview" ? (
        <Card padding="md" className="sm:p-6">
          <MarkdownView source={report} />
        </Card>
      ) : (
        <CodeBlock lang="text" className="max-h-[600px] overflow-y-auto">
          {report}
        </CodeBlock>
      )}

      <Card padding="md" className="flex flex-col gap-3 sm:p-6">
        <div className="flex items-center gap-2">
          <Icon icon={ShieldCheck} size="sm" className="text-positive" />
          <p className="text-body-md font-semibold text-on-surface">Viva Prep</p>
          <span className="font-mono text-label-sm text-on-surface-variant/70">
            {"// anticipated questions"}
          </span>
        </div>
        <MarkdownView source={viva} />
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: SEO Report
// ─────────────────────────────────────────────────────────────────────────────

export function SeoTab({ project }: { project: ProjectResponse }) {
  const seo = project.data?.scores.seo;
  if (!seo) return null;
  const passed = seo.checks.filter((c) => c.pass).length;

  return (
    <div className="flex flex-col gap-4">
      <Card padding="md" className="flex flex-wrap items-center gap-6 sm:p-6">
        <div>
          <p className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">
            SEO Score
          </p>
          <p className="font-mono text-display-md">
            <span className={seo.score >= 70 ? "text-positive" : seo.score >= 40 ? "text-premium" : "text-error"}>
              {seo.score}
            </span>
            <span className="text-title-lg font-normal text-on-surface-variant">/100</span>
          </p>
        </div>
        <div className="h-10 w-px bg-surface-container-highest" />
        <p className="text-body-md text-on-surface-variant">
          <span className="font-mono text-positive">{passed}</span> passed ·{" "}
          <span className="font-mono text-error">{seo.checks.length - passed}</span> failed
        </p>
      </Card>

      <Card padding="md" className="sm:p-6">
        <div className="flex flex-col">
          {seo.checks.map((check, i) => (
            <div
              key={check.id}
              className={cn(
                "flex items-start gap-3 py-3",
                i < seo.checks.length - 1 && "border-b border-outline-variant"
              )}
            >
              <Icon
                icon={check.pass ? CheckCircle2 : XCircle}
                size="sm"
                className={cn("mt-0.5 shrink-0", check.pass ? "text-positive" : "text-error")}
              />
              <div className="flex flex-col gap-0.5">
                <p className="text-body-md font-medium text-on-surface">{check.label}</p>
                <p className="text-body-sm text-on-surface-variant">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Repo Health
// ─────────────────────────────────────────────────────────────────────────────

export function HealthTab({ project }: { project: ProjectResponse }) {
  const health = project.data?.scores.health;
  if (!health) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {health.pillars.map((pillar) => {
          const pct = Math.round((pillar.score / Math.max(1, pillar.max)) * 100);
          return (
            <Card key={pillar.name} padding="md" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-body-md font-semibold text-on-surface">{pillar.name}</p>
                <span className="font-mono text-body-md text-on-surface">
                  {pillar.score}
                  <span className="text-on-surface-variant/70">/{pillar.max}</span>
                </span>
              </div>
              <Progress
                value={pct}
                label={`${pillar.name} ${pillar.score} of ${pillar.max}`}
                className="h-1.5"
              />
              <p className="text-body-sm text-on-surface-variant">{pillar.detail}</p>
            </Card>
          );
        })}
      </div>

      {health.fixes.length > 0 ? (
        <Alert tone="warning" title="Prescribed fixes">
          <ul className="list-disc pl-4">
            {health.fixes.map((fix, i) => (
              <li key={i}>{fix}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert tone="success" title="All pillars green — submission ready.">
          {""}
        </Alert>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Export /dist
// ─────────────────────────────────────────────────────────────────────────────

interface DistFile {
  path: string;
  icon: IconGlyph;
  content: string;
}

export function ExportTab({ project }: { project: ProjectResponse }) {
  const data = project.data;
  if (!data) return null;
  const { artifacts, ledger, repo } = data;

  const distFiles: DistFile[] = [
    { path: "README.md", icon: FileText, content: artifacts.readme },
    { path: "demo/script.md", icon: Code2, content: scriptToMarkdown(artifacts.demoScript) },
    { path: "demo/storyboard.json", icon: FileJson, content: artifacts.storyboardJson },
    { path: "demo/claim_ledger.json", icon: FileJson, content: JSON.stringify(ledger, null, 2) },
    { path: "deck/slides.md", icon: Code2, content: artifacts.deck.markdown },
    { path: "deck/speaker_notes.txt", icon: FileText, content: artifacts.deck.speakerNotes },
    { path: "report/project_report.md", icon: FileText, content: artifacts.report },
    { path: "report/viva_preparation.md", icon: FileText, content: artifacts.vivaPrep },
    { path: "compliance/submission_checklist.md", icon: FileCheck, content: artifacts.checklist.markdown },
    { path: "badges/hero-banner.html", icon: Braces, content: artifacts.hero.html },
    { path: "repo.json", icon: FileJson, content: JSON.stringify(repo, null, 2) },
  ];

  const downloadZip = () => {
    window.location.href = `/api/projects/${project.id}/export`;
    toast({ title: "Export started", description: "Downloading /dist as .zip", tone: "success" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-label-md text-on-surface-variant">
          {"// everything below is byte-identical to the zip"}
        </p>
        <Button size="xs" icon={Package} onClick={downloadZip}>
          Download all (.zip)
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Terminal file tree */}
        <Card padding="md" className="flex flex-1 flex-col gap-3">
          <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            <Icon icon={FolderOpen} size="sm" />
            dist tree
          </p>
          <CodeBlock lang="text" className="max-h-96 overflow-y-auto">
            {artifacts.distTree}
          </CodeBlock>
        </Card>

        {/* File rows */}
        <Card padding="md" className="flex flex-1 flex-col gap-3">
          <p className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            {distFiles.length} files
          </p>
          <div className="flex max-h-96 flex-col divide-y divide-outline-variant overflow-y-auto">
            {distFiles.map((file) => (
              <div key={file.path} className="flex items-center gap-3 py-2.5">
                <Icon icon={file.icon} size="sm" className="shrink-0 text-on-surface-variant" />
                <span className="truncate font-mono text-body-sm text-on-surface">{file.path}</span>
                <span className="ml-auto shrink-0 font-mono text-label-sm text-on-surface-variant/70">
                  {Math.max(1, Math.round(file.content.length / 1024))} KB
                </span>
                <IconButton
                  icon={Download}
                  label={`Download ${file.path}`}
                  variant="standard"
                  size="sm"
                  onClick={() => {
                    downloadText(file.path.replace(/\//g, "-"), file.content);
                    toast({ title: "Downloaded", description: file.path, tone: "success" });
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

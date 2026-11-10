"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Code2,
  Database,
  Download,
  ExternalLink,
  Eye,
  Film,
  Globe,
  ImageIcon,
  Languages,
  Layers,
  Mic,
  Search,
  ShieldAlert,
  Star,
  Trophy,
  Type,
  Video,
  Zap,
} from "@/ui/symbols";
import { Badge, Button, Card, Chip, Icon, PageHeader, Section, Table } from "@/ui";
import type { IconGlyph } from "@/ui";
import {
  KIND_META,
  MODEL_CAVEAT,
  MODEL_FAMILIES,
  MODEL_RADAR_DATE,
  MODEL_TRACKERS,
  NEW_MODELS,
  QUICK_PICKS,
  SHIPOS_STACK,
  SPECIALIZED_MODELS,
  type HfModel,
  type ModelKind,
} from "@/lib/shipos/hf-models";

// ─────────────────────────────────────────────────────────────────────────────
// ModelRadarTab — the free/open Hugging Face landscape, November 2026.
// 100 models: the 25 newest releases, 10 trending specialists, the established
// families — plus the $0 stack that maps onto ShipOS's own engines.
// ─────────────────────────────────────────────────────────────────────────────

const KIND_ICON: Record<ModelKind, IconGlyph> = {
  text: Type,
  multimodal: Layers,
  vision: Eye,
  video: Video,
  image: ImageIcon,
  audio: Mic,
  ocr: Search,
  embedding: Database,
  code: Code2,
  science: Brain,
};

type ModelRow = HfModel;

function LicenseBadge({ license, gated }: { license: string; gated?: boolean }) {
  const permissive = /^(MIT|Apache-2\.0|OpenMDW-1\.1)/.test(license) && !gated;
  if (gated) {
    return (
      <Badge tone="error" variant="outlined" icon={ShieldAlert}>
        gated
      </Badge>
    );
  }
  return (
    <Badge tone={permissive ? "secondary" : "neutral"} variant={permissive ? "tonal" : "outlined"}>
      {license}
    </Badge>
  );
}

function ModelLink({ model }: { model: string }) {
  return (
    <a
      href={`https://huggingface.co/models?search=${encodeURIComponent(model)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-label-lg font-medium text-primary hover:underline"
    >
      {model}
      <Icon icon={ExternalLink} size="sm" />
    </a>
  );
}

const FILTERS: ("all" | ModelKind)[] = [
  "all",
  "text",
  "multimodal",
  "vision",
  "video",
  "image",
  "audio",
  "ocr",
  "embedding",
  "code",
];

export function ModelRadarTab({ onBack }: { onBack?: () => void }) {
  const [filter, setFilter] = useState<"all" | ModelKind>("all");

  const newRows = useMemo(
    () => (filter === "all" ? NEW_MODELS : NEW_MODELS.filter((m) => m.kind === filter)),
    [filter],
  );
  const specRows = useMemo(
    () => (filter === "all" ? SPECIALIZED_MODELS : SPECIALIZED_MODELS.filter((m) => m.kind === filter)),
    [filter],
  );

  const modelColumns = [
    {
      key: "rank",
      header: "#",
      cell: (row: ModelRow) => (
        <span className="font-mono text-label-md text-on-surface-variant">{row.rank}</span>
      ),
      numeric: true,
      width: "44px",
    },
    {
      key: "model",
      header: "Model",
      cell: (row: ModelRow) => <ModelLink model={row.model} />,
    },
    {
      key: "org",
      header: "Org",
      cell: (row: ModelRow) => <span className="whitespace-nowrap text-on-surface-variant">{row.org}</span>,
      hideOnPhone: true,
    },
    {
      key: "size",
      header: "Size",
      cell: (row: ModelRow) => (
        <span className="whitespace-nowrap font-mono text-label-md text-on-surface-variant">{row.size}</span>
      ),
      hideOnPhone: true,
    },
    {
      key: "license",
      header: "License",
      cell: (row: ModelRow) => <LicenseBadge license={row.license} gated={row.gated} />,
    },
    {
      key: "kind",
      header: "Kind",
      cell: (row: ModelRow) => (
        <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
          <Icon icon={KIND_ICON[row.kind]} size="sm" />
          {KIND_META[row.kind].label}
        </span>
      ),
      hideOnPhone: true,
    },
    {
      key: "notes",
      header: "Notes",
      cell: (row: ModelRow) => <span className="text-on-surface-variant">{row.notes}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Model Radar"
        breadcrumb={
          onBack ? (
            <Button variant="text" size="xs" icon={ArrowLeft} onClick={onBack}>
              Full Package
            </Button>
          ) : undefined
        }
        description={`The free/open Hugging Face landscape as of ${MODEL_RADAR_DATE}: ${NEW_MODELS.length} newest open-weight releases, ${SPECIALIZED_MODELS.length} trending specialists, ${MODEL_FAMILIES.reduce((n, f) => n + f.models.length, 0)} established family entries — and the $0 stack that maps onto ShipOS's own engines.`}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={Brain} size="sm" />
              100 models · {MODEL_RADAR_DATE} snapshot
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={Zap} size="sm" />
              MIT / Apache-2.0 first
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={ShieldAlert} size="sm" />
              gated releases flagged
            </span>
          </>
        }
      />

      {/* ── Quick picks ───────────────────────────────────────────────────── */}
      <Section
        title="Quick picks"
        description="Five decisions, pre-made: the models to reach for first, per use case."
        actions={<Badge tone="premium" icon={Trophy}>bookmarked</Badge>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {QUICK_PICKS.map((q) => (
            <Card key={q.label} className="flex flex-col gap-2">
              <p className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
                {q.label}
              </p>
              <p className="text-title-md text-primary">{q.pick}</p>
              <p className="mt-auto text-body-sm text-on-surface-variant">{q.why}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── Newest releases ───────────────────────────────────────────────── */}
      <Section
        title="Newest open-weight releases — Oct–Nov 2026"
        description="Everything that landed in the last six weeks, ranked by impact. Filter by kind; license badges tell you what is actually safe to ship."
        actions={<Badge tone="neutral">{newRows.length} shown</Badge>}
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter models by kind">
          {FILTERS.map((f) => (
            <Chip
              key={f}
              kind={filter === f ? "filter" : "assist"}
              selected={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? `All ${NEW_MODELS.length}` : KIND_META[f].label}
            </Chip>
          ))}
        </div>
        <Table<ModelRow>
          label="Newest open-weight Hugging Face models"
          columns={modelColumns}
          rows={newRows}
          rowKey={(row) => String(row.rank)}
        />
      </Section>

      {/* ── Specialized ───────────────────────────────────────────────────── */}
      {specRows.length > 0 && (
        <Section
          title="Trending non-text / specialized"
          description="Video, image, audio, OCR, embeddings, genomics — the lanes that feed creative pipelines like ShipOS's."
        >
          <Table<ModelRow>
            label="Trending specialized Hugging Face models"
            columns={modelColumns}
            rows={specRows}
            rowKey={(row) => String(row.rank)}
          />
        </Section>
      )}

      {/* ── Families ──────────────────────────────────────────────────────── */}
      <Section
        title="The established families"
        description="The rest of the ~100: open-weight lines to know by name, grouped by house."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MODEL_FAMILIES.map((family) => (
            <Card key={family.id} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <p className="text-title-md text-on-surface">{family.label}</p>
                <Badge tone="neutral" className="ml-auto">
                  {family.models.length}
                </Badge>
              </div>
              <p className="text-body-sm text-on-surface-variant">{family.blurb}</p>
              <ol className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                {family.models.map((m) => (
                  <li key={m.name} className="min-w-0 rounded-small bg-surface-container-high px-2.5 py-2">
                    <p className="break-words font-mono text-label-md text-on-surface">{m.name}</p>
                    {m.note && (
                      <p className="mt-0.5 text-label-sm text-on-surface-variant">{m.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── The $0 stack behind ShipOS ────────────────────────────────────── */}
      <Section
        title="The $0 stack that powers ShipOS"
        description="How the open landscape maps onto this app's engines — swap any of these in behind the deterministic fallbacks."
        actions={<Badge tone="primary" icon={Zap}>zero-dollars</Badge>}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SHIPOS_STACK.map((s) => (
            <Card key={s.engine} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon icon={KIND_ICON[s.kind]} size="md" className="text-primary" />
                <p className="text-title-sm text-on-surface">{s.engine}</p>
              </div>
              <p className="font-mono text-label-md leading-relaxed text-primary">{s.models}</p>
              <p className="mt-auto border-t border-outline-variant/40 pt-2 text-body-sm text-on-surface-variant">
                {s.note}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── Trackers + caveat ─────────────────────────────────────────────── */}
      <Section title="Live trackers" description="Where this snapshot came from — bookmark these to stay current.">
        <div className="grid gap-3 md:grid-cols-3">
          {MODEL_TRACKERS.map((t) => (
            <a
              key={t.name}
              href={t.href}
              target="_blank"
              rel="noreferrer"
              className="group rounded-medium outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Card className="flex items-center gap-3 transition-transform group-hover:-translate-y-0.5">
                <Icon icon={Globe} size="md" className="text-primary" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-label-lg text-on-surface">{t.name}</p>
                  <p className="text-label-md text-on-surface-variant">{t.note}</p>
                </div>
                <Icon icon={ExternalLink} size="sm" className="ml-auto text-on-surface-variant" />
              </Card>
            </a>
          ))}
        </div>
        <Card padding="md" className="flex items-start gap-3 border border-error/30 bg-error-container/20">
          <Icon icon={ShieldAlert} size="md" className="mt-0.5 shrink-0 text-error" />
          <p className="text-body-sm text-on-surface-variant">{MODEL_CAVEAT}</p>
        </Card>
      </Section>

      {/* ── Positioning line ──────────────────────────────────────────────── */}
      <Card padding="lg" className="flex flex-col items-start gap-3 bg-primary-container/40 sm:flex-row sm:items-center">
        <Icon icon={Download} size="lg" className="text-premium" />
        <div className="min-w-0">
          <p className="text-title-lg text-on-surface">
            Open weights closed the gap. <span className="text-primary">ShipOS turns them into shipped products.</span>
          </p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            MIT and Apache-2.0 models cover the whole pipeline now — writing, voice, vision, search. The moat is no longer the model; it is the audit → optimize → film → render loop around it.
          </p>
        </div>
      </Card>
    </div>
  );
}

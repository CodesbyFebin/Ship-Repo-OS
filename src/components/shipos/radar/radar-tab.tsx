"use client";

import { ArrowLeft, Check, Minus, X, ExternalLink, Star, Trophy, Globe, Zap, Layers, Film, Cloud, Rocket, ScanLine, Wand2, Target, TrendingUp } from "@/ui/symbols";
import { Badge, Button, Card, Icon, PageHeader, Section, Table } from "@/ui";
import type { IconGlyph } from "@/ui";
import type { CategoryId, MatrixMark } from "@/lib/shipos/competitors";
import {
  ADOPT_SIGNALS,
  CATEGORY_DETAILS,
  CATEGORY_META,
  COMPETITORS,
  DIFFERENTIATORS,
  FIELD_PATTERNS,
  LEADERBOARD,
  LEADERBOARD_DATE,
  MATRIX_ROWS,
  SURVEY_NOTE,
} from "@/lib/shipos/competitors";

// ─────────────────────────────────────────────────────────────────────────────
// RadarTab — Competitor Radar. The Nov-8 leaderboard, the category map, the
// field patterns, and the feature matrix — with the six places ShipOS answers
// the whole field.
// ─────────────────────────────────────────────────────────────────────────────

const DIFF_ICON: Record<string, IconGlyph> = {
  scan: ScanLine,
  wand: Wand2,
  film: Film,
  cloud: Cloud,
  layers: Layers,
  rocket: Rocket,
};

function Mark({ mark }: { mark: MatrixMark }) {
  if (mark === "full") {
    return (
      <span className="inline-flex items-center gap-1 text-primary">
        <Icon icon={Check} size="sm" />
        <span className="sr-only">yes</span>
      </span>
    );
  }
  if (mark === "partial") {
    return (
      <span className="inline-flex items-center gap-1 text-on-surface-variant">
        <Icon icon={Minus} size="sm" />
        <span className="sr-only">partial</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-on-surface-variant opacity-60">
      <Icon icon={X} size="sm" />
      <span className="sr-only">no</span>
    </span>
  );
}

function ToolHead({ tool }: { tool: (typeof COMPETITORS)[number] }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span>{tool.name}</span>
      {tool.stars !== "—" && (
        <span className="inline-flex items-center gap-0.5 text-label-sm text-on-surface-variant">
          <Icon icon={Star} size="sm" />
          {tool.stars}
        </span>
      )}
    </span>
  );
}

type MatrixRow = (typeof MATRIX_ROWS)[number];
type LeaderRow = (typeof LEADERBOARD)[number];

export function RadarTab({ onBack }: { onBack?: () => void }) {
  const matrixColumns = [
    {
      key: "capability",
      header: "Capability",
      cell: (row: MatrixRow) => <span className="text-on-surface">{row.capability}</span>,
      width: "250px",
    },
    {
      key: "shipos",
      header: <span className="font-medium text-primary">ShipOS</span>,
      cell: (row: MatrixRow) => <Mark mark={row.cells.shipos} />,
    },
    ...COMPETITORS.map((tool, i) => ({
      key: tool.id,
      header: <ToolHead tool={tool} />,
      cell: (row: MatrixRow) => <Mark mark={row.cells[tool.id] ?? "none"} />,
      hideOnPhone: i > 2, // keep OpenMontage · HyperFrames · brag on phones
    })),
  ];

  const leaderboardColumns = [
    {
      key: "rank",
      header: "#",
      cell: (row: LeaderRow) => <span className="font-mono text-label-md text-on-surface-variant">{row.rank}</span>,
      numeric: true,
      width: "48px",
    },
    {
      key: "repo",
      header: "Repo",
      cell: (row: LeaderRow) => (
        <a
          href={row.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-label-lg font-medium text-primary hover:underline"
        >
          {row.repo}
          <Icon icon={ExternalLink} size="sm" />
        </a>
      ),
    },
    {
      key: "stars",
      header: "Stars",
      cell: (row: LeaderRow) => (
        <span className="inline-flex items-center gap-1 tabular-nums text-on-surface">
          <Icon icon={Star} size="sm" className="text-premium" />
          {row.stars}
        </span>
      ),
      numeric: true,
    },
    {
      key: "velocity",
      header: "Velocity",
      cell: (row: LeaderRow) => (
        <span className="inline-flex items-center gap-1 text-label-md text-on-surface-variant">
          <Icon icon={TrendingUp} size="sm" />
          {row.velocity}
        </span>
      ),
      hideOnPhone: true,
    },
    {
      key: "what",
      header: "What it does",
      cell: (row: LeaderRow) => <span className="text-on-surface-variant">{row.what}</span>,
    },
    {
      key: "category",
      header: "Category",
      cell: (row: LeaderRow) => (
        <Badge tone={row.category === ("launch" as CategoryId) ? "primary" : "neutral"}>
          {CATEGORY_META[row.category].label}
        </Badge>
      ),
      hideOnPhone: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Competitor Radar"
        breadcrumb={
          onBack ? (
            <Button variant="text" size="xs" icon={ArrowLeft} onClick={onBack}>
              Full Package
            </Button>
          ) : undefined
        }
        description="The repo-to-video niche just had its biggest week yet — and the center of gravity shifted from AI video generation to code + agent skills. Here is the field, and the six doors it leaves open that ShipOS walks through."
        meta={
          <>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={Globe} size="sm" />
              15 repos · {LEADERBOARD_DATE}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={Target} size="sm" />
              11 capabilities compared
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon icon={Zap} size="sm" />
              the only audit → optimize → film pipeline
            </span>
          </>
        }
      />

      {/* ── Leaderboard ───────────────────────────────────────────────────── */}
      <Section
        title={`Leaderboard — ${LEADERBOARD_DATE}`}
        description="The trending 15. Every repo in the table ships video; none of them score or optimize what they film."
      >
        <Table<LeaderRow>
          label="Repo-to-video trending leaderboard"
          columns={leaderboardColumns}
          rows={LEADERBOARD}
          rowKey={(row) => row.repo}
        />
      </Section>

      {/* ── Category map ──────────────────────────────────────────────────── */}
      <Section
        title="By category"
        description="Five families cover the whole field. ShipOS competes in launch promo — and outflanks every family from above."
      >
        <div className="flex flex-col gap-3">
          {CATEGORY_DETAILS.map((cat) => (
            <Card key={cat.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-title-md text-on-surface">{CATEGORY_META[cat.id].label}</p>
                <p className="text-body-sm text-on-surface-variant">{CATEGORY_META[cat.id].blurb}</p>
                <Badge tone={cat.id === ("launch" as CategoryId) ? "primary" : "neutral"} className="ml-auto">
                  {cat.tools.length} tracked
                </Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                {cat.tools.map((tool) => (
                  <div key={tool.name} className="rounded-small bg-surface-container-high p-3">
                    <p className="font-mono text-label-lg font-semibold text-primary">{tool.name}</p>
                    <p className="mt-1 text-body-sm text-on-surface-variant">{tool.note}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── Patterns ──────────────────────────────────────────────────────── */}
      <Section
        title="What the pattern tells us"
        description="Four signals from the week — and what ShipOS already ships, or has slotted, in answer."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {FIELD_PATTERNS.map((p) => (
            <Card key={p.n} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-container font-mono text-label-lg font-bold text-on-primary-container">
                  {p.n}
                </span>
                <p className="text-title-md text-on-surface">{p.title}</p>
              </div>
              <p className="text-body-sm text-on-surface-variant">{p.body}</p>
              <p className="mt-auto border-t border-outline-variant/40 pt-2 text-body-sm text-on-surface">
                <span className="font-medium text-primary">ShipOS:</span> {p.shipos}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── Feature matrix ────────────────────────────────────────────────── */}
      <Section
        title="Feature matrix — the deep compare"
        description="Eleven capabilities that decide whether a repo video is worth shipping. ShipOS is the only column with no red."
      >
        <Table
          label="ShipOS vs the field, capability by capability"
          columns={matrixColumns}
          rows={MATRIX_ROWS}
          rowKey={(row) => row.capability}
        />
        <p className="mt-2 text-label-md text-on-surface-variant">{SURVEY_NOTE}</p>
      </Section>

      {/* ── Where ShipOS wins ─────────────────────────────────────────────── */}
      <Section
        title="Where ShipOS wins"
        description="The six differentiators no repo in the leaderboard combines."
        actions={
          <Badge tone="premium" icon={Trophy}>
            category of one
          </Badge>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DIFFERENTIATORS.map((diff, i) => (
            <Card key={diff.title} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon icon={DIFF_ICON[diff.icon] ?? Zap} size="md" className="text-primary" />
                <p className="text-title-md text-on-surface">{diff.title}</p>
                <span className="ml-auto font-mono text-label-sm text-on-surface-variant">0{i + 1}</span>
              </div>
              <p className="text-body-sm text-on-surface-variant">{diff.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── Signals → roadmap ─────────────────────────────────────────────── */}
      <Section
        title="Signals from the field → the roadmap"
        description="Two shipped, the rest slotted into tiers — the leaderboard is the backlog now."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ADOPT_SIGNALS.map((signal) => (
            <Card
              key={signal.title}
              surface={signal.status === "shipped" ? "card" : "high"}
              className="flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-title-sm text-on-surface">{signal.title}</p>
                <Badge
                  tone={signal.status === "shipped" ? "tertiary" : "neutral"}
                  variant={signal.status === "shipped" ? "tonal" : "outlined"}
                >
                  {signal.status === "shipped" ? "shipped" : "planned"}
                </Badge>
                <Badge tone={signal.tier === "FREE" ? "secondary" : "premium"} variant="outlined" className="ml-auto">
                  {signal.tier}
                </Badge>
              </div>
              <p className="text-label-md text-on-surface-variant">via {signal.source}</p>
              <p className="mt-auto text-body-sm text-on-surface-variant">{signal.detail}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── Positioning line ──────────────────────────────────────────────── */}
      <Card padding="lg" className="flex flex-col items-start gap-3 bg-primary-container/40 sm:flex-row sm:items-center">
        <Icon icon={Trophy} size="lg" className="text-premium" />
        <div className="min-w-0">
          <p className="text-title-lg text-on-surface">
            The field films repos. <span className="text-primary">ShipOS scores them, sells them, and ships the distribution pack.</span>
          </p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Audit → Optimization (SEO · AEO · GEO → 100/100) → Demo Maker (repo URL → 5-min film) → Render Cloud (4K on free ZeroGPU) — one pipeline, fifteen tools' worth of surface.
          </p>
        </div>
      </Card>
    </div>
  );
}

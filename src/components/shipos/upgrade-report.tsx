"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  ArrowRight,
  Award,
  Beaker,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Image as ImageIcon,
  Lightbulb,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  XCircle,
} from "@/ui/symbols";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Icon,
  SegmentedButton,
  Tabs,
  TabPanel,
  type BadgeTone,
  type Glyph,
} from "@/ui";
import type { AuditCategory, AuditTier, ReadmeAudit, UpgradeJobResponse } from "@/lib/shipos/upgrade-types";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/shipos/dashboard-tabs";

// ─────────────────────────────────────────────────────────────────────────────
// UpgradeReport — the before/after scorecard + generated 100/100 README
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, Glyph> = {
  FileText,
  FlaskConical: Beaker,
  Award,
  Download,
  Terminal,
  ImageIcon,
  ShieldCheck,
  Rocket,
};

const TIER_TONE: Record<AuditTier, BadgeTone> = {
  Platinum: "primary",
  Gold: "premium",
  Silver: "neutral",
  Bronze: "tertiary",
};

type ReportTab = "readme" | "markdown" | "fixes" | "original";

function scoreColor(score: number): { stroke: string; text: string } {
  if (score >= 90) return { stroke: "rgb(var(--md-sys-color-positive-rgb))", text: "text-positive" };
  if (score >= 70) return { stroke: "rgb(var(--md-sys-color-premium-rgb))", text: "text-premium" };
  if (score >= 50) return { stroke: "rgb(var(--md-sys-color-on-surface-variant-rgb))", text: "text-on-surface-variant" };
  return { stroke: "rgb(var(--md-sys-color-error-rgb))", text: "text-error" };
}

function ScoreGauge({ score, label, tier, small }: { score: number; label: string; tier?: AuditTier; small?: boolean }) {
  const { stroke, text } = scoreColor(score);
  const size = small ? 96 : 148;
  const strokeW = small ? 7 : 10;
  const r = (size - strokeW) / 2;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeW} className="text-surface-container-highest" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
            initial={{ strokeDasharray: `0 ${c}` }}
            animate={{ strokeDasharray: `${filled} ${c}` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className={cn("tnum font-mono font-bold leading-none", small ? "text-title-lg" : "text-display-sm", text)}
          >
            {score}
          </motion.span>
          {!small && <span className="font-mono text-label-sm text-on-surface-variant">/ 100</span>}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">{label}</span>
        {tier && <Badge tone={TIER_TONE[tier]} size="sm">{tier}</Badge>}
      </div>
    </div>
  );
}

const mdComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

/** GitHub-safe markdown → preview-safe markdown (strip hero HTML, unfold <details>). */
function toPreviewSource(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->\s*<div align="center">[\s\S]*?<\/div>/, "")
    .replace(/<div align="center">([\s\S]*?)<\/div>/g, "$1")
    .replace(/<details><summary><strong>([\s\S]*?)<\/strong><\/summary>/g, "**$1**\n")
    .replace(/<\/details>/g, "")
    .replace(/<\/?sub>/g, "")
    .replace(/<\/?i>/g, "")
    .trim();
}

function MarkdownView({ source }: { source: string }) {
  return (
    <div className="md-body text-body-sm">
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

// ── Category breakdown card ──────────────────────────────────────────────────

function CategoryCard({ cat, delay }: { cat: AuditCategory; delay: number }) {
  const CatIcon = CATEGORY_ICONS[cat.icon] ?? FileText;
  const pct = cat.max ? Math.round((cat.score / cat.max) * 100) : 0;
  const failed = cat.checks.filter((c) => !c.pass);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-small",
                pct === 100 ? "bg-positive-container text-on-positive-container" : "bg-surface-container-highest text-on-surface-variant"
              )}
            >
              <Icon icon={CatIcon} size="sm" className="h-3.5 w-3.5" />
            </span>
            <span className="truncate text-body-md font-semibold text-on-surface">{cat.name}</span>
          </div>
          <span
            className={cn(
              "shrink-0 font-mono text-body-md font-bold tnum",
              pct === 100 ? "text-positive" : pct >= 50 ? "text-tertiary" : "text-error"
            )}
          >
            {cat.score}
            <span className="text-label-md text-on-surface-variant">/{cat.max}</span>
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
          <motion.div
            className={cn("h-full rounded-full", pct === 100 ? "bg-positive" : pct >= 50 ? "bg-tertiary" : "bg-error")}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: delay + 0.15, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1 text-body-sm">
          {cat.checks.map((check) => (
            <div key={check.id} className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                {check.pass ? (
                  <Icon icon={CheckCircle2} size="sm" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
                ) : (
                  <Icon icon={XCircle} size="sm" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("leading-snug", check.pass ? "text-on-surface-variant" : "text-on-surface")}>
                    {check.label} <span className="tnum font-mono text-label-sm text-on-surface-variant/60">+{check.weight}</span>
                  </p>
                  <p className="truncate font-mono text-label-sm text-on-surface-variant" title={check.detail}>
                    {check.detail}
                  </p>
                </div>
              </div>
              {!check.pass && (
                <p className="flex items-start gap-1.5 rounded-small bg-tertiary-container px-2 py-1.5 text-body-sm leading-relaxed text-on-tertiary-container">
                  <Icon icon={Lightbulb} size="sm" className="mt-0.5 h-3 w-3 shrink-0" />
                  {check.guidance}
                </p>
              )}
            </div>
          ))}
          {failed.length === 0 && <p className="font-mono text-label-sm text-positive/80">all checks passing ✓</p>}
        </div>
      </Card>
    </motion.div>
  );
}

// ── Main report ──────────────────────────────────────────────────────────────

export function UpgradeReport({ job, onBack }: { job: UpgradeJobResponse; onBack: () => void }) {
  const [breakdownView, setBreakdownView] = useState<"before" | "after">("after");
  const [tab, setTab] = useState<ReportTab>("readme");

  const before = job.before;
  const after = job.after;
  const upgraded = job.upgradedReadme ?? "";
  const previewSource = useMemo(() => toPreviewSource(upgraded), [upgraded]);
  const delta = job.afterScore - job.beforeScore;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outlined" size="xs" onClick={onBack} className="shrink-0">
              ← Upgrade another repo
            </Button>
            <h1 className="truncate font-mono text-title-lg text-on-surface sm:text-headline-sm">
              {job.owner}/{job.repo}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" icon={Download} onClick={() => downloadText(`README-${job.repo}-100.md`, upgraded)}>
              Download README
            </Button>
            <CopyButton text={upgraded} label="Copy README" />
            <ButtonLink href={job.repoUrl} external variant="outlined" size="xs" icon={ExternalLink}>
              GitHub
            </ButtonLink>
          </div>
        </div>

        {job.repoMeta && (
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral" icon={Sparkles} className="font-mono">
              {job.repoMeta.language}
              {job.repoMeta.frameworks.length ? ` · ${job.repoMeta.frameworks.slice(0, 2).join(", ")}` : ""}
            </Badge>
            {job.repoMeta.license && (
              <Badge tone="neutral" icon={ShieldCheck} className="font-mono">
                {job.repoMeta.license}
              </Badge>
            )}
            <Badge tone="neutral" numeric className="font-mono">
              {job.wordCountBefore} → {job.wordCountAfter} words
            </Badge>
            {!job.hadReadme && (
              <Badge tone="error" className="font-mono">
                no README found — blank canvas
              </Badge>
            )}
          </div>
        )}
      </Card>

      {/* ── Before / After panel ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card padding="lg" className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10 sm:p-8">
          {before && <ScoreGauge score={job.beforeScore} label="Before" tier={before.tier} small />}
          <div className="flex flex-col items-center gap-2">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.9, type: "spring", stiffness: 260, damping: 18 }}
              className="flex items-center gap-2"
            >
              <Icon icon={ArrowRight} size="md" className="text-on-surface-variant/40" />
              <Icon icon={TrendingUp} size="md" className="text-positive" />
            </motion.div>
            {delta > 0 && (
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.05 }}
                className="tnum rounded-full bg-positive-container px-3 py-1 font-mono text-body-sm font-bold text-on-positive-container"
              >
                +{delta} points
              </motion.span>
            )}
            <span className="font-mono text-label-sm text-on-surface-variant">
              {before ? `${before.failedCount} gaps closed` : "from scratch"}
            </span>
          </div>
          {after && <ScoreGauge score={job.afterScore} label="After" tier={after.tier} />}
        </Card>
      </motion.div>

      {/* ── Breakdown ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            <Icon icon={Gauge} size="sm" className="h-3.5 w-3.5 text-primary" />
            {"// SCORE BREAKDOWN"}
          </h2>
          <SegmentedButton
            label="Score breakdown view"
            options={[
              { value: "before", label: `Before (${job.beforeScore}/100)` },
              { value: "after", label: "After (100/100)" },
            ]}
            value={breakdownView}
            onChange={setBreakdownView}
            className="tnum font-mono"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(breakdownView === "before" ? (before?.categories ?? []) : (after?.categories ?? [])).map((cat, i) => (
            <CategoryCard key={cat.id} cat={cat} delay={i * 0.05} />
          ))}
        </div>
      </section>

      {/* ── Fix plan + README tabs ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto pb-1">
          <Tabs
            label="Report sections"
            value={tab}
            onChange={setTab}
            items={[
              { value: "readme", label: "✨ Upgraded README" },
              { value: "markdown", label: "Raw Markdown" },
              { value: "fixes", label: "Fix Plan", count: job.fixes.length },
              { value: "original", label: "Original" },
            ]}
          />
        </div>

        {tab === "readme" && (
          <TabPanel>
            <Card className="p-4 sm:p-6">
              <MarkdownView source={previewSource} />
            </Card>
          </TabPanel>
        )}

        {tab === "markdown" && (
          <TabPanel>
            <Card className="p-4 sm:p-6">
              <div className="mb-3 flex justify-end">
                <Button size="xs" variant="outlined" icon={Download} onClick={() => downloadText(`README-${job.repo}-100.md`, upgraded)}>
                  Download
                </Button>
              </div>
              <pre className="max-h-[600px] overflow-auto rounded-medium bg-surface-container-high p-4 font-mono text-body-sm leading-relaxed text-on-surface">
                {upgraded}
              </pre>
            </Card>
          </TabPanel>
        )}

        {tab === "fixes" && (
          <TabPanel>
            <div className="flex flex-col gap-3">
              {job.fixes.length === 0 ? (
                <Card className="flex items-center gap-3 p-5">
                  <Icon icon={CheckCircle2} size="md" className="shrink-0 text-positive" />
                  <p className="text-body-sm text-on-surface-variant">
                    The original README already covered every check in the rubric — no fixes were needed.
                  </p>
                </Card>
              ) : (
                job.fixes.map((fix, i) => (
                  <motion.div
                    key={fix.checkId}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.35 }}
                  >
                    <Card className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-small",
                          fix.fixed ? "bg-positive-container text-on-positive-container" : "bg-tertiary-container text-on-tertiary-container"
                        )}
                      >
                        {fix.fixed ? (
                          <Icon icon={Check} size="sm" className="h-4 w-4" />
                        ) : (
                          <Icon icon={Lightbulb} size="sm" className="h-4 w-4" />
                        )}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-body-md font-semibold text-on-surface">{fix.label}</p>
                          <Badge tone="neutral" size="sm" className="font-mono">
                            {fix.category}
                          </Badge>
                          <Badge tone={fix.fixed ? "primary" : "tertiary"} size="sm" className="font-mono">
                            {fix.fixed ? `fixed in "${fix.section}"` : `guidance → ${fix.section}`}
                          </Badge>
                        </div>
                        <p className="text-body-sm leading-relaxed text-on-surface-variant">{fix.guidance}</p>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </TabPanel>
        )}

        {tab === "original" && (
          <TabPanel>
            <Card className="p-4 sm:p-6">
              {job.originalReadme ? (
                <pre className="max-h-[600px] overflow-auto rounded-medium bg-surface-container-high p-4 font-mono text-body-sm leading-relaxed text-on-surface-variant">
                  {job.originalReadme}
                </pre>
              ) : (
                <EmptyState
                  icon={XCircle}
                  title="This repository had no README"
                  description="ShipOS forged the upgraded README from the repository's live data — manifests, commits, workflows and detected stack. Nothing was invented."
                />
              )}
            </Card>
          </TabPanel>
        )}
      </div>

      <p className="text-center font-mono text-label-sm text-on-surface-variant/60">
        audited {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })} · zero fabricated claims · the
        README is the Source of Truth
      </p>
    </div>
  );
}

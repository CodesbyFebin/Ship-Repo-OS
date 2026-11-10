"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Compass,
  Copy,
  Crown,
  Download,
  FileText,
  Film,
  Gauge,
  History,
  Link2,
  ListChecks,
  MessageCircle,
  Minus,
  ScanLine,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
  Workflow,
  X,
  XCircle,
} from "@/ui/symbols";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Badge, Button, Card, Icon, Popover, TabPanel, Tabs, Tooltip, toast } from "@/ui";
import type { IconGlyph, TabItem } from "@/ui";
import type { AuditJobListItem, AuditJobResponse, AuditRisk, RepoAudit, RepoAuditCategory } from "@/lib/shipos/audit-types";
import { gradeFor, RISK_SEVERITY_ORDER } from "@/lib/shipos/audit-types";
import { buildReportMarkdown, buildSummaryText } from "@/lib/shipos/report-markdown";
import { cn } from "@/lib/utils";
import { fireConfetti } from "@/components/shipos/auditor/confetti";
import { ChecksTab } from "@/components/shipos/auditor/checks-tab";
import { RoadmapTab } from "@/components/shipos/auditor/roadmap-tab";
import { AutoFixTab } from "@/components/shipos/auditor/autofix-tab";
import { HistoryTab } from "@/components/shipos/auditor/history-tab";
import { ProHub } from "@/components/shipos/auditor/pro-hub";
import { StoryEngineTab } from "@/components/shipos/auditor/story/story-engine";
import { applyWeights, useProHydrated, useProStore } from "@/lib/shipos/pro-store";

// ─────────────────────────────────────────────────────────────────────────────
// AuditReport — header card + tabbed suite:
// Overview · Checks · Roadmap · Auto Fix · Story Engine · History · PRO Hub
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, IconGlyph> = {
  docs: FileText,
  quality: Gauge,
  security: ShieldCheck,
  devops: Workflow,
  community: Users,
};

/** Grade → Ink role: text role for words, chart role for SVG strokes. */
const GRADE_STYLE: Record<string, { text: string; stroke: string }> = {
  S: { text: "text-premium", stroke: "var(--chart-3)" },
  A: { text: "text-positive", stroke: "var(--chart-2)" },
  B: { text: "text-primary", stroke: "var(--chart-1)" },
  C: { text: "text-tertiary", stroke: "var(--chart-4)" },
  D: { text: "text-error", stroke: "var(--chart-5)" },
  F: { text: "text-error", stroke: "var(--chart-5)" },
};

const RISK_BADGE: Record<AuditRisk["severity"], string> = {
  critical: "bg-error-container text-on-error-container",
  high: "bg-premium-container text-on-premium-container",
  medium: "bg-tertiary-container text-on-tertiary-container",
  low: "bg-surface-container-highest text-on-surface-variant",
};

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} is on your clipboard.`, tone: "success" });
  } catch {
    toast({ title: "Copy failed", description: "Clipboard unavailable in this context.", tone: "danger" });
  }
}

// ── Score ring colored by grade ──────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const color = GRADE_STYLE[grade]?.stroke ?? "var(--chart-2)";
  return (
    <div className="relative size-36 shrink-0 sm:size-44">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={`Score ${score} of 100`}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgb(var(--md-sys-color-outline-variant-rgb))" strokeWidth="9" />
        <motion.circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - score / 100) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display-md text-on-surface sm:text-display-lg">{score}</span>
        <span className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">/ 100</span>
      </div>
    </div>
  );
}

function ScoreRadar({ categories }: { categories: RepoAuditCategory[] }) {
  const data = categories.map((c) => ({ subject: c.name, value: c.score }));
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgb(var(--md-sys-color-outline-variant-rgb))" strokeDasharray="3 3" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "rgb(var(--md-sys-color-on-surface-variant-rgb))", fontSize: 11, fontFamily: "var(--font-geist-mono)" }} />
          <PolarRadiusAxis domain={[0, 25]} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.32} isAnimationActive />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main report ──────────────────────────────────────────────────────────────

const AUDIT_TABS: TabItem<string>[] = [
  {
    value: "overview",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={Gauge} size="sm" />
        Overview
      </span>
    ),
  },
  {
    value: "checks",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={ListChecks} size="sm" />
        Checks
      </span>
    ),
  },
  {
    value: "roadmap",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={Compass} size="sm" />
        Roadmap
      </span>
    ),
  },
  {
    value: "autofix",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={Wand2} size="sm" />
        Auto Fix
      </span>
    ),
  },
  {
    value: "story",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={Film} size="sm" />
        Story Engine
      </span>
    ),
  },
  {
    value: "history",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={History} size="sm" />
        History
      </span>
    ),
  },
  {
    value: "pro",
    label: (
      <span className="flex items-center gap-1.5">
        <Icon icon={Crown} size="sm" />
        PRO Hub
      </span>
    ),
  },
];

export function AuditReport({
  job,
  isProUser,
  onUpgrade,
  onBack,
  onReAudit,
  onAuditStarted,
  items,
  onOpen,
  tab,
  onTabChange,
}: {
  job: AuditJobResponse;
  isProUser: boolean;
  onUpgrade: () => void;
  onBack: () => void;
  onReAudit: () => void;
  onAuditStarted: (id: string, repoUrl: string) => void;
  items: AuditJobListItem[];
  onOpen: (id: string) => void;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  const audit = job.audit;
  const hydrated = useProHydrated();
  const customWeights = useProStore((s) => s.customWeights);
  const confettiFired = useRef(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Perfect-100 celebration: fire confetti exactly once.
  useEffect(() => {
    if (audit && audit.stats.checksFailed === 0 && !confettiFired.current) {
      confettiFired.current = true;
      fireConfetti();
    }
  }, [audit]);

  const summary = useMemo(() => (audit ? buildSummaryText(job) : ""), [job, audit]);
  const fullReport = useMemo(() => (audit ? buildReportMarkdown(job) : ""), [job, audit]);

  const shareVariants = useMemo(() => {
    if (!audit) return [];
    const base = buildSummaryText(job);
    return [
      { icon: X, label: "X / Twitter", text: base },
      {
        icon: Users,
        label: "LinkedIn",
        text: `${base}\n\nThe audit is deterministic: 50 checks, 5 weighted categories (Documentation 25 · Code Quality 25 · Security 20 · DevOps 15 · Community 15). Same repo, same score, every time.`,
      },
      {
        icon: MessageCircle,
        label: "Discord",
        text: `**${job.owner}/${job.repo} → ${audit.score}/100 (Grade ${audit.grade}, ${audit.percentile})**\n${audit.fixes
          .slice(0, 3)
          .map((f) => `• ${f.title} (+${f.points} pts)`)
          .join("\n")}\naudited by ShipOS`,
      },
    ];
  }, [job, audit]);

  if (!audit) return null;

  const grade = audit.grade ?? gradeFor(audit.score);
  const gradeStyle = GRADE_STYLE[grade] ?? GRADE_STYLE.A;
  const weightedScore = hydrated && customWeights ? applyWeights(audit, customWeights) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Perfect-100 banner ─────────────────────────────────────────────── */}
      {audit.stats.checksFailed === 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card padding="md" className="flex items-center justify-center gap-3 bg-primary-container text-center text-on-primary-container">
            <Icon icon={Sparkles} size="sm" className="shrink-0" />
            <p className="text-body-md font-semibold">
              Perfect 100/100 — all {audit.stats.checksTotal} checks green. This repo is a Grade S flagship. Ship it with pride.
            </p>
          </Card>
        </motion.div>
      )}

      {/* ── Header card ────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card padding="none" className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8">
          <ScoreRing score={audit.score} grade={grade} />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-mono text-headline-md text-on-surface">
                {job.owner}/{job.repo}
              </h2>
              <Badge variant="outlined" className={cn("font-mono font-bold uppercase text-label-lg", gradeStyle.text)}>
                Grade {grade}
              </Badge>
              <Badge variant="outlined" icon={TrendingUp} className="font-mono text-positive">
                {audit.percentile}
              </Badge>
              <Badge variant="outlined" className="font-mono">
                {audit.strictness}
              </Badge>
              <Badge variant="outlined" className={cn("font-mono", GRADE_STYLE[grade]?.text)}>
                {audit.tier}
              </Badge>
              {weightedScore !== null && (
                <Tooltip content="Your custom category weights, re-scaled client-side">
                  <span className="inline-flex">
                    <Badge variant="outlined" className="font-mono text-primary">
                      weighted: {weightedScore}/100 (custom)
                    </Badge>
                  </span>
                </Tooltip>
              )}
            </div>
            {job.repoMeta?.description && <p className="line-clamp-2 text-body-md text-on-surface-variant">{job.repoMeta.description}</p>}
            <div className="flex flex-wrap gap-1.5 font-mono text-label-md text-on-surface-variant">
              {[
                job.repoMeta?.language,
                job.repoMeta ? `${job.repoMeta.stars.toLocaleString()} ★` : null,
                job.repoMeta?.license,
                job.repoMeta ? `${job.repoMeta.ciWorkflows.length} CI workflow(s)` : null,
                job.repoMeta?.hasTests ? "tests detected" : "no tests",
                job.source === "file-list" ? "offline audit" : null,
              ]
                .filter(Boolean)
                .map((chip) => (
                  <Badge key={String(chip)} variant="outlined" className="font-mono">
                    {chip}
                  </Badge>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-label-md">
              <span className="text-on-surface-variant">
                {audit.stats.checksPassed}/{audit.stats.checksTotal} checks passed ·{" "}
                <span className="text-error">{audit.stats.pointsAtStake} pts at stake</span>
              </span>
              <span className="text-positive">
                → 100/100 after {audit.fixes.length} ranked fix{audit.fixes.length === 1 ? "" : "es"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:w-48">
            <Button
              type="button"
              variant="outlined"
              size="md"
              icon={Copy}
              onClick={() => void copyClipboard(summary, "Summary")}
              className="font-mono"
            >
              Copy summary
            </Button>
            <Button
              type="button"
              variant="outlined"
              size="md"
              icon={Download}
              onClick={() => {
                downloadText(`${job.repo}-audit-report.md`, fullReport);
                toast({ title: "Report downloaded", description: `${job.repo}-audit-report.md`, tone: "success" });
              }}
              className="font-mono"
            >
              Download report .md
            </Button>
            <Popover
              open={shareOpen}
              onOpenChange={setShareOpen}
              placement="bottom-end"
              label="Share score"
              trigger={(p) => (
                <Button type="button" {...p} variant="outlined" size="md" icon={Share2} className="font-mono">
                  Share score
                </Button>
              )}
            >
              <div className="flex w-80 flex-col gap-2 p-3">
                <p className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">{"// PRE-WRITTEN POSTS"}</p>
                {shareVariants.map((v) => (
                  <div key={v.label} className="rounded-medium bg-surface-container p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
                        <Icon icon={v.icon} size="sm" className="text-primary" />
                        {v.label}
                      </span>
                      <Button
                        type="button"
                        variant="text"
                        size="xs"
                        aria-label={`Copy ${v.label} post`}
                        onClick={() => void copyClipboard(v.text, `${v.label} post`)}
                        className="font-mono"
                      >
                        <Icon icon={Copy} size="sm" />
                        Copy
                      </Button>
                    </div>
                    <p className="mt-1 line-clamp-3 text-body-sm leading-relaxed text-on-surface-variant">{v.text}</p>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="text"
                  size="xs"
                  icon={Link2}
                  className="justify-start font-mono"
                  onClick={() => void copyClipboard(`${window.location.origin}/?repo=${job.owner}/${job.repo}`, "Share link")}
                >
                  copy page link
                </Button>
              </div>
            </Popover>
            <Button
              type="button"
              variant="text"
              size="md"
              icon={ArrowLeft}
              onClick={onBack}
              className="font-mono"
            >
              New audit
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* ── Tabbed suite ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Tabs
          items={AUDIT_TABS}
          value={tab}
          onChange={onTabChange}
          label="Audit report sections"
          className="w-full pb-1"
        />

        {tab === "overview" && (
          <TabPanel className="mt-2">
            <OverviewTab audit={audit} />
          </TabPanel>
        )}

        {tab === "checks" && (
          <TabPanel className="mt-2">
            <ChecksTab audit={audit} gated={!isProUser} owner={job.owner} repo={job.repo} onUpgrade={onUpgrade} />
          </TabPanel>
        )}

        {tab === "roadmap" && (
          <TabPanel className="mt-2">
            <RoadmapTab audit={audit} auditId={job.id} isProUser={isProUser} onUpgrade={onUpgrade} />
          </TabPanel>
        )}

        {tab === "autofix" && (
          <TabPanel className="mt-2">
            <AutoFixTab job={job} isProUser={isProUser} onUpgrade={onUpgrade} onReAudit={onReAudit} />
          </TabPanel>
        )}

        {tab === "story" && (
          <TabPanel className="mt-2">
            <StoryEngineTab job={job} isProUser={isProUser} onUpgrade={onUpgrade} />
          </TabPanel>
        )}

        {tab === "history" && (
          <TabPanel className="mt-2">
            <HistoryTab items={items} onOpen={onOpen} />
          </TabPanel>
        )}

        {tab === "pro" && (
          <TabPanel className="mt-2">
            <ProHub job={job} onAuditStarted={onAuditStarted} onUpgrade={onUpgrade} />
          </TabPanel>
        )}
      </div>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ audit }: { audit: RepoAudit }) {
  const lost = useMemo(
    () =>
      audit.categories
        .flatMap((c) => c.checks.filter((ch) => !ch.pass && !ch.na).map((ch) => ({ ...ch, categoryName: c.name })))
        .sort((a, b) => b.weight - a.weight),
    [audit]
  );

  const risks = useMemo(() => [...audit.risks].sort((a, b) => RISK_SEVERITY_ORDER[a.severity] - RISK_SEVERITY_ORDER[b.severity]), [audit.risks]);

  return (
    <div className="flex flex-col gap-4">
      {/* Radar + category cards */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card padding="md" className="flex h-full flex-col gap-2 sm:p-5">
          <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            <Icon icon={ScanLine} size="sm" className="text-primary" />
            {"// SCORE BREAKDOWN"}
          </p>
          <ScoreRadar categories={audit.categories} />
          <div className="flex flex-col gap-1.5">
            {audit.categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between font-mono text-label-md">
                <span className="text-on-surface-variant">{c.name}</span>
                <span className={cn(c.score / c.max >= 0.7 ? "text-positive" : c.score / c.max >= 0.4 ? "text-premium" : "text-error")}>
                  {c.score}/{c.max}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {audit.categories.map((c, i) => (
            <CategoryCard key={c.id} category={c} index={i} />
          ))}
        </div>
      </div>

      {/* Points lost + risks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="md" className="sm:p-5">
          <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            <Icon icon={XCircle} size="sm" className="text-error" />
            {"// POINTS LOST BREAKDOWN"}
          </p>
          <p className="mt-1 font-mono text-label-sm text-on-surface-variant/70">exactly where the {audit.stats.pointsAtStake} points went — heaviest losses first</p>
          <div className="mt-3 flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1">
            {lost.map((ch) => (
              <div key={ch.id} className="flex items-start gap-2.5 rounded-medium bg-surface-container-high p-2.5">
                <span className="shrink-0 font-mono text-body-sm font-bold text-error">-{ch.weight}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-body-sm font-semibold text-on-surface/90">{ch.label}</span>
                    <Badge tone="neutral" variant="outlined" className="shrink-0 font-mono">
                      {ch.categoryName}
                    </Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 font-mono text-label-sm text-on-surface-variant/70">{ch.detail}</p>
                </div>
              </div>
            ))}
            {lost.length === 0 && <p className="p-3 text-center text-body-sm text-positive">Nothing lost — every check passed.</p>}
          </div>
        </Card>

        <Card padding="md" className="sm:p-5">
          <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            <Icon icon={ShieldCheck} size="sm" className="text-premium" />
            {"// RISK ASSESSMENT"}
          </p>
          <p className="mt-1 font-mono text-label-sm text-on-surface-variant/70">security &amp; reliability risks surfaced by failed checks</p>
          <div className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
            {risks.map((r) => (
              <div key={r.id} className="flex flex-col gap-1 rounded-medium bg-surface-container-high p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral" className={cn("font-mono uppercase", RISK_BADGE[r.severity])}>
                    {r.severity}
                  </Badge>
                  <span className="text-body-sm font-semibold text-on-surface/90">{r.title}</span>
                </div>
                <p className="text-label-md leading-relaxed text-on-surface-variant">{r.detail}</p>
                <p className="font-mono text-label-sm text-on-surface-variant/70">check: {r.checkId}</p>
              </div>
            ))}
            {risks.length === 0 && (
              <p className="p-3 text-center text-body-sm text-positive">No risks flagged — clean bill of health for this strictness level.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Celebration strip */}
      <Card padding="md" className="flex flex-wrap items-center gap-3 bg-positive/10">
        <Icon icon={Sparkles} size="sm" className="shrink-0 text-positive" />
        <p className="text-body-sm text-on-surface">
          <span className="font-mono font-bold text-positive">{audit.stats.checksPassed} checks already perfect</span> — apply the ranked fixes and the rest follow.
        </p>
        <Badge variant="outlined" className="ml-auto font-mono text-positive">
          {audit.score} → 100
        </Badge>
      </Card>

      {/* How to read */}
      <Card padding="md" className="sm:p-6">
        <p className="mb-3 flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
          <Icon icon={FileText} size="sm" className="text-primary" />
          {"// HOW TO READ THIS REPORT"}
        </p>
        <div className="grid gap-3 text-body-sm leading-relaxed text-on-surface-variant sm:grid-cols-3">
          <p>
            <span className="font-semibold text-on-surface/90">Deterministic scoring.</span> 50 structural checks across 5 weighted categories —
            Documentation 25 · Code Quality 25 · Security 20 · DevOps 15 · Community 15. The same repo always scores the same.
          </p>
          <p>
            <span className="font-semibold text-on-surface/90">One fix, many points.</span> Some fixes resolve several checks at once (a CI workflow
            covers build, test and security jobs). The roadmap ranks by points recovered and tracks your cumulative score.
          </p>
          <p>
            <span className="font-semibold text-on-surface/90">Full code, not hints.</span> Every fix ships complete file content grounded in your
            actual stack — copy, paste, commit, then re-audit to verify the jump.
          </p>
        </div>
        <p className="mt-4 flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant/70">
          <Icon icon={Minus} size="sm" />
          scores are structural, not a code-quality judgement — ShipOS measures the repository, not the author
        </p>
      </Card>
    </div>
  );
}

function CategoryCard({ category, index }: { category: RepoAuditCategory; index: number }) {
  const icon = CATEGORY_ICONS[category.id] ?? Gauge;
  const pct = Math.round((category.score / category.max) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.35 }}
      className="h-full"
    >
      <Card padding="md" className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-medium bg-primary-container text-on-primary-container">
            <Icon icon={icon} size="sm" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-md font-semibold text-on-surface">{category.name}</p>
            <p className="font-mono text-label-md text-on-surface-variant">
              {category.score}/{category.max} pts · weight {category.max}
            </p>
          </div>
          <span className={cn("font-mono text-body-md font-bold", pct >= 70 ? "text-positive" : pct >= 40 ? "text-premium" : "text-error")}>{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
          <motion.div
            className={cn("h-full rounded-full", pct >= 70 ? "bg-positive" : pct >= 40 ? "bg-premium" : "bg-error")}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: 0.1 * index, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <ul className="flex flex-col gap-1.5">
          {category.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-body-sm">
              <Icon
                icon={c.na ? Minus : c.pass ? BadgeCheck : XCircle}
                size="sm"
                className={cn("mt-0.5 shrink-0", c.na ? "text-on-surface-variant/70" : c.pass ? "text-positive" : "text-error")}
              />
              <span className="min-w-0">
                <span className={cn("font-medium", c.pass ? "text-on-surface/80" : "text-on-surface-variant")}>{c.label}</span>
                <span className="ml-1.5 font-mono text-label-sm text-on-surface-variant/70">{c.na ? "n/a" : `+${c.weight}`}</span>
                <span className="block truncate font-mono text-label-sm text-on-surface-variant/70" title={c.detail}>
                  {c.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </motion.div>
  );
}

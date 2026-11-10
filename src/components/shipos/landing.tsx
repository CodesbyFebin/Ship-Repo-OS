"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Anchor,
  Award,
  Check,
  Code2,
  FileText,
  Film,
  Image as ImageIcon,
  ListChecks,
  Package,
  PieChart,
  Rocket,
  ShieldCheck,
  Anchor as Ship,
  Star,
  Trash2,
  X,
} from "@/ui/symbols";
import { Badge, Button, ButtonLink, Card, Chip, ChipGroup, Icon, IconButton, Status, TextField } from "@/ui";
import type { ProjectListItem } from "@/lib/shipos/types";
import { DEFAULT_PRESET, PRESETS } from "@/lib/shipos/presets";
import { cn } from "@/lib/utils";
import { interactive } from "@/ui/state-layer";

// ─────────────────────────────────────────────────────────────────────────────
// Landing — hero, ship form, module strip, proof chips, recent ships, process
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_PATTERN = /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

const QUICK_FILLS = ["vercel/next.js", "facebook/react", "honojs/hono"];

const MODULES = [
  {
    name: "READMEForge",
    icon: ImageIcon,
    line: "2,000+ words, SEO/AEO/GEO, hero banner, badges",
  },
  {
    name: "DemoMaker",
    icon: Film,
    line: "Timed storyboard, word-budget enforced",
  },
  {
    name: "DeckSmith",
    icon: PieChart,
    line: "Repo architecture → pitch deck",
  },
  {
    name: "ReportGen",
    icon: FileText,
    line: "Academic PDF-ready report + viva prep",
  },
  {
    name: "Gatekeeper",
    icon: ShieldCheck,
    line: "Zero-Trust claim ledger, every number audited",
  },
] as const;

const PROOF_STATS = [
  { label: "10 Claws", icon: Anchor },
  { label: "50 Tasks", icon: ListChecks },
  { label: "30 README Features", icon: FileText },
  { label: "1,024+ Badges", icon: Award },
  { label: "7 Presets", icon: Package },
] as const;

const PROCESS_STEPS = [
  { n: "01", title: "Ingest", detail: "repo + commits + manifests" },
  { n: "02", title: "Verify", detail: "claim → evidence or REJECTED" },
  { n: "03", title: "Forge", detail: "README/deck/script/report from one source of truth" },
  { n: "04", title: "Audit", detail: "SEO + README + Health scores, export /dist" },
] as const;

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function shipStatus(status: string): "live" | "running" | "failed" | "draft" {
  if (status === "ready") return "live";
  if (status === "processing") return "running";
  if (status === "error") return "failed";
  return "draft";
}

export interface LandingProps {
  recent: ProjectListItem[];
  shipping: boolean;
  initialUrl?: string;
  onShip: (repoUrl: string, preset: string) => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export function Landing({
  recent,
  shipping,
  initialUrl,
  onShip,
  onOpenProject,
  onDeleteProject,
}: LandingProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET);
  const [error, setError] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () => PRESETS.find((p) => p.id === presetId) ?? PRESETS[0],
    [presetId]
  );

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a GitHub repo URL first — e.g. https://github.com/owner/repo");
      return;
    }
    if (!REPO_PATTERN.test(trimmed)) {
      setError("URL must look like https://github.com/owner/repo (owner/repo pattern required).");
      return;
    }
    setError(null);
    onShip(trimmed, presetId);
  };

  return (
    <div className="flex flex-col gap-12">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 -mx-4 bg-surface/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-small bg-primary text-on-primary">
              <Icon icon={Ship} size="sm" />
            </span>
            <span className="font-mono text-title-lg text-on-surface">ShipOS</span>
            <Badge tone="primary" variant="outlined" className="font-mono">
              v3.0
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/vercel/next.js"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 font-mono text-label-md text-on-surface-variant transition-colors hover:text-on-surface md:inline-flex"
            >
              <Icon icon={Code2} size="sm" />
              github.com/vercel/next.js
            </a>
            <ButtonLink
              href="https://github.com"
              external
              variant="outlined"
              size="xs"
              icon={Star}
            >
              Star on GitHub
            </ButtonLink>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <FadeIn className="flex flex-col items-center gap-5 pt-6 text-center">
        <p className="font-mono text-label-md tracking-widest text-on-surface-variant">
          {"// ZERO-TRUST SUBMISSION ENGINE"}
        </p>
        <h1 className="max-w-3xl text-display-md text-on-surface">
          One URL. Every Artifact.{" "}
          <span className="text-primary">Zero Lies.</span>
        </h1>
        <p className="max-w-2xl text-body-lg text-on-surface-variant">
          Paste a GitHub repo. ShipOS ingests it, verifies every claim against real
          commits, and forges your README, demo script, pitch deck, report and
          compliance pack — in one click.
        </p>
      </FadeIn>

      {/* ── Ship form ─────────────────────────────────────────────────────── */}
      <FadeIn delay={0.08}>
        <Card className="mx-auto w-full max-w-3xl gap-5 p-4 sm:p-6" padding="none">
          <div className="flex flex-col gap-4 p-4 sm:p-6">
            <TextField
              label="Repo URL"
              icon={Code2}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !shipping) submit();
              }}
              error={error ?? undefined}
              hint="https://github.com/owner/repo"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            <ChipGroup label="Quick fills" overflow="scroll">
              <span className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                try:
              </span>
              {QUICK_FILLS.map((qf) => (
                <Chip
                  key={qf}
                  kind="suggestion"
                  onClick={() => {
                    setUrl(`https://github.com/${qf}`);
                    setError(null);
                  }}
                  className="font-mono"
                >
                  {qf}
                </Chip>
              ))}
            </ChipGroup>
          </div>

          <div className="flex flex-col gap-3 p-4 pt-0 sm:p-6 sm:pt-0">
            <p className="font-mono text-label-md text-on-surface-variant">
              TARGET REALITY <span className="text-on-surface-variant/60">{"// preset"}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {PRESETS.map((preset, i) => {
                const selected = preset.id === presetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPresetId(preset.id)}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-small p-3 text-left transition-press",
                      "before:absolute",
                      selected
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-on-surface/[0.04] text-on-surface",
                      interactive(),
                      "relative",
                      i === PRESETS.length - 1 && "col-span-2 lg:col-span-2"
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-lg leading-none">{preset.emoji}</span>
                      {selected && <Icon icon={Check} size="sm" className="size-3.5 text-primary" />}
                    </div>
                    <span className="text-title-sm text-on-surface">
                      {preset.label}
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-variant">
                      {preset.durationSec}s · {preset.wordBudget} words
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {preset.rubricFocus.map((focus) => (
                        <span
                          key={focus}
                          className={cn(
                            "rounded-extra-small px-1.5 py-0.5 font-mono text-[9px]",
                            selected
                              ? "bg-on-primary-container/10 text-on-primary-container"
                              : "bg-surface-container-highest text-on-surface-variant"
                          )}
                        >
                          {focus}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[11px] text-on-surface-variant">
              audience: {selectedPreset.audience}
            </p>
          </div>

          <div className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Button
              size="lg"
              onClick={submit}
              disabled={shipping}
              loading={shipping}
              loadingLabel="Ingesting…"
              trailingIcon={shipping ? undefined : Rocket}
              fullWidth
              className="h-12 text-title-md"
            >
              {shipping ? "Ingesting…" : "Ship it"}
            </Button>
          </div>
        </Card>
      </FadeIn>

      {/* ── Module strip ──────────────────────────────────────────────────── */}
      <FadeIn delay={0.12}>
        <div className="flex flex-col gap-4">
          <h2 className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            {"// FIVE FORGES, ONE SOURCE OF TRUTH"}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {MODULES.map((mod, i) => (
              <motion.div
                key={mod.name}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
                className={cn(
                  "flex flex-col gap-2 rounded-medium bg-surface-container p-4",
                  i === MODULES.length - 1 && "col-span-2 md:col-span-1"
                )}
              >
                <span className="flex size-8 items-center justify-center rounded-small bg-primary-container text-on-primary-container">
                  <Icon icon={mod.icon} size="sm" />
                </span>
                <p className="text-title-md text-on-surface">{mod.name}</p>
                <p className="text-body-sm text-on-surface-variant">{mod.line}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* ── Proof chips ───────────────────────────────────────────────────── */}
      <FadeIn delay={0.16}>
        <ChipGroup label="Proof stats" className="justify-center">
          {PROOF_STATS.map((stat) => (
            <Chip key={stat.label} kind="assist" icon={stat.icon} className="font-mono">
              {stat.label}
            </Chip>
          ))}
        </ChipGroup>
      </FadeIn>

      {/* ── Recent ships ──────────────────────────────────────────────────── */}
      {recent.length > 0 && (
        <FadeIn delay={0.05}>
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
                {"// RECENT SHIPS"}
              </h2>
              <span className="font-mono text-[11px] text-on-surface-variant">
                {recent.length} log{recent.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
              {recent.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenProject(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onOpenProject(item.id);
                  }}
                  className={cn(
                    "group flex w-full cursor-pointer items-center gap-3 rounded-small bg-surface-container-low px-4 py-3",
                    interactive()
                  )}
                >
                  <Status state={shipStatus(item.status)} dotOnly>
                    {item.status}
                  </Status>
                  <span className="truncate font-mono text-body-md text-on-surface">
                    {item.owner}/{item.repo}
                  </span>
                  <Badge tone="neutral" size="sm" className="hidden font-mono sm:inline-flex">
                    {item.preset}
                  </Badge>
                  <span className="ml-auto hidden items-center gap-3 font-mono text-[11px] text-on-surface-variant sm:flex">
                    <span className="inline-flex items-center gap-1 tnum">
                      <Icon icon={Star} size="sm" className="h-3 w-3 text-premium" />
                      {item.stars}
                    </span>
                    <span className="inline-flex items-center gap-1 text-positive tnum">
                      <Icon icon={Check} size="sm" className="h-3 w-3" />
                      {item.verifiedCount}
                    </span>
                    <span className="inline-flex items-center gap-1 text-error tnum">
                      <Icon icon={X} size="sm" className="h-3 w-3" />
                      {item.rejectedCount}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                  <IconButton
                    icon={Trash2}
                    label={`Delete ${item.owner}/${item.repo}`}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteProject(item.id);
                    }}
                    className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  />
                </div>
              ))}
            </div>
          </section>
        </FadeIn>
      )}

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <FadeIn delay={0.1}>
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            {"// HOW IT WORKS"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step) => (
              <div
                key={step.n}
                className="flex flex-col gap-2 rounded-medium bg-surface-container p-4"
              >
                <span className="font-mono text-display-sm text-primary/80">
                  {step.n}
                </span>
                <p className="text-title-md text-on-surface">{step.title}</p>
                <p className="text-body-sm text-on-surface-variant">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </FadeIn>
    </div>
  );
}

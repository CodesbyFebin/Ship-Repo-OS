"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SlidesTab — deckSmithPro: 50 slides in 6 acts generated from the audit.
// Act filters · Slide X/50 viewer · Prev/Next · thumbnail grid · visual
// treatment per slide · Copy slide · Download markdown bundle (PPTX-ready).
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Copy, Download, Grid3x3, LayoutTemplate, Star } from "@/ui/symbols";
import { Badge, Button, Card, Chip, Icon, Slider, cn } from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { AuditJobResponse, RepoAuditCategory } from "@/lib/shipos/audit-types";
import { buildSlides, buildSlidesMarkdown, slideMarkdown, SLIDE_ACTS, type SlideAct, type StorySlide } from "@/lib/shipos/story-engine";
import { copyText, downloadText } from "./story-utils";

/** Act identity → the chart role the stage tints with (data-driven hue). */
const ACT_COLOUR: Record<SlideAct, string> = {
  hook: "var(--chart-1)",
  reveal: "var(--chart-4)",
  audit: "var(--chart-3)",
  fix: "var(--chart-2)",
  story: "var(--chart-1)",
  close: "var(--chart-5)",
};

export function SlidesTab({ job }: { job: AuditJobResponse }) {
  const slides = useMemo(() => buildSlides(job), [job]);
  const [act, setAct] = useState<SlideAct | "all">("all");
  const [idx, setIdx] = useState(0);
  const [gridOpen, setGridOpen] = useState(false);

  const filtered = useMemo(() => (act === "all" ? slides : slides.filter((s) => s.act === act)), [slides, act]);
  const current = filtered[Math.min(idx, filtered.length - 1)] as StorySlide | undefined;

  const pickAct = (next: SlideAct | "all") => {
    setAct(next);
    setIdx(0);
  };

  const go = (delta: number) => setIdx((i) => Math.min(filtered.length - 1, Math.max(0, i + delta)));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };

  const bundle = useMemo(() => (slides.length ? buildSlidesMarkdown(slides, job) : ""), [slides, job]);
  if (!current || !job.audit) return null;

  const actMeta = SLIDE_ACTS.find((a) => a.id === current.act)!;

  return (
    <div className="flex flex-col gap-4" tabIndex={0} onKeyDown={onKey}>
      <Card padding="none" className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <span className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <Icon icon={LayoutTemplate} size="sm" className="text-primary" />
          deckSmithPro — 6 acts · {slides.length} slides
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="xs" variant="outlined" icon={Grid3x3} onClick={() => setGridOpen((o) => !o)} className="font-mono">
            {gridOpen ? "Hide thumbnails" : "Thumbnails"}
          </Button>
          <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(slideMarkdown(current), `Slide ${current.n}`)} className="font-mono">
            Copy slide
          </Button>
          <Button size="xs" variant="outlined" icon={Download} onClick={() => downloadText(`${job.repo}-50-slide-deck.md`, bundle)} className="font-mono">
            Download deck
          </Button>
        </div>
      </Card>

      {/* Act filter chips */}
      <div role="group" aria-label="Filter slides by act" className="flex flex-wrap items-center gap-1.5">
        <Chip kind="filter" selected={act === "all"} onClick={() => pickAct("all")} className="font-mono">
          All 50
        </Chip>
        {SLIDE_ACTS.map((a) => (
          <Chip key={a.id} kind="filter" selected={act === a.id} onClick={() => pickAct(a.id)} className="font-mono">
            {a.label} <span className="opacity-60">{a.from}-{a.to}</span>
          </Chip>
        ))}
      </div>

      {/* Stage */}
      <div className="rounded-medium" style={{ boxShadow: `0 0 90px -30px ${ACT_COLOUR[current.act]}` }}>
        <Card padding="none" className="relative flex min-h-[420px] flex-col overflow-hidden sm:min-h-[480px]">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              background: `radial-gradient(560px 260px at 18% 12%, ${ACT_COLOUR[current.act]}, transparent 62%), radial-gradient(640px 320px at 85% 85%, rgb(var(--md-sys-color-tertiary-rgb) / 0.33), transparent 60%)`,
            }}
            aria-hidden
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={current.n}
              initial={{ opacity: 0, x: 26, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -22, scale: 0.985 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex flex-1 flex-col gap-6 p-6 sm:p-10"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-label-sm uppercase tracking-[0.3em]" style={{ color: ACT_COLOUR[current.act] }}>
                  {current.kicker}
                </span>
                <span className="font-mono text-label-sm text-on-surface-variant">
                  Act {actMeta.label} · Slide {current.n} / {slides.length}
                </span>
              </div>

              <h3 className={cn("font-bold leading-tight tracking-tight text-on-surface", current.visual === "cover" ? "text-headline-lg sm:text-display-lg" : "text-headline-md sm:text-display-sm")}>
                {current.title}
              </h3>

              <div className="flex flex-1 items-center">
                <SlideVisual slide={current} audit={job} />
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          <div className="relative flex items-center justify-between gap-3 bg-surface-container-high px-4 py-3">
            <Button variant="outlined" size="xs" icon={ChevronLeft} onClick={() => go(-1)} disabled={idx <= 0} className="font-mono">
              Prev
            </Button>
            <div className="flex items-center gap-2">
              <span className="font-mono text-label-sm text-on-surface-variant">
                Slide <span className="font-bold text-on-surface tnum">{filtered.length ? filtered[Math.min(idx, filtered.length - 1)].n : 0}</span>/{slides.length}
              </span>
              <Slider
                label="Slide position"
                hideLabel
                min={0}
                max={Math.max(0, filtered.length - 1)}
                value={Math.min(idx, filtered.length - 1)}
                onInput={(e) => setIdx(Number(e.currentTarget.value))}
                className="w-40 sm:w-56"
              />
            </div>
            <Button variant="outlined" size="xs" trailingIcon={ChevronRight} onClick={() => go(1)} disabled={idx >= filtered.length - 1} className="font-mono">
              Next
            </Button>
          </div>
        </Card>
      </div>

      {/* Thumbnail grid */}
      {gridOpen && (
        <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto rounded-medium bg-surface-container-low p-3 sm:grid-cols-4 lg:grid-cols-5">
          {filtered.map((s, i) => {
            const a = SLIDE_ACTS.find((x) => x.id === s.act)!;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setIdx(i)}
                className={cn(
                  "group flex flex-col gap-1 rounded-small p-2.5 text-left",
                  i === idx ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-on-surface",
                  interactive(),
                )}
                aria-pressed={i === idx}
              >
                <span className="font-mono text-label-sm" style={{ color: i === idx ? undefined : ACT_COLOUR[s.act] }}>
                  {String(s.n).padStart(2, "0")} · {a.id}
                </span>
                <span className="line-clamp-2 text-body-sm font-semibold leading-snug">{s.title}</span>
                <span className="font-mono text-label-sm text-on-surface-variant/70">{s.visual}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Per-slide visual treatments (pure SVG/CSS — no chart lib needed here) ────

function SlideVisual({ slide, audit }: { slide: StorySlide; audit: AuditJobResponse }) {
  const a = audit.audit!;
  switch (slide.visual) {
    case "gauge":
      return <MiniGauge score={a.score} label={slide.bullets[0] ?? `${a.score}/100`} />;
    case "stars":
      return <StarsBig stars={audit.repoMeta?.stars ?? 0} checks={`${a.stats.checksPassed}/${a.stats.checksTotal}`} />;
    case "bars":
      return <CategoryBars categories={a.categories} />;
    case "radar":
      return <MiniRadar categories={a.categories} />;
    case "roadmap":
      return <RoadmapBars audit={a} />;
    case "diff":
      return <DiffScroll lines={slide.bullets} />;
    case "arch":
      return <ArchFlow />;
    case "graph":
      return <CommitGraph />;
    case "risk":
      return <RiskStack labels={slide.bullets} />;
    case "cta":
      return <CtaBlock lines={slide.bullets} />;
    case "quote":
      return <QuoteBlock text={slide.bullets[0] ?? slide.title} />;
    case "cover":
      return <CoverBlock bullets={slide.bullets} />;
    default:
      return <ChecklistBlock bullets={slide.bullets} />;
  }
}

function MiniGauge({ score, label }: { score: number; label: string }) {
  const R = 70;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative size-44 sm:size-52">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90" role="img" aria-label={`Score ${score} of 100`}>
          <circle cx="80" cy="80" r={R} fill="none" stroke="rgb(var(--md-sys-color-outline-variant-rgb))" strokeWidth="11" />
          <motion.circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - score / 100) }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-display-md font-bold text-on-surface tnum">{score}</span>
          <span className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">/ 100</span>
        </div>
      </div>
      <p className="font-mono text-label-md text-on-surface-variant">{label}</p>
    </div>
  );
}

function CategoryBars({ categories }: { categories: RepoAuditCategory[] }) {
  return (
    <div className="flex w-full flex-col gap-3">
      {categories.map((c) => {
        const pct = Math.round((c.score / c.max) * 100);
        return (
          <div key={c.id} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-body-md font-medium text-on-surface">{c.name}</span>
            <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
              <motion.div
                className={cn("h-full rounded-full", pct >= 70 ? "bg-positive" : pct >= 40 ? "bg-premium" : "bg-error")}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-label-md font-bold text-on-surface tnum">
              {c.score}/{c.max}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MiniRadar({ categories }: { categories: RepoAuditCategory[] }) {
  const n = categories.length;
  const cx = 110;
  const cy = 100;
  const maxR = 82;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, frac: number) => `${cx + Math.cos(angle(i)) * maxR * frac},${cy + Math.sin(angle(i)) * maxR * frac}`;
  const poly = categories.map((c, i) => point(i, Math.max(0.04, c.score / c.max))).join(" ");
  return (
    <svg viewBox="0 0 220 200" className="mx-auto h-52 w-full max-w-sm" role="img" aria-label="Category radar">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={categories.map((_, i) => point(i, f)).join(" ")} fill="none" stroke="rgb(var(--md-sys-color-outline-variant-rgb))" strokeDasharray="3 3" />
      ))}
      <motion.polygon
        points={poly}
        fill="rgb(var(--md-sys-color-primary-rgb) / 0.2)"
        stroke="var(--chart-1)"
        strokeWidth="2"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        transition={{ duration: 0.8 }}
      />
      {categories.map((c, i) => (
        <text key={c.id} x={cx + Math.cos(angle(i)) * (maxR + 14)} y={cy + Math.sin(angle(i)) * (maxR + 14)} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fill="rgb(var(--md-sys-color-on-surface-variant-rgb))" fontFamily="monospace">
          {c.name.split(" ")[0]} {c.score}/{c.max}
        </text>
      ))}
    </svg>
  );
}

function RoadmapBars({ audit }: { audit: NonNullable<AuditJobResponse["audit"]> }) {
  const steps = audit.roadmap.slice(0, 6);
  const start = audit.score;
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2 font-mono text-label-sm text-on-surface-variant">
        <span className="font-bold text-on-surface tnum">{start}</span> today → after each ranked fix:
      </div>
      <div className="flex h-24 items-end gap-1.5">
        <motion.div
          className="w-full rounded-t bg-surface-container-highest"
          initial={{ height: 0 }}
          animate={{ height: `${start}%` }}
          transition={{ duration: 0.7 }}
          title={`now: ${start}`}
        />
        {steps.map((s, i) => (
          <motion.div
            key={s.rank}
            className={cn(
              "w-full rounded-t",
              i === steps.length - 1
                ? "bg-[linear-gradient(to_top,rgb(var(--md-sys-color-positive-rgb)/0.55),var(--chart-2))]"
                : "bg-[linear-gradient(to_top,rgb(var(--md-sys-color-primary-rgb)/0.55),var(--chart-1))]",
            )}
            initial={{ height: 0 }}
            animate={{ height: `${s.cumulative}%` }}
            transition={{ duration: 0.7, delay: 0.08 * i }}
            title={`#${s.rank} ${s.title}: ${s.cumulative}/100`}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-label-sm text-on-surface-variant">
        <span>now {start}</span>
        {steps.length > 0 && <span>+{steps[steps.length - 1].cumulative - start} pts in top {steps.length} fixes</span>}
        <span>100</span>
      </div>
    </div>
  );
}

function DiffScroll({ lines }: { lines: string[] }) {
  return (
    <div className="w-full overflow-hidden rounded-medium bg-surface-container-lowest font-mono text-label-sm leading-relaxed">
      <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-2">
        <span className="size-2 rounded-full bg-error/70" />
        <span className="size-2 rounded-full bg-premium/70" />
        <span className="size-2 rounded-full bg-positive/70" />
        <span className="ml-2 text-on-surface-variant">auto-fix.patch</span>
      </div>
      <div className="max-h-44 overflow-hidden p-3">
        {lines.map((l, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.28 }}
            className={cn(i % 2 === 0 ? "text-positive" : "text-on-surface-variant")}
          >
            {i % 2 === 0 ? "+" : "~"} {l}
          </motion.p>
        ))}
      </div>
    </div>
  );
}

function StarsBig({ stars, checks }: { stars: number; checks: string }) {
  const display = stars > 0 ? stars.toLocaleString() : checks;
  return (
    <div className="flex w-full flex-col items-center gap-4 py-6">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 14 }}
        className="flex items-center gap-3"
      >
        <Icon icon={Star} filled className="h-12 w-12 text-premium" />
        <span className="font-mono text-display-lg font-bold text-on-surface tnum">{display}</span>
      </motion.div>
      <p className="font-mono text-label-md text-on-surface-variant">{checks} audit checks passing · the foundation is real</p>
    </div>
  );
}

function ArchFlow() {
  const nodes = ["repo", "50 checks", "ranked fixes", "100/100"];
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
      {nodes.map((n, i) => (
        <div key={n} className="flex items-center gap-2 sm:gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 * i, duration: 0.4 }}
            className={cn(
              "rounded-medium px-4 py-3 font-mono text-label-md sm:text-body-md",
              i === nodes.length - 1 ? "bg-positive-container text-on-positive-container" : "bg-surface-container-high text-on-surface",
            )}
          >
            {n}
          </motion.div>
          {i < nodes.length - 1 && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 * i + 0.1 }} className="animate-pulse font-mono text-on-surface-variant">
              ──▶
            </motion.span>
          )}
        </div>
      ))}
    </div>
  );
}

function CommitGraph() {
  const dots = 14;
  return (
    <div className="flex w-full flex-col items-center gap-2 py-4">
      <svg viewBox="0 0 320 90" className="h-24 w-full max-w-md" role="img" aria-label="Score history graph">
        <motion.polyline
          points="8,62 40,50 72,56 104,40 136,44 168,30 200,34 232,22 264,26 296,12"
          fill="none"
          stroke="var(--chart-2)"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
        {Array.from({ length: dots }).map((_, i) => (
          <motion.circle
            key={i}
            cx={8 + i * 22}
            cy={62 - Math.min(50, i * 3.9 + (i % 3) * 3)}
            r="3.4"
            fill={i === dots - 1 ? "var(--chart-1)" : "var(--chart-2)"}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.12 }}
          />
        ))}
      </svg>
      <p className="font-mono text-label-sm text-on-surface-variant">score climbs with every applied fix — and the history proves it</p>
    </div>
  );
}

function RiskStack({ labels }: { labels: string[] }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {labels.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12 * i }}
          className="flex items-center gap-2.5 rounded-small bg-error-container px-3.5 py-2.5 text-on-error-container"
        >
          <span className="size-2 shrink-0 rounded-full bg-current" />
          <span className="font-mono text-label-md">{l}</span>
        </motion.div>
      ))}
      {labels.length === 0 && <p className="font-mono text-label-md text-positive">No risks flagged.</p>}
    </div>
  );
}

function CtaBlock({ lines }: { lines: string[] }) {
  return (
    <div className="flex w-full flex-col items-center gap-4 py-6 text-center">
      <motion.h4
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 15 }}
        className="bg-[linear-gradient(to_right,var(--chart-1),var(--chart-4))] bg-clip-text text-display-sm font-bold text-transparent sm:text-display-md"
      >
        {lines[0]}
      </motion.h4>
      {lines.slice(1).map((l, i) => (
        <p key={i} className="font-mono text-label-md text-on-surface-variant">
          {l}
        </p>
      ))}
    </div>
  );
}

function QuoteBlock({ text }: { text: string }) {
  return (
    <div className="flex w-full gap-5">
      <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full bg-primary" />
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-title-lg font-medium leading-relaxed text-on-surface sm:text-headline-sm">
        “{text.length > 320 ? `${text.slice(0, 317)}…` : text}”
      </motion.p>
    </div>
  );
}

function CoverBlock({ bullets }: { bullets: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {bullets.map((b, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.12 }}
          className="rounded-full bg-surface-container-high px-4 py-2 font-mono text-label-md text-on-surface"
        >
          {b}
        </motion.span>
      ))}
    </div>
  );
}

function ChecklistBlock({ bullets }: { bullets: string[] }) {
  return (
    <ul className="flex w-full flex-col gap-2.5">
      {bullets.map((b, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 * i }}
          className="flex items-start gap-2.5 text-body-md text-on-surface sm:text-body-lg"
        >
          <Badge tone="primary" size="sm" className="mt-0.5 shrink-0 font-mono">
            ✓
          </Badge>
          {b}
        </motion.li>
      ))}
    </ul>
  );
}

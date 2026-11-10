"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileJson,
  Gauge,
  History,
  ListChecks,
  MessagesSquare,
  Megaphone,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  XCircle,
} from "@/ui/symbols";
import {
  Alert,
  Badge,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Progress,
  Spinner,
  TextField,
  toast,
  type IconGlyph,
} from "@/ui";
import type {
  ChecklistEntry,
  OptimizeJobListItem,
  OptimizeJobResponse,
  OptimizationCategory,
} from "@/lib/shipos/optimize-types";
import { OPTIMIZE_CATEGORY_LABELS } from "@/lib/shipos/optimize-types";
import { ScoreRing } from "./score-ring";
import { HeadlineAssets, PackAssets } from "./pack-cards";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// OptimizerTab — Full Repo Optimization Engine.
// 4 headline assets (description · topics · agents.txt · llms.txt) + 50 other
// recommendations make up a 54-point review pack.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_PATTERN = /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

const QUICK_FILLS: { repo: string; label: string }[] = [
  { repo: "sindresorhus/slugify", label: "tiny lib" },
  { repo: "expressjs/express", label: "giant repo" },
  { repo: "honojs/hono", label: "modern TS" },
];

const STAGES: { id: OptimizeJobResponse["stage"]; label: string; detail: string; icon: IconGlyph }[] = [
  { id: "ingesting", label: "Ingesting", detail: "repo metadata, tree, README, manifests", icon: ScanLine },
  { id: "scoring", label: "Scoring visibility", detail: "54 deterministic detectors · SEO / AEO / GEO", icon: Gauge },
  { id: "generating", label: "Writing the pack", detail: "description · topics · agents.txt · llms.txt + 50 more", icon: Wand2 },
  { id: "auditing", label: "Preparing guidance", detail: "match observed evidence to the available drafts", icon: ShieldCheck },
];

const CATEGORY_ICONS: Record<OptimizationCategory, IconGlyph> = {
  seo: Search,
  aeo: MessagesSquare,
  geo: Bot,
  discoverability: Target,
  trust: ShieldCheck,
  launch: Megaphone,
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function checklistMarkdown(job: OptimizeJobResponse): string {
  const lines: string[] = [
    `# ShipOS Optimization Pack — ${job.owner}/${job.repo}`,
    "",
    `Observed scores: SEO ${job.before?.seo ?? 0} · AEO ${job.before?.aeo ?? 0} · GEO ${job.before?.geo ?? 0}`,
    "",
    "## Headline assets",
    "- Repo description — paste into GitHub → About",
    "- GitHub topics — paste into About → Topics",
    "- agents.txt — commit at repo root",
    "- llms.txt — commit at repo root",
    "",
    "## 54-point checklist",
  ];
  for (const e of job.checklist ?? []) {
    lines.push(`- [${e.before.pass ? "x" : " "}] (${e.item.dimension.toUpperCase()}) ${e.item.title} — ${e.before.detail} Next: ${e.after.detail}`);
  }
  return lines.join("\n");
}

export function OptimizerTab({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<OptimizeJobResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<OptimizeJobListItem[]>([]);
  const [openGroups, setOpenGroups] = useState<Set<OptimizationCategory>>(new Set(["seo"]));
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/optimize", { cache: "no-store" });
      if (!res.ok) return;
      const items = (await res.json()) as OptimizeJobListItem[];
      setRecent(Array.isArray(items) ? items : []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  // ── Polling loop while the pipeline runs ───────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/optimize/${jobId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as OptimizeJobResponse;
        if (stopped) return;
        setJob(data);
        if (data.status === "processing") {
          pollTimer.current = setTimeout(tick, 2000);
          return;
        }
        if (data.status === "ready") {
          void refreshRecent();
          toast({
            title: "Optimization drafts ready",
            description: `${data.owner}/${data.repo} now ships SEO · AEO · GEO at full marks.`,
            tone: "success",
          });
        }
      } catch {
        if (!stopped) pollTimer.current = setTimeout(tick, 2000);
      }
    };

    void tick();
    return () => {
      stopped = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [jobId, refreshRecent]);

  const start = useCallback(
    async (repoUrl: string) => {
      const trimmed = repoUrl.trim();
      if (!REPO_PATTERN.test(trimmed)) {
        toast({ title: "Invalid URL", description: "Use https://github.com/owner/repo", tone: "danger" });
        return;
      }
      setSubmitting(true);
      setJob(null);
      try {
        const res = await fetch("/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl: trimmed }),
        });
        const body = (await res.json()) as { ok: boolean; id?: string; error?: string };
        if (!res.ok || !body.ok || !body.id) {
          toast({ title: "Optimization rejected", description: body.error ?? `HTTP ${res.status}`, tone: "danger" });
          return;
        }
        setJobId(body.id);
      } catch {
        toast({ title: "Network error", description: "Could not reach the Optimization Engine.", tone: "danger" });
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  const openJob = useCallback(async (id: string) => {
    setJob(null);
    setJobId(id);
  }, []);

  const removeJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/optimize/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (jobId === id) {
          setJobId(null);
          setJob(null);
        }
        void refreshRecent();
        toast({ title: "Removed", tone: "success" });
      } catch {
        toast({ title: "Delete failed", tone: "danger" });
      }
    },
    [jobId, refreshRecent]
  );

  const reset = useCallback(() => {
    setJobId(null);
    setJob(null);
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<OptimizationCategory, ChecklistEntry[]>();
    for (const e of job?.checklist ?? []) {
      const list = groups.get(e.item.category) ?? [];
      list.push(e);
      groups.set(e.item.category, list);
    }
    return [...groups.entries()];
  }, [job]);

  const stageIndex = STAGES.findIndex((s) => s.id === job?.stage);
  const processing = job?.status === "processing" || (submitting && !job);
  const stageNumber = STAGES.findIndex((s) => s.id === job?.stage);
  const failed = job?.status === "error";

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {onBack ? (
            <IconButton icon={ArrowLeft} variant="standard" label="Back to Full Package" onClick={onBack} />
          ) : null}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-medium bg-primary-container text-on-primary-container">
            <Icon icon={Wand2} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-headline-sm">Full Repo Optimization</h1>
            <p className="text-body-sm text-on-surface-variant">
              Scan SEO, AEO, and GEO signals and generate a review pack:{" "}
              <span className="font-mono text-[0.92em]">description · topics · agents.txt · llms.txt</span> + 50 other optimizations.
            </p>
          </div>
          <Badge tone="premium" icon={Sparkles}>
            54-point pack
          </Badge>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <TextField
              id="optimizer-url"
              label="Repository URL"
              icon={Search}
              value={url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") void start(url);
              }}
            />
          </div>
          <Button
            icon={Wand2}
            onClick={() => void start(url)}
            loading={processing}
            loadingLabel="Optimizing…"
            className="sm:self-end"
          >
            Scan and build drafts
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-md text-on-surface-variant">Try:</span>
          {QUICK_FILLS.map((q) => (
            <Chip key={q.repo} onClick={() => setUrl(`https://github.com/${q.repo}`)}>
              {q.repo} · {q.label}
            </Chip>
          ))}
        </div>
      </Card>

      {/* ── History rail ───────────────────────────────────────────────────── */}
      {recent.length > 0 ? (
        <Card className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-label-lg text-on-surface-variant">
            <Icon icon={History} size="sm" />
            Recent optimization runs
          </div>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
            {recent.map((r) => (
              <span key={r.id} className="inline-flex items-center">
                <Chip selected={jobId === r.id} onClick={() => void openJob(r.id)}>
                  {r.owner}/{r.repo}
                </Chip>
                <IconButton
                  icon={Trash2}
                  size="sm"
                  variant="standard"
                  label={`Delete ${r.owner}/${r.repo}`}
                  onClick={() => void removeJob(r.id)}
                />
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {failed ? (
          <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Alert
              tone="danger"
              title={`Optimization failed for ${job?.owner}/${job?.repo}`}
              action={
                <Button variant="outlined" icon={RefreshCw} onClick={() => void start(job?.repoUrl ?? url)}>
                  Retry
                </Button>
              }
            >
              {job?.error ?? "The pipeline hit an unrecoverable error."} Check that the repository is public and try again.
            </Alert>
          </motion.div>
        ) : processing ? (
          <motion.div key="processing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="flex flex-col gap-4 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <Spinner size="sm" label="Optimizing" />
                <span className="text-title-md">
                  Optimizing {job ? `${job.owner}/${job.repo}` : url || "repository"}…
                </span>
              </div>
              <Progress
                value={((stageNumber + 1) / (STAGES.length + 1)) * 100}
                label={`Optimization stage: ${job?.stage ?? "queued"}`}
              />
              <ol className="flex flex-col gap-2">
                {STAGES.map((s, i) => {
                  const active = i === stageIndex;
                  const done = stageIndex > i || job?.stage === "done";
                  return (
                    <li key={s.id} className={cn("flex items-center gap-3 rounded-medium p-2.5", active && "bg-secondary-container text-on-secondary-container")}>
                      <Icon icon={s.icon} size="sm" className={cn(!active && !done && "text-on-surface-variant")} />
                      <div className="min-w-0 flex-1">
                        <div className="text-title-sm">{s.label}</div>
                        <div className="text-label-md opacity-80">{s.detail}</div>
                      </div>
                      {done ? <Icon icon={CheckCircle2} size="sm" className="text-primary" /> : active ? <Spinner size="sm" label={s.label} /> : null}
                    </li>
                  );
                })}
              </ol>
            </Card>
          </motion.div>
        ) : job?.status === "ready" && job.artifacts && job.checklist ? (
          <motion.div key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
            {/* Score hero */}
            <Card className="flex flex-col gap-4 p-4 sm:p-6">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge tone="premium" icon={ShieldCheck}>
                  Observed visibility
                </Badge>
                <Badge tone={job.packSource === "llm" ? "primary" : "secondary"} icon={Sparkles}>
                  {job.packSource === "llm" ? "LLM-written pack" : "Deterministic template pack"}
                </Badge>
                {job.repoMeta ? (
                  <>
                    <Badge tone="neutral" numeric>
                      ★ {job.repoMeta.stars.toLocaleString("en-US")}
                    </Badge>
                    {job.repoMeta.license ? <Badge tone="neutral">{job.repoMeta.license}</Badge> : null}
                    {job.repoMeta.language ? <Badge tone="neutral">{job.repoMeta.language}</Badge> : null}
                  </>
                ) : null}
                <span className="min-w-0 flex-1" />
                <Button
                  variant="outlined"
                  size="xs"
                  icon={FileJson}
                  onClick={() =>
                    downloadJson(`optimize-${job.owner}-${job.repo}.json`, {
                      repo: `${job.owner}/${job.repo}`,
                      before: job.before,
                      after: job.after,
                      artifacts: job.artifacts,
                      checklist: job.checklist?.map((e) => ({ id: e.item.id, title: e.item.title, before: e.before, after: e.after })),
                    })
                  }
                >
                  Pack JSON
                </Button>
                <Button
                  variant="outlined"
                  size="xs"
                  icon={ListChecks}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(checklistMarkdown(job))
                      .then(() => toast({ title: "Copied", description: "54-point checklist in Markdown.", tone: "success" }))
                      .catch(() => toast({ title: "Copy failed", tone: "danger" }));
                  }}
                >
                  Copy checklist
                </Button>
                <Button variant="text" size="xs" icon={RefreshCw} onClick={reset}>
                  New run
                </Button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <ScoreRing label="Search SEO" hint="Google · Bing · GitHub search" icon={Search} score={job.before?.seo ?? 0} toneClass="text-primary" trackClass="text-secondary-container" />
                <ScoreRing label="Answer Engines" hint="Perplexity · AI Overviews" icon={MessagesSquare} score={job.before?.aeo ?? 0} toneClass="text-tertiary" trackClass="text-secondary-container" />
                <ScoreRing label="Generative Engines" hint="ChatGPT · Claude · Gemini" icon={Bot} score={job.before?.geo ?? 0} toneClass="text-secondary" trackClass="text-secondary-container" />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-label-md text-on-surface-variant">
                <Icon icon={ArrowRight} size="sm" />
                Scores reflect the scanned repository. Review the drafts, apply the changes, and scan again to measure progress.
              </div>
            </Card>

            {/* Headline assets */}
            <section aria-label="Headline assets" className="flex flex-col gap-2">
              <h2 className="text-title-lg">The 4 headline assets</h2>
              <p className="text-body-sm text-on-surface-variant">The exact surfaces you asked for — copy, paste, commit.</p>
              <HeadlineAssets pack={job.artifacts} owner={job.owner} repo={job.repo} />
            </section>

            {/* Full pack */}
            <section aria-label="Full optimization pack" className="flex flex-col gap-2">
              <h2 className="text-title-lg">The other 50 optimizations</h2>
              <p className="text-body-sm text-on-surface-variant">Meta, answers, schema, robots AI rules, comparisons, launch copy — everything the checklist needs.</p>
              <PackAssets pack={job.artifacts} />
            </section>

            {/* Checklist */}
            <section aria-label="54-point checklist" className="flex flex-col gap-2">
              <h2 className="text-title-lg">54-point checklist — before → after</h2>
              <div className="flex flex-col gap-3">
                {grouped.map(([category, entries]) => {
                  const open = openGroups.has(category);
                  const passedBefore = entries.filter((e) => e.before.pass).length;
                  return (
                    <Card key={category} className="overflow-hidden p-0">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() =>
                          setOpenGroups((prev) => {
                            const next = new Set(prev);
                            if (next.has(category)) next.delete(category);
                            else next.add(category);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-2 p-4 text-left"
                      >
                        <Icon icon={CATEGORY_ICONS[category]} size="sm" className="text-primary" />
                        <span className="min-w-0 flex-1 text-title-sm">{OPTIMIZE_CATEGORY_LABELS[category]}</span>
                        <Badge tone={passedBefore === entries.length ? "primary" : "tertiary"} numeric size="sm">
                          {passedBefore}/{entries.length} before
                        </Badge>
                        <Icon icon={open ? ArrowLeft : ArrowRight} size="sm" className={cn("transition-transform", open && "rotate-90", !open && "-rotate-90")} />
                      </button>
                      {open ? (
                        <ul className="max-h-96 overflow-y-auto border-t border-outline-variant">
                          {entries.map((e) => (
                            <li key={e.item.id} className="flex items-start gap-2.5 border-b border-outline-variant/50 p-3 last:border-b-0">
                              {e.before.pass ? (
                                <Icon icon={CheckCircle2} size="sm" className="mt-0.5 shrink-0 text-primary" />
                              ) : (
                                <Icon icon={XCircle} size="sm" className="mt-0.5 shrink-0 text-error" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-title-sm">{e.item.title}</span>
                                  {e.item.artifact ? (
                                    <Badge tone="tertiary" size="sm">
                                      pack asset
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="text-label-md text-on-surface-variant">
                                  <span className="text-error">Observed:</span> {e.before.detail}
                                </p>
                                <p className="text-label-md text-on-surface-variant">
                                  <span className="text-primary">Guidance:</span> {e.after.detail}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card className="flex flex-col items-center gap-3 p-8 text-center">
              <Icon icon={Wand2} className="text-primary" />
              <div className="text-title-md">Paste a repo — get the 54-point pack</div>
              <p className="max-w-md text-body-sm text-on-surface-variant">
                The engine scans your repository with 54 deterministic detectors, scores Search-SEO / Answer-Engine /
                Generative-Engine visibility, then generates drafts and manual next steps.
              </p>
              {url && REPO_PATTERN.test(url) ? (
                <Button icon={Wand2} onClick={() => void start(url)}>
                  Optimize {url.replace(/^https?:\/\/github\.com\//, "")}
                </Button>
              ) : null}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

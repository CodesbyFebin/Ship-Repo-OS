"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Beaker,
  CheckCircle2,
  Code2,
  Gauge,
  History,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Wand2,
} from "@/ui/symbols";
import {
  Badge,
  Button,
  Card,
  Chip,
  ChipGroup,
  Icon,
  IconButton,
  Spinner,
  TextField,
  toast,
  type Glyph,
} from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { UpgradeJobListItem, UpgradeJobResponse } from "@/lib/shipos/upgrade-types";
import { cn } from "@/lib/utils";
import { UpgradeReport } from "@/components/shipos/upgrade-report";

// ─────────────────────────────────────────────────────────────────────────────
// Upgrader — paste a repo URL → current 0-100 score → 100/100 README
// ─────────────────────────────────────────────────────────────────────────────

const REPO_PATTERN = /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;
const QUICK_FILLS = ["expressjs/express", "pallets/flask", "gin-gonic/gin"];
const POLL_INTERVAL_MS = 2000;

const STAGES: { id: UpgradeJobResponse["stage"]; label: string; detail: string; icon: Glyph }[] = [
  { id: "ingesting", label: "Ingesting", detail: "repo, commits, manifests, current README", icon: Code2 },
  { id: "scoring", label: "Scoring", detail: "38 checks · 8 categories · 100 points", icon: Gauge },
  { id: "upgrading", label: "Upgrading", detail: "README Surgeon + deterministic forge", icon: Wand2 },
  { id: "auditing", label: "Re-auditing", detail: "verify every gap is closed", icon: ShieldCheck },
];

function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
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

// ── Progress view ────────────────────────────────────────────────────────────

function UpgradeProgress({ url, stage, error, onRetry }: { url: string; stage: string; error: string | null; onRetry: () => void }) {
  const currentIndex = STAGES.findIndex((s) => s.id === stage);

  if (error) {
    return (
      <FadeIn>
        <Card padding="lg" className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
            <Icon icon={AlertTriangle} size="md" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-title-lg text-on-surface">Upgrade aborted</h2>
            <p className="mx-auto max-w-md text-body-sm text-on-surface-variant">{error}</p>
            <p className="font-mono text-label-sm text-on-surface-variant/60">{url}</p>
          </div>
          <Button icon={RefreshCw} onClick={onRetry}>
            Try another repo
          </Button>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <Card className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon icon={Wand2} size="sm" className="animate-pulse" />
          </span>
          <h2 className="font-mono text-title-lg text-on-surface">Upgrading README…</h2>
          <p className="truncate font-mono text-body-sm text-on-surface-variant">{url}</p>
        </div>

        <div className="flex flex-col gap-3">
          {STAGES.map((s, i) => {
            const active = s.id === stage;
            const done = currentIndex > i || stage === "done";
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08, duration: 0.35 }}
                className={cn(
                  "flex items-center gap-3 rounded-medium p-3 transition-colors",
                  active
                    ? "bg-primary-container text-on-primary-container"
                    : done
                      ? "bg-surface-container-high"
                      : "bg-surface-container-high opacity-50"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-small",
                    done
                      ? "bg-positive-container text-on-positive-container"
                      : active
                        ? "bg-on-primary-container/10 text-on-primary-container"
                        : "bg-surface-container-highest text-on-surface-variant"
                  )}
                >
                  {done ? (
                    <Icon icon={CheckCircle2} size="sm" />
                  ) : active ? (
                    <Spinner size="sm" label={`${s.label} running`} />
                  ) : (
                    <Icon icon={s.icon} size="sm" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-body-md font-semibold", !done && !active && "text-on-surface-variant")}>
                    <span className="tnum font-mono text-label-sm opacity-60">{String(i + 1).padStart(2, "0")} · </span>
                    {s.label}
                  </p>
                  <p className="truncate font-mono text-label-sm opacity-70">{s.detail}</p>
                </div>
                {done && <Badge tone="primary" size="sm" className="shrink-0">done</Badge>}
                {active && !done && <Badge tone="tertiary" size="sm" className="shrink-0">running</Badge>}
              </motion.div>
            );
          })}
        </div>

        <p className="text-center font-mono text-label-sm text-on-surface-variant/60">
          the README Surgeon mines your original content — nothing is invented, gaps become guidance
        </p>
      </Card>
    </FadeIn>
  );
}

// ── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ item, onOpen, onDelete }: { item: UpgradeJobListItem; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const delta = item.afterScore - item.beforeScore;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(item.id);
      }}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-medium bg-surface-container px-4 py-3",
        interactive()
      )}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          item.status === "ready" ? "bg-positive" : item.status === "processing" ? "animate-pulse bg-primary" : "bg-error"
        )}
      />
      <span className="truncate font-mono text-body-md text-on-surface">
        {item.owner}/{item.repo}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-label-sm tnum">
        <span className={cn(item.beforeScore >= 70 ? "text-premium" : "text-error")}>{item.beforeScore}</span>
        <Icon icon={ArrowRight} size="sm" className="h-3 w-3 text-on-surface-variant/60" />
        <span className="font-bold text-positive">{item.afterScore}</span>
        {delta > 0 && (
          <span className="inline-flex items-center gap-0.5 text-positive/80">
            <Icon icon={TrendingUp} size="sm" className="h-3 w-3" />+{delta}
          </span>
        )}
      </span>
      <span className="hidden shrink-0 font-mono text-label-sm text-on-surface-variant/60 sm:inline">
        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
      </span>
      <span className="shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <IconButton
          icon={Trash2}
          label={`Delete ${item.owner}/${item.repo} upgrade`}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
        />
      </span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function Upgrader({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<"input" | "progress" | "report">("input");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<UpgradeJobResponse | null>(null);
  const [recent, setRecent] = useState<UpgradeJobListItem[]>([]);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/upgrade", { cache: "no-store" });
      if (!res.ok) return;
      const items = (await res.json()) as UpgradeJobListItem[];
      setRecent(Array.isArray(items) ? items : []);
    } catch {
      // history is non-critical
    }
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  // ── Polling loop while a job is processing ────────────────────────────────
  useEffect(() => {
    if (view !== "progress" || !job) return;
    let stopped = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/upgrade/${job.id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as UpgradeJobResponse;
        if (stopped) return;
        setJob(data);

        if (data.status === "processing") {
          pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
          return;
        }
        if (data.status === "ready") {
          setView("report");
          void refreshRecent();
          toast({
            title: "Upgrade forged",
            description: `${data.owner}/${data.repo}: ${data.beforeScore} → ${data.afterScore}/100. Every gap closed.`,
            tone: "success",
          });
        }
        // status === "error": stop polling; progress view renders the alert
      } catch {
        if (!stopped) pollTimer.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    void tick();
    return () => {
      stopped = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [view, job, refreshRecent]);

  const submit = useCallback(async () => {
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
    setSubmitting(true);
    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: trimmed }),
      });
      const body = (await res.json()) as { ok: boolean; id?: string; error?: string };
      if (!res.ok || !body.ok || !body.id) {
        toast({
          title: "Upgrade rejected",
          description: body.error ?? `Request failed (HTTP ${res.status}).`,
          tone: "danger",
        });
        return;
      }
      setJob({
        id: body.id,
        repoUrl: trimmed,
        owner: "",
        repo: "",
        status: "processing",
        stage: "queued",
        error: null,
        hadReadme: false,
        beforeScore: 0,
        afterScore: 0,
        wordCountBefore: 0,
        wordCountAfter: 0,
        before: null,
        after: null,
        fixes: [],
        originalReadme: null,
        upgradedReadme: null,
        repoMeta: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setView("progress");
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the Upgrader engine. Try again.",
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }, [url]);

  const openJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/upgrade/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as UpgradeJobResponse;
        setJob(data);
        setUrl(data.repoUrl);
        setView(data.status === "ready" ? "report" : "progress");
      } catch {
        toast({ title: "Could not open upgrade", description: "This upgrade log is unreachable.", tone: "danger" });
      }
    },
    []
  );

  const deleteJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/upgrade/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setRecent((items) => items.filter((i) => i.id !== id));
        toast({ title: "Upgrade log deleted", tone: "success" });
      } catch {
        toast({ title: "Delete failed", description: "Could not delete this upgrade log.", tone: "danger" });
      }
    },
    []
  );

  const backToInput = useCallback(() => {
    setView("input");
    setJob(null);
    void refreshRecent();
  }, [refreshRecent]);

  const viewMotion = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <AnimatePresence mode="wait">
      {view === "input" && (
        <motion.div key="input" {...viewMotion}>
          <div className="flex flex-col gap-10">
            {/* Hero */}
            <FadeIn className="flex flex-col items-center gap-4 pt-2 text-center">
              <p className="font-mono text-label-md tracking-widest text-primary sm:text-body-md">
                {"// README UPGRADER · ZERO-TRUST AUDIT"}
              </p>
              <h1 className="max-w-3xl text-display-sm font-bold leading-tight tracking-tight sm:text-display-lg">
                What&apos;s your README&apos;s score?{" "}
                <span className="text-primary">Make it 100/100.</span>
              </h1>
              <p className="max-w-2xl text-body-sm text-on-surface-variant sm:text-body-lg">
                Paste a repo URL. ShipOS audits the current README across{" "}
                <span className="font-semibold text-on-surface">8 categories — docs, tests, badges, installation, usage, visuals, trust, growth</span>{" "}
                — shows every missing piece with fix guidance, then forges the full 100/100 README with all fixes applied.
              </p>
              <ChipGroup label="What the upgrader checks" className="justify-center">
                {[
                  { icon: Gauge, label: "100-point audit" },
                  { icon: Beaker, label: "tests coverage check" },
                  { icon: Sparkles, label: "badges + hero injection" },
                  { icon: ShieldCheck, label: "zero fabricated claims" },
                ].map((chip) => (
                  <Chip key={chip.label} kind="assist" icon={chip.icon} className="font-mono">
                    {chip.label}
                  </Chip>
                ))}
              </ChipGroup>
            </FadeIn>

            {/* Input card */}
            <FadeIn delay={0.08}>
              <Card padding="lg" className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
                <div className="flex flex-col gap-3">
                  <TextField
                    id="upgrade-url"
                    label="Repo URL"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !submitting) void submit();
                    }}
                    icon={Code2}
                    error={error ?? undefined}
                    className="font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant/60">try:</span>
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
                  </div>
                </div>

                <Button
                  size="lg"
                  fullWidth
                  loading={submitting}
                  loadingLabel="Starting audit…"
                  trailingIcon={TrendingUp}
                  onClick={() => void submit()}
                  className="font-semibold"
                >
                  Score &amp; upgrade my README
                </Button>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { n: "01", t: "Audit", d: "38 checks, 8 weighted categories" },
                    { n: "02", t: "Reveal", d: "missing docs · tests · badges" },
                    { n: "03", t: "Forge", d: "100/100 README, all fixes applied" },
                    { n: "04", t: "Copy", d: "preview, raw markdown, download" },
                  ].map((s) => (
                    <div key={s.n} className="flex flex-col gap-1 rounded-medium bg-surface-container-high p-3">
                      <span className="tnum font-mono text-title-md text-primary/80">{s.n}</span>
                      <p className="text-label-lg font-semibold text-on-surface">{s.t}</p>
                      <p className="font-mono text-label-sm leading-snug text-on-surface-variant">{s.d}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </FadeIn>

            {/* History */}
            {recent.length > 0 && (
              <FadeIn delay={0.12}>
                <section className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
                      <Icon icon={History} size="sm" className="text-primary" />
                      {"// RECENT UPGRADES"}
                    </h2>
                    <span className="tnum font-mono text-label-sm text-on-surface-variant/60">
                      {recent.length} log{recent.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                    {recent.map((item) => (
                      <HistoryRow key={item.id} item={item} onOpen={openJob} onDelete={deleteJob} />
                    ))}
                  </div>
                </section>
              </FadeIn>
            )}

            <FadeIn delay={0.16}>
              <div className="flex justify-center">
                <Button variant="text" size="xs" icon={ArrowLeft} onClick={onBack} className="text-on-surface-variant">
                  Back to the full ShipOS engine
                </Button>
              </div>
            </FadeIn>
          </div>
        </motion.div>
      )}

      {view === "progress" && job && (
        <motion.div key="progress" {...viewMotion}>
          <UpgradeProgress url={job.repoUrl} stage={job.stage} error={job.error} onRetry={backToInput} />
        </motion.div>
      )}

      {view === "report" && job && job.status === "ready" && (
        <motion.div key="report" {...viewMotion}>
          <UpgradeReport job={job} onBack={backToInput} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

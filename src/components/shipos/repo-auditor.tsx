"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Code2,
  Copy,
  Crown,
  Diamond,
  FileText,
  Gauge,
  History,
  Moon,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Wrench,
} from "@/ui/symbols";
import {
  Badge,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Popover,
  Select,
  Slider,
  Spinner,
  TabPanel,
  Tabs,
  TextField,
  Textarea,
  toast,
  cn,
  type IconGlyph,
} from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { AuditJobListItem, AuditJobResponse, Strictness } from "@/lib/shipos/audit-types";
import { STRICTNESS_LABELS } from "@/lib/shipos/audit-types";
import { AuditReport } from "@/components/shipos/audit-report";
import { BulkCompare, pollAudit } from "@/components/shipos/auditor/bulk-compare";
import { OnboardingTour } from "@/components/shipos/auditor/onboarding-tour";
import { PricingModal } from "@/components/shipos/auditor/pricing-modal";
import { ProBadge } from "@/components/shipos/auditor/pro-badge";
import {
  defaultWeights,
  FREE_DAILY_AUDITS,
  isPro,
  sumWeights,
  todayKey,
  useProHydrated,
  useProStore,
  type CategoryWeights,
} from "@/lib/shipos/pro-store";

// ─────────────────────────────────────────────────────────────────────────────
// RepoAuditor — paste a repo URL / file list → 0-100 score → ranked full-code
// fixes. Tabs: GitHub URL · Paste File List · Bulk (PRO) · Compare (PRO).
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_PATTERN = /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

const QUICK_FILLS: { repo: string; label: string }[] = [
  { repo: "sindresorhus/slugify", label: "healthy repo" },
  { repo: "expressjs/express", label: "battle-tested" },
  { repo: "honojs/hono", label: "modern TS" },
  { repo: "octocat/Hello-World", label: "sparse repo" },
];

const STAGES: { id: AuditJobResponse["stage"]; label: string; detail: string; icon: IconGlyph }[] = [
  { id: "ingesting", label: "Ingesting", detail: "repo metadata, tree, manifests, README", icon: Code2 },
  { id: "scanning", label: "Scanning", detail: "workflows, .github folder, non-node manifests", icon: ScanLine },
  { id: "scoring", label: "Scoring", detail: "50 checks · 5 categories · 100 points", icon: Gauge },
  { id: "composing", label: "Composing fixes", detail: "ranked fixes with full copy-paste code", icon: Wrench },
];

const WEIGHT_FIELDS: { key: keyof CategoryWeights; label: string }[] = [
  { key: "docs", label: "Documentation" },
  { key: "quality", label: "Code Quality" },
  { key: "security", label: "Security" },
  { key: "devops", label: "DevOps" },
  { key: "community", label: "Community" },
];

/** Score → the role colour it reads as. */
function scoreClass(score: number): string {
  if (score >= 85) return "text-positive";
  if (score >= 70) return "text-primary";
  if (score >= 50) return "text-premium";
  return "text-error";
}

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

// ── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isLight = resolvedTheme === "light";
  return (
    <IconButton
      icon={isLight ? Sun : Moon}
      label="Toggle color theme"
      variant="outlined"
      size="md"
      title="Toggle color theme"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="shrink-0"
    />
  );
}

// ── Advanced weights popover (PRO-gated) ─────────────────────────────────────

function WeightsPopover({ onUpgrade }: { onUpgrade: () => void }) {
  const hydrated = useProHydrated();
  const tier = useProStore((s) => s.tier);
  const customWeights = useProStore((s) => s.customWeights);
  const setWeights = useProStore((s) => s.setWeights);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CategoryWeights>(customWeights ?? defaultWeights);
  const pro = hydrated && isPro(tier);

  const sum = sumWeights(draft);
  const active = hydrated && customWeights !== null;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(customWeights ?? defaultWeights);
      }}
      label="Advanced category weights"
      trigger={(p) => (
        <Button
          {...p}
          variant="outlined"
          size="md"
          icon={SlidersHorizontal}
          className={cn("font-mono", active ? "text-primary" : "text-on-surface-variant")}
          aria-label="Advanced category weights"
        >
          Weights{active ? " · custom" : ""}
        </Button>
      )}
    >
      <div className="w-80 p-3">
        {pro ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">{"// CUSTOM WEIGHTS"}</p>
              <span className={cn("font-mono text-label-md font-bold tnum", sum === 100 ? "text-positive" : "text-premium")}>Σ {sum}/100</span>
            </div>
            {WEIGHT_FIELDS.map((f) => (
              <Slider
                key={f.key}
                label={f.label}
                valueLabel={String(draft[f.key])}
                value={draft[f.key]}
                min={0}
                max={50}
                step={1}
                onInput={(e) => setDraft((d) => ({ ...d, [f.key]: Number(e.currentTarget.value) }))}
              />
            ))}
            <p className="font-mono text-label-sm leading-relaxed text-on-surface-variant">
              weights must sum to 100 — they re-scale your score client-side (server rubric stays authoritative)
            </p>
            <div className="flex gap-2">
              <Button
                size="xs"
                className="flex-1"
                disabled={sum !== 100}
                onClick={() => {
                  setWeights(draft);
                  setOpen(false);
                  toast({ title: "Custom weights applied", description: "Your score is re-scaled with these weights.", tone: "success" });
                }}
              >
                Apply weights
              </Button>
              <Button
                size="xs"
                variant="outlined"
                icon={RotateCcw}
                onClick={() => {
                  setDraft(defaultWeights);
                  setWeights(null);
                  toast({ title: "Weights reset", description: "Back to the default rubric weights." });
                }}
                className="font-mono"
              >
                Reset
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-premium/10 text-premium">
              <Icon icon={Crown} size="sm" />
            </span>
            <p className="text-title-sm text-on-surface">Custom weights are PRO</p>
            <p className="text-body-sm text-on-surface-variant">Re-scale the rubric to match what your team cares about — e.g. security-first weighting.</p>
            <Button
              size="xs"
              icon={Crown}
              className="bg-premium text-on-premium"
              onClick={() => {
                setOpen(false);
                onUpgrade();
              }}
            >
              Upgrade to PRO
            </Button>
          </div>
        )}
      </div>
    </Popover>
  );
}

// ── Progress view ────────────────────────────────────────────────────────────

function AuditProgress({ url, stage, error, onRetry }: { url: string; stage: string; error: string | null; onRetry: () => void }) {
  const currentIndex = STAGES.findIndex((s) => s.id === stage);

  if (error) {
    return (
      <FadeIn>
        <Card padding="none" className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
            <Icon icon={AlertTriangle} size="md" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-title-lg text-on-surface">Audit aborted</h2>
            <p className="mx-auto max-w-md text-body-sm text-on-surface-variant">{error}</p>
            <p className="font-mono text-label-sm text-on-surface-variant">{url}</p>
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
      <Card padding="none" className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon icon={ScanLine} size="md" className="animate-pulse" />
          </span>
          <h2 className="font-mono text-title-lg text-on-surface">Auditing repository…</h2>
          <p className="truncate font-mono text-label-md text-on-surface-variant">{url}</p>
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
                  "flex items-center gap-3 rounded-small p-3 transition-colors",
                  active ? "bg-primary-container text-on-primary-container" : done ? "bg-surface-container-high text-on-surface" : "bg-surface-container-low text-on-surface-variant opacity-60"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-extra-small",
                    done ? "bg-positive/15 text-positive" : active ? "bg-surface-container-lowest text-primary" : "bg-surface-container-highest text-on-surface-variant"
                  )}
                >
                  {done ? (
                    <Icon icon={CheckCircle2} size="sm" />
                  ) : active ? (
                    <Spinner size="sm" label={`${s.label} in progress`} />
                  ) : (
                    <Icon icon={s.icon} size="sm" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-body-md font-semibold", done || active ? "text-on-surface" : "text-on-surface-variant")}>
                    <span className="font-mono text-label-sm text-on-surface-variant">{String(i + 1).padStart(2, "0")} · </span>
                    {s.label}
                  </p>
                  <p className="truncate font-mono text-label-sm text-on-surface-variant">{s.detail}</p>
                </div>
                {done && (
                  <Badge tone="primary" className="shrink-0 font-mono text-label-sm">
                    done
                  </Badge>
                )}
                {active && !done && (
                  <Badge tone="tertiary" className="shrink-0 font-mono text-label-sm">
                    running
                  </Badge>
                )}
              </motion.div>
            );
          })}
        </div>

        <p className="text-center font-mono text-label-sm text-on-surface-variant">
          deterministic engine — the same repo always scores the same, no LLM guessing
        </p>
      </Card>
    </FadeIn>
  );
}

// ── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ item, onOpen, onDelete }: { item: AuditJobListItem; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(item.id);
      }}
      className={cn("group flex w-full cursor-pointer items-center gap-3 rounded-small bg-surface-container px-4 py-3", interactive())}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          item.status === "ready" ? "bg-positive" : item.status === "processing" ? "animate-pulse bg-premium" : "bg-error"
        )}
        aria-hidden
      />
      <span className="truncate font-mono text-body-md text-on-surface">
        {item.owner}/{item.repo}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-label-md">
        <span className={cn(scoreClass(item.score), "tnum")}>{item.score}/100</span>
        {item.fixesCount > 0 && (
          <span className="text-on-surface-variant">
            · {item.fixesCount} fix{item.fixesCount === 1 ? "" : "es"}
          </span>
        )}
      </span>
      <span className="hidden shrink-0 font-mono text-label-sm text-on-surface-variant sm:inline">
        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
      </span>
      <IconButton
        icon={Trash2}
        label={`Delete ${item.owner}/${item.repo} audit`}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
        className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
      />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function RepoAuditor({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<"input" | "progress" | "report">("input");
  const [job, setJob] = useState<AuditJobResponse | null>(null);
  const [recent, setRecent] = useState<AuditJobListItem[]>([]);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [strictness, setStrictness] = useState<Strictness>("balanced");
  const [inputTab, setInputTab] = useState("url");
  const [filesName, setFilesName] = useState("");
  const [filesText, setFilesText] = useState("");
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [readmeText, setReadmeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingView, setPricingView] = useState<"pricing" | "manage">("pricing");
  const [paywall, setPaywall] = useState(false);
  const [reportTab, setReportTab] = useState("overview");

  const hydrated = useProHydrated();
  const tier = useProStore((s) => s.tier);
  const plan = useProStore((s) => s.plan);
  const auditsUsed = useProStore((s) => s.auditsUsed);
  const auditsDate = useProStore((s) => s.auditsDate);
  const auditsLeft = isPro(tier) ? null : Math.max(0, FREE_DAILY_AUDITS - (auditsDate === todayKey() ? auditsUsed : 0));

  const refreshRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/audit", { cache: "no-store" });
      if (!res.ok) return;
      const items = (await res.json()) as AuditJobListItem[];
      setRecent(Array.isArray(items) ? items : []);
    } catch {
      // history is non-critical
    }
  }, []);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  // ── Polling loop while a job is processing (shared pollAudit helper) ──────
  const jobId = job?.id;
  useEffect(() => {
    if (view !== "progress" || !jobId) return;
    let stopped = false;

    pollAudit(jobId)
      .then((data) => {
        if (stopped) return;
        setJob(data);
        if (data.status === "ready") {
          setView("report");
          void refreshRecent();
          toast({
            title: "Audit complete",
            description: `${data.owner}/${data.repo}: ${data.score}/100 — ${data.fixesCount} ranked fix${data.fixesCount === 1 ? "" : "es"} ready.`,
            tone: "success",
          });
        }
        // status === "error": stop; the progress view renders the alert
      })
      .catch((err: unknown) => {
        if (stopped) return;
        setJob((j) =>
          j && j.id === jobId
            ? { ...j, status: "error", error: err instanceof Error ? err.message : "Lost connection to the audit engine." }
            : j
        );
      });

    return () => {
      stopped = true;
    };
  }, [view, jobId, refreshRecent]);

  const openPricing = useCallback(
    (nextView: "pricing" | "manage", isPaywall = false) => {
      setPaywall(isPaywall);
      setPricingView(nextView);
      setPricingOpen(true);
    },
    []
  );

  const enforceDailyLimit = useCallback((): boolean => {
    if (hydrated && !isPro(useProStore.getState().tier) && useProStore.getState().auditsLeftToday() <= 0) {
      openPricing("pricing", true);
      toast({
        title: "Daily free limit reached",
        description: `${FREE_DAILY_AUDITS}/${FREE_DAILY_AUDITS} free audits used today. Go PRO for unlimited audits — or reset the demo.`,
        tone: "danger",
      });
      return false;
    }
    useProStore.getState().consumeAudit();
    return true;
  }, [hydrated, openPricing]);

  const startAudit = useCallback(
    async (repoUrl: string): Promise<boolean> => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl, strictness }),
        });
        const body = (await res.json()) as { ok: boolean; id?: string; error?: string };
        if (!res.ok || !body.ok || !body.id) {
          toast({
            title: "Audit rejected",
            description: body.error ?? `Request failed (HTTP ${res.status}).`,
            tone: "danger",
          });
          return false;
        }
        setJob({
          id: body.id,
          repoUrl,
          owner: "",
          repo: "",
          status: "processing",
          stage: "queued",
          source: "github",
          strictness,
          error: null,
          score: 0,
          fixesCount: 0,
          checksFailed: 0,
          audit: null,
          repoMeta: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setView("progress");
        return true;
      } catch {
        toast({
          title: "Network error",
          description: "Could not reach the auditor engine. Try again.",
          tone: "danger",
        });
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [strictness]
  );

  const submit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError("Paste a GitHub repo URL first — e.g. https://github.com/owner/repo");
      return;
    }
    if (!REPO_PATTERN.test(trimmed)) {
      setUrlError("URL must look like https://github.com/owner/repo (owner/repo pattern required).");
      return;
    }
    setUrlError(null);
    if (!enforceDailyLimit()) return;
    await startAudit(trimmed);
  }, [url, enforceDailyLimit, startAudit]);

  const submitOffline = useCallback(async () => {
    if (!filesText.trim()) {
      toast({ title: "File list required", description: "Paste at least one file path, one per line." });
      return;
    }
    if (!enforceDailyLimit()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/audit/offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: filesName, files: filesText, readme: readmeText, strictness }),
      });
      const body = (await res.json()) as { ok: boolean; job?: AuditJobResponse; error?: string };
      if (!res.ok || !body.ok || !body.job) {
        toast({ title: "Offline audit failed", description: body.error ?? `HTTP ${res.status}`, tone: "danger" });
        return;
      }
      setJob(body.job);
      setView("report");
      void refreshRecent();
      toast({
        title: "Offline audit ready",
        description: `${body.job.repo}: ${body.job.score}/100 — ${body.job.fixesCount} ranked fix${body.job.fixesCount === 1 ? "" : "es"}.`,
        tone: "success",
      });
    } catch {
      toast({ title: "Network error", description: "Could not reach the offline auditor.", tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }, [filesText, filesName, readmeText, strictness, enforceDailyLimit, refreshRecent]);

  const reAudit = useCallback(async () => {
    if (!job || job.source !== "github") return;
    if (!enforceDailyLimit()) return;
    const ok = await startAudit(job.repoUrl);
    if (ok) setReportTab("overview");
  }, [job, enforceDailyLimit, startAudit]);

  const handleAuditStarted = useCallback(
    (id: string, repoUrl: string) => {
      setUrl(repoUrl);
      setJob({
        id,
        repoUrl,
        owner: "",
        repo: "",
        status: "processing",
        stage: "queued",
        source: "github",
        strictness,
        error: null,
        score: 0,
        fixesCount: 0,
        checksFailed: 0,
        audit: null,
        repoMeta: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setView("progress");
    },
    [strictness]
  );

  const openJob = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/audit/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AuditJobResponse;
      setJob(data);
      setUrl(data.repoUrl);
      setReportTab("overview");
      setView(data.status === "ready" ? "report" : "progress");
    } catch {
      toast({ title: "Could not open audit", description: "This audit log is unreachable.", tone: "danger" });
    }
  }, []);

  const deleteJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/audit/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setRecent((items) => items.filter((i) => i.id !== id));
        toast({ title: "Audit log deleted", tone: "success" });
      } catch {
        toast({ title: "Delete failed", description: "Could not delete this audit log.", tone: "danger" });
      }
    },
    []
  );

  const backToInput = useCallback(() => {
    setView("input");
    setJob(null);
    void refreshRecent();
  }, [refreshRecent]);

  const openUpgrade = useCallback(() => openPricing("pricing"), [openPricing]);

  const handleBadgeClick = useCallback(() => {
    if (view === "report") {
      setReportTab("pro");
    } else {
      openPricing("manage");
    }
  }, [view, openPricing]);

  const viewMotion = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="text" icon={ArrowLeft} onClick={onBack} className="text-on-surface-variant">
          Back
        </Button>
        <div className="flex items-center gap-2">
          {hydrated && isPro(tier) && <ProBadge plan={plan} onOpenManage={handleBadgeClick} />}
          <Button
            type="button"
            variant="outlined"
            icon={Diamond}
            onClick={() => openPricing(hydrated && isPro(tier) ? "manage" : "pricing")}
            className="font-mono"
          >
            Pricing
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === "input" && (
          <motion.div key="input" {...viewMotion}>
            <div className="flex flex-col gap-8">
              {/* Hero */}
              <FadeIn className="flex flex-col items-center gap-4 pt-2 text-center">
                <p className="font-mono text-label-md tracking-widest text-primary sm:text-body-md">
                  {"// FULL REPO AUDITOR · DETERMINISTIC · 100-POINT"}
                </p>
                <h1 className="max-w-3xl text-display-sm leading-tight text-on-surface sm:text-display-lg">
                  What&apos;s your repo&apos;s score?{" "}
                  <span className="text-primary">Get the ranked path to 100/100.</span>
                </h1>
                <p className="font-mono text-label-sm tracking-wide text-on-surface-variant sm:text-label-md">
                  50 checks · 5 weighted categories — Documentation 25 · Code Quality 25 · Security 20 · DevOps 15 · Community 15
                </p>
                <p className="max-w-2xl text-body-md text-on-surface-variant sm:text-body-lg">
                  Paste a repo URL, drop a file list, or bulk-audit a fleet. Every missing point gets a fix{" "}
                  <span className="font-semibold text-primary">ranked by points, with full copy-paste code</span>.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {[
                    { icon: Gauge, label: "50 checks · 100 points" },
                    { icon: ShieldCheck, label: "deterministic — zero LLM guessing" },
                    { icon: Wrench, label: "full code for every fix" },
                    { icon: Sparkles, label: "roadmap to exactly 100/100" },
                  ].map((chip) => (
                    <span
                      key={chip.label}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1.5 font-mono text-label-sm text-on-surface-variant"
                    >
                      <Icon icon={chip.icon} size="sm" className="text-primary" />
                      {chip.label}
                    </span>
                  ))}
                </div>
              </FadeIn>

              {/* Input card with mode tabs */}
              <FadeIn delay={0.08}>
                <Card padding="none" className="mx-auto w-full max-w-3xl p-4 sm:p-6">
                  <Tabs<string>
                    label="Audit input mode"
                    value={inputTab}
                    onChange={setInputTab}
                    className="w-full flex-wrap"
                    items={[
                      { value: "url", label: <span className="flex items-center gap-1.5"><Icon icon={Code2} size="sm" />GitHub URL</span> },
                      { value: "files", label: <span className="flex items-center gap-1.5"><Icon icon={FileText} size="sm" />Paste File List</span> },
                      { value: "bulk", label: <span className="flex items-center gap-1.5"><Icon icon={Copy} size="sm" />Bulk (PRO)</span> },
                      { value: "compare", label: <span className="flex items-center gap-1.5"><Icon icon={Crown} size="sm" />Compare (PRO)</span> },
                    ]}
                  />

                  {/* GitHub URL tab */}
                  {inputTab === "url" && (
                    <TabPanel className="mt-1 flex flex-col gap-3">
                      <TextField
                        id="audit-url"
                        label="Repo URL"
                        icon={Code2}
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value);
                          if (urlError) setUrlError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !submitting) void submit();
                        }}
                        error={urlError ?? undefined}
                        className="font-mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">try:</span>
                        {QUICK_FILLS.map((qf) => (
                          <Chip
                            key={qf.repo}
                            kind="suggestion"
                            onClick={() => {
                              setUrl(`https://github.com/${qf.repo}`);
                              setUrlError(null);
                            }}
                            className="font-mono"
                          >
                            {qf.repo}
                            <span className="text-on-surface-variant">({qf.label})</span>
                          </Chip>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          label="Strictness mode"
                          value={strictness}
                          onChange={(e) => setStrictness(e.target.value as Strictness)}
                          className="sm:w-64"
                        >
                          {(Object.keys(STRICTNESS_LABELS) as Strictness[]).map((s) => (
                            <option key={s} value={s}>
                              {STRICTNESS_LABELS[s]}
                            </option>
                          ))}
                        </Select>
                        <WeightsPopover onUpgrade={openUpgrade} />
                        {auditsLeft !== null && hydrated && (
                          <Badge variant="outlined" className="px-3 font-mono text-label-sm text-on-surface-variant">
                            {auditsLeft}/{FREE_DAILY_AUDITS} free audits left today
                          </Badge>
                        )}
                      </div>

                      <Button
                        size="lg"
                        fullWidth
                        trailingIcon={ArrowRight}
                        onClick={() => void submit()}
                        loading={submitting}
                        loadingLabel="Starting audit…"
                      >
                        {submitting ? "Starting audit…" : "Audit my repository"}
                      </Button>
                    </TabPanel>
                  )}

                  {/* File list tab */}
                  {inputTab === "files" && (
                    <TabPanel className="mt-1 flex flex-col gap-3">
                      <TextField
                        id="files-name"
                        label="Project name (optional)"
                        value={filesName}
                        onChange={(e) => setFilesName(e.target.value)}
                        hint="my-repo"
                        className="font-mono"
                        spellCheck={false}
                      />
                      <Textarea
                        id="files-text"
                        label="File paths — one per line"
                        value={filesText}
                        onChange={(e) => setFilesText(e.target.value)}
                        rows={5}
                        className="font-mono"
                        spellCheck={false}
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setReadmeOpen((v) => !v)}
                          aria-expanded={readmeOpen}
                          className={cn("flex w-fit items-center gap-1.5 rounded-extra-small px-1 font-mono text-label-md text-on-surface-variant", interactive())}
                        >
                          <Icon icon={FileText} size="sm" />
                          Optional: paste README content
                          <span className="font-mono text-label-sm text-on-surface-variant">(boosts the docs score)</span>
                        </button>
                        {readmeOpen && (
                          <Textarea
                            label="README content"
                            value={readmeText}
                            onChange={(e) => setReadmeText(e.target.value)}
                            rows={5}
                            className="font-mono"
                          />
                        )}
                      </div>
                      <Button
                        size="lg"
                        fullWidth
                        icon={ScanLine}
                        onClick={() => void submitOffline()}
                        loading={submitting}
                        loadingLabel="Scoring files…"
                      >
                        {submitting ? "Scoring files…" : "Audit offline"}
                      </Button>
                      <p className="text-center font-mono text-label-sm text-on-surface-variant">zero network — the same 50-check rubric scores your file list instantly</p>
                    </TabPanel>
                  )}

                  {/* Bulk + Compare tabs */}
                  {inputTab === "bulk" && (
                    <TabPanel className="mt-1">
                      <BulkCompare initialMode="bulk" isProUser={hydrated && isPro(tier)} onUpgrade={openUpgrade} onOpenAudit={openJob} />
                    </TabPanel>
                  )}
                  {inputTab === "compare" && (
                    <TabPanel className="mt-1">
                      <BulkCompare initialMode="compare" isProUser={hydrated && isPro(tier)} onUpgrade={openUpgrade} onOpenAudit={openJob} />
                    </TabPanel>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { n: "01", t: "Scan", d: "metadata, tree, workflows, .github, manifests" },
                      { n: "02", t: "Score", d: "50 deterministic checks · 5 categories" },
                      { n: "03", t: "Rank", d: "every fix ordered by points recovered" },
                      { n: "04", t: "Apply", d: "full code, copy-paste, re-audit to verify" },
                    ].map((s) => (
                      <div key={s.n} className="flex flex-col gap-1 rounded-small bg-surface-container-high p-3">
                        <span className="font-mono text-title-lg font-bold text-primary">{s.n}</span>
                        <p className="text-body-sm font-semibold text-on-surface">{s.t}</p>
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
                        {"// RECENT AUDITS"}
                      </h2>
                      <span className="font-mono text-label-sm text-on-surface-variant">{recent.length} log{recent.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                      {recent.map((item) => (
                        <HistoryRow key={item.id} item={item} onOpen={openJob} onDelete={deleteJob} />
                      ))}
                    </div>
                  </section>
                </FadeIn>
              )}
            </div>
          </motion.div>
        )}

        {view === "progress" && job && (
          <motion.div key="progress" {...viewMotion}>
            <AuditProgress url={job.repoUrl} stage={job.stage} error={job.error} onRetry={backToInput} />
          </motion.div>
        )}

        {view === "report" && job && job.status === "ready" && (
          <motion.div key="report" {...viewMotion}>
            <AuditReport
              job={job}
              isProUser={hydrated && isPro(tier)}
              onUpgrade={openUpgrade}
              onBack={backToInput}
              onReAudit={() => void reAudit()}
              onAuditStarted={handleAuditStarted}
              items={recent}
              onOpen={openJob}
              tab={reportTab}
              onTabChange={setReportTab}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding + pricing */}
      <OnboardingTour />
      <PricingModal open={pricingOpen} onOpenChange={(o) => { setPricingOpen(o); if (!o) setPaywall(false); }} initialView={pricingView} paywall={paywall} />
    </div>
  );
}

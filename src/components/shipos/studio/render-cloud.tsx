"use client";

// ─────────────────────────────────────────────────────────────────────────────
// RenderCloud — Path B: the free-GPU render queue.
//   · live GPU budget (300s/day free ZeroGPU model, 26s per video)
//   · submit form: audit → preset · resolution (4K = PRO) · voice
//   · live stage tracker: Queued → Ingesting → Verifying → GPU bursts →
//     Remotion CPU render → ffmpeg mux → bundle
//   · download center: the full submission bundle ZIP when the job lands
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  Cloud,
  Cpu,
  Crown,
  Download,
  Gauge,
  Package,
  Rocket,
  ScanLine,
  Server,
  Timer,
  Zap,
} from "@/ui/symbols";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Progress,
  SegmentedButton,
  Select,
  Spinner,
  Status,
  Steps,
  TextField,
  type BadgeTone,
  type IconGlyph,
} from "@/ui";
import type { AuditJobListItem } from "@/lib/shipos/audit-types";
import { RENDER_PRESETS, RENDER_VOICES, RENDER_STAGES, formatCountdown, type QuotaSnapshot, type RenderJobListItem } from "@/lib/shipos/render-types";
import { fmtClock } from "../auditor/story/story-utils";

const STAGE_INDEX: Record<string, number> = Object.fromEntries(RENDER_STAGES.map((s, i) => [s.id, i]));

/** Status → badge role. The word inside the badge still says what happened. */
const STATUS_TONE: Record<string, BadgeTone> = {
  queued: "neutral",
  rendering: "primary",
  done: "primary",
  failed: "error",
  canceled: "neutral",
};

const PIPELINE: { n: string; t: string; d: string; icon: IconGlyph }[] = [
  { n: "01", t: "GPU bursts", d: "Kokoro VO 8s · SDXL banners 5s · Whisper captions 13s — 26s per video", icon: Zap },
  { n: "02", t: "CPU render", d: "Remotion composition + ffmpeg mux — unlimited, free, slow-but-steady", icon: Cpu },
  { n: "03", t: "Bundle", d: "schema · brief · SRT · landing · slides · offline player · deploy files", icon: Package },
  { n: "04", t: "Deploy", d: "Upload deploy/ to an HF Space (Gradio + ZeroGPU) for real 4K MP4", icon: Cloud },
];

export function RenderCloud({
  isProUser,
  onUpgrade,
  onGoAudit,
  initialAuditId,
}: {
  isProUser: boolean;
  onUpgrade: () => void;
  onGoAudit?: () => void;
  initialAuditId?: string | null;
}) {
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
  const [jobs, setJobs] = useState<RenderJobListItem[]>([]);
  const [list, setList] = useState<AuditJobListItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [repoUrl, setRepoUrl] = useState("");
  const [auditId, setAuditId] = useState<string>("");
  const [preset, setPreset] = useState<string>("meta-hackathon");
  const [resolution, setResolution] = useState<"1080p" | "4k">("1080p");
  const [voice, setVoice] = useState<string>("authoritative");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/render", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { quota: QuotaSnapshot; jobs: RenderJobListItem[] };
      setQuota(body.quota);
      setJobs(body.jobs);
    } catch {
      // polling error — keep last snapshot
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/audit", { cache: "no-store" });
        if (!res.ok) return;
        const items = (await res.json()) as AuditJobListItem[];
        const ready = items.filter((i) => i.status === "ready");
        setList(ready);
        const preferred = initialAuditId && ready.some((i) => i.id === initialAuditId) ? initialAuditId : ready[0]?.id;
        if (preferred) {
          setAuditId(preferred);
          const match = ready.find((i) => i.id === preferred);
          if (match) setRepoUrl(match.repoUrl);
        }
      } catch {
        // non-critical
      }
    })();
  }, [initialAuditId]);

  const pickAudit = (id: string) => {
    setAuditId(id);
    const match = list.find((i) => i.id === id);
    if (match) setRepoUrl(match.repoUrl);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, auditId, preset, resolution, voice }),
      });
      const body = (await res.json()) as { ok: boolean; message?: string; error?: string };
      if (body.ok) {
        // rough toast without importing the toast hook twice — use window event? keep simple:
        setSubmitMessage(body.message ?? "Job queued.");
      } else {
        setSubmitMessage(body.error ?? "Submission failed.");
        if (res.status === 402) onUpgrade();
      }
      void refresh();
    } catch {
      setSubmitMessage("Network error — could not reach the queue.");
    } finally {
      setSubmitting(false);
    }
  };

  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const cancel = async (id: string) => {
    try {
      const res = await fetch(`/api/render/${id}`, { method: "DELETE" });
      const body = (await res.json()) as { ok: boolean; error?: string };
      setSubmitMessage(body.ok ? `Job ${id.slice(-6)} canceled.` : (body.error ?? "Cancel failed."));
      void refresh();
    } catch {
      setSubmitMessage("Network error.");
    }
  };

  const pct = quota ? Math.min(100, (quota.used / quota.limit) * 100) : 0;
  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "rendering");
  const stageSteps = RENDER_STAGES.filter((s) => s.id !== "done").map((s) => s.label);

  // ── empty state ────────────────────────────────────────────────────────────
  if (list.length === 0) {
    return (
      <EmptyState
        size="page"
        icon={Cloud}
        title="Render Cloud needs an audit"
        description="The ZeroGPU worker renders the story of an audit — run the Full Repo Auditor first, then submit the 4K pipeline here."
        action={
          <Button icon={ScanLine} onClick={onGoAudit}>
            Run the Full Repo Auditor
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 rounded-small bg-secondary-container px-4 py-3 text-on-secondary-container">
        <Icon icon={Cloud} size="sm" className="shrink-0" />
        <p className="min-w-0 text-body-sm">
          <span className="font-semibold">Render Cloud (Path B)</span> — real 4K pipeline on the free tier: GPU bursts for voiceover, banners and captions;
          Remotion + ffmpeg run on CPU, unlimited.
        </p>
      </div>

      {/* ── quota dashboard ─────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col gap-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-mono text-label-md font-semibold uppercase tracking-widest text-on-surface-variant">
              <Icon icon={Zap} size="sm" className="text-primary" />
              GPU Budget — today
            </h3>
            <span className="font-mono text-label-sm text-on-surface-variant">{quota?.date ?? "…"}</span>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-headline-md text-positive">{quota?.used ?? 0}s</span>
            <span className="text-body-sm text-on-surface-variant">/ {quota?.limit ?? 300}s used</span>
            <Badge tone="primary" numeric className="ml-auto">
              {quota?.remaining ?? 300}s left
            </Badge>
          </div>
          <Progress value={pct} label="GPU budget used" />
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <Icon icon={Timer} size="sm" className="h-3 w-3 text-premium" />
              resets in {quota ? formatCountdown(quota.resetsIn) : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon icon={Package} size="sm" className="h-3 w-3 text-primary" />
              {quota?.queueLength ?? 0} job{(quota?.queueLength ?? 0) === 1 ? "" : "s"} pending
            </span>
            <span className="flex items-center gap-1.5">
              <Icon icon={CheckCircle2} size="sm" className="h-3 w-3 text-positive" />
              {quota?.renderedToday ?? 0} rendered today
            </span>
            <span className="flex items-center gap-1.5">
              <Icon icon={Cpu} size="sm" className="h-3 w-3 text-primary" />
              26s GPU / video · CPU render free
            </span>
          </div>
          {quota?.exhausted && (
            <Alert tone="warning">
              Free GPU window exhausted — new jobs park in the queue and <strong>resume at the next reset</strong>.
            </Alert>
          )}
        </Card>

        {/* ── submit form ──────────────────────────────────────────────── */}
        <Card className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 font-mono text-label-md font-semibold uppercase tracking-widest text-on-surface-variant">
            <Icon icon={Rocket} size="sm" className="text-primary" />
            Submit render
          </h3>
          <Select label="Audited repo" value={auditId} onChange={(e) => pickAudit(e.target.value)}>
            {list.map((i) => (
              <option key={i.id} value={i.id}>
                {i.owner}/{i.repo} · {i.score}/100
              </option>
            ))}
          </Select>
          <TextField
            label="Repo URL"
            dense
            hint="github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="font-mono"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select label="Preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
              {RENDER_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select label="Voice" value={voice} onChange={(e) => setVoice(e.target.value)}>
              {RENDER_VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-label-md text-on-surface-variant">Resolution</span>
            <SegmentedButton
              label="Resolution"
              options={[
                { value: "1080p", label: "1080p free" },
                { value: "4k", label: "4K UHD", icon: Crown },
              ]}
              value={resolution}
              onChange={(r) => {
                if (r === "4k" && !isProUser) {
                  onUpgrade();
                  return;
                }
                setResolution(r);
              }}
            />
          </div>
          <Button icon={Rocket} loading={submitting} loadingLabel="Submitting render" onClick={() => void submit()}>
            Generate MP4
          </Button>
          {submitMessage && (
            <p role="status" className="font-mono text-label-sm leading-relaxed text-on-surface-variant">
              {submitMessage}
            </p>
          )}
        </Card>
      </div>

      {/* ── queue list ──────────────────────────────────────────────────── */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-mono text-label-md font-semibold uppercase tracking-widest text-on-surface-variant">
            <Icon icon={Server} size="sm" className="text-primary" />
            Queue · {jobs.length} job{jobs.length === 1 ? "" : "s"}
          </h3>
          <span className="font-mono text-label-sm text-on-surface-variant">polling every 2s</span>
        </div>

        {jobs.length === 0 ? (
          <EmptyState icon={Package} title="No renders yet" description="Submit the first cut above." />
        ) : (
          <div className="flex max-h-[480px] flex-col gap-3 overflow-y-auto pr-1">
            {jobs.map((j) => {
              const stageIdx = STAGE_INDEX[j.stage] ?? 0;
              const done = j.status === "done";
              const held = j.quotaHeld && j.status === "queued";
              return (
                <div key={j.id} className="flex flex-col gap-2.5 rounded-small bg-surface-container-high p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {done ? (
                      <Status state="live" className="uppercase">
                        done
                      </Status>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {j.status === "rendering" && <Spinner size="sm" label="Rendering" />}
                        <Badge tone={STATUS_TONE[j.status] ?? "neutral"} size="sm" className="font-mono uppercase">
                          {j.status}
                        </Badge>
                      </span>
                    )}
                    <span className="text-body-md font-semibold">{j.owner}/{j.repo}</span>
                    <Badge tone="neutral" size="sm" className="font-mono">
                      {j.preset}
                    </Badge>
                    <Badge tone="neutral" size="sm" className="font-mono">
                      {j.resolution}
                    </Badge>
                    <Badge tone="neutral" size="sm" className="font-mono">
                      {j.voice}
                    </Badge>
                    <span className="ml-auto font-mono text-label-sm text-on-surface-variant">
                      {formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}
                      {j.gpuSeconds > 0 ? ` · ${j.gpuSeconds}s GPU` : ""}
                    </span>
                  </div>

                  <Progress value={j.progress} label={`Render progress ${j.progress}%`} />

                  {/* stage stepper */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Steps
                      steps={stageSteps}
                      current={done ? stageSteps.length : held ? stageIdx - 1 : stageIdx}
                      className="min-w-0 flex-1"
                    />
                    <span className="ml-auto font-mono text-label-sm text-on-surface-variant">
                      {done ? (
                        <span className="text-positive">bundle ready</span>
                      ) : held ? (
                        <span className="text-premium">held — resumes at reset</span>
                      ) : j.status === "canceled" ? (
                        "canceled"
                      ) : (
                        `ETA ${fmtClock(j.etaSeconds)}`
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {done ? (
                      <a href={`/api/render/${j.id}?download=zip`} download>
                        <Button size="xs" variant="tonal" icon={Download}>
                          Download ZIP
                        </Button>
                      </a>
                    ) : (
                      (j.status === "queued" || j.status === "rendering") && (
                        <Button size="xs" variant="outlined" className="text-error" icon={Ban} onClick={() => void cancel(j.id)}>
                          Cancel
                        </Button>
                      )
                    )}
                    <span className="ml-auto flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
                      <Icon icon={Gauge} size="sm" className="h-3 w-3" />
                      job {j.id.slice(-6)}
                      {done && (
                        <span className="ml-2 flex items-center gap-1 text-positive">
                          <Icon icon={BadgeCheck} size="sm" className="h-3 w-3" />
                          schema · brief · srt · landing · slides · player · deploy
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* pipeline explainer */}
      <Card padding="md">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((s) => (
            <div key={s.n} className="flex flex-col gap-1 rounded-small bg-surface-container-high p-3">
              <span className="flex items-center gap-1.5 font-mono text-title-lg text-primary">
                <Icon icon={s.icon} size="sm" />
                {s.n}
              </span>
              <p className="text-title-sm text-on-surface">{s.t}</p>
              <p className="font-mono text-label-sm leading-snug text-on-surface-variant">{s.d}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

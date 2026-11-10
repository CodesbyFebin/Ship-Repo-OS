"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  BadgeCheck,
  CalendarClock,
  Calculator,
  Check,
  Copy,
  Crown,
  GitBranch,
  KeyRound,
  Lock,
  Play,
  Plus,
  Timer,
  Trash2,
  TrendingUp,
  Users,
  Wrench,
} from "@/ui/symbols";
import {
  Alert,
  Badge,
  Button,
  Card,
  CodeBlock,
  Icon,
  IconButton,
  Metric,
  Section,
  Select,
  Slider,
  Switch,
  TextField,
  toast,
  cn,
  type IconGlyph,
} from "@/ui";
import type { AuditJobListItem, AuditJobResponse } from "@/lib/shipos/audit-types";
import { gradeFor } from "@/lib/shipos/audit-types";
import { ManageSubscription } from "@/components/shipos/auditor/pricing-modal";
import { isPro, isTeam, useProHydrated, useProStore } from "@/lib/shipos/pro-store";

// ─────────────────────────────────────────────────────────────────────────────
// ProHub — the PRO dashboard tab: stats, badge generator, scheduled audits,
// API keys (TEAM), team workspace (TEAM), ROI calculator, manage subscription.
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

interface ScheduledItem {
  id: string;
  repoUrl: string;
  owner: string;
  repo: string;
  frequency: string;
  enabled: boolean;
  lastScore: number | null;
  lastRunAt: string | null;
  createdAt: string;
}

interface ApiKeyItem {
  id: string;
  key: string;
  label: string;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

interface TeamMemberItem {
  id: string;
  name: string;
  handle: string;
  role: string;
  status: string;
  createdAt: string;
}

const BADGE_COLORS: Record<string, string> = {
  S: "9333ea",
  A: "10b981",
  B: "f59e0b",
  C: "f97316",
  D: "fb7185",
  F: "e11d48",
};

const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;

function LockedCard({ title, description, badge, onUpgrade }: { title: string; description: string; badge: string; onUpgrade: () => void }) {
  return (
    <Card padding="none" className="flex flex-col items-center gap-3 bg-premium/[0.06] p-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-premium-container text-on-premium-container dark:bg-premium dark:text-on-premium">
        <Icon icon={Lock} size="md" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="flex items-center justify-center gap-2 text-title-sm text-on-surface">
          {title}
          <Badge tone="premium" className="font-mono text-label-sm">
            {badge}
          </Badge>
        </p>
        <p className="mx-auto max-w-sm text-body-sm text-on-surface-variant">{description}</p>
      </div>
      <Button size="xs" onClick={onUpgrade} className="bg-premium text-on-premium" icon={Crown}>
        Upgrade
      </Button>
    </Card>
  );
}

function SectionTitle({ icon, label }: { icon: IconGlyph; label: string }) {
  return (
    <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
      <Icon icon={icon} size="sm" className="text-primary" />
      {label}
    </p>
  );
}

export function ProHub({
  job,
  onAuditStarted,
  onUpgrade,
}: {
  job: AuditJobResponse | null;
  onAuditStarted: (id: string, repoUrl: string) => void;
  onUpgrade: () => void;
}) {
  const hydrated = useProHydrated();
  const tier = useProStore((s) => s.tier);
  const fixesApplied = useProStore((s) => s.fixesApplied);
  const proStatsSeed = useProStore((s) => s.proStatsSeed);
  const [history, setHistory] = useState<AuditJobListItem[]>([]);

  useEffect(() => {
    let stopped = false;
    void (async () => {
      try {
        const res = await fetch("/api/audit", { cache: "no-store" });
        if (!res.ok) return;
        const items = (await res.json()) as AuditJobListItem[];
        if (!stopped) setHistory(Array.isArray(items) ? items : []);
      } catch {
        // stats are non-critical
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  const pro = hydrated && isPro(tier);
  const team = hydrated && isTeam(tier);
  const fixesAppliedCount = useMemo(() => Object.values(fixesApplied).reduce((sum, arr) => sum + arr.length, 0), [fixesApplied]);

  return (
    <div className="flex flex-col gap-4">
      <ProStats pro={pro} auditsRun={proStatsSeed} fixesAppliedCount={fixesAppliedCount} history={history} />
      <BadgeGenerator job={job} pro={pro} onUpgrade={onUpgrade} />
      <ScheduledAudits pro={pro} onUpgrade={onUpgrade} onAuditStarted={onAuditStarted} />
      <ApiKeysSection team={team} onUpgrade={onUpgrade} />
      <TeamSection team={team} onUpgrade={onUpgrade} />
      <RoiCalculator />
      <ManageSubscription />
      {hydrated && (
        <p className="flex items-center justify-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <Icon icon={BadgeCheck} size="sm" className="text-premium" />
          license synced from /api/pro — tier {tier}
        </p>
      )}
    </div>
  );
}

// ── PRO Stats ────────────────────────────────────────────────────────────────

function ProStats({
  pro,
  auditsRun,
  fixesAppliedCount,
  history,
}: {
  pro: boolean;
  auditsRun: number;
  fixesAppliedCount: number;
  history: AuditJobListItem[];
}) {
  const ready = history.filter((h) => h.status === "ready");
  const avgUplift = ready.length ? Math.round(ready.reduce((sum, h) => sum + (100 - h.score), 0) / ready.length) : null;
  const hoursSaved = ((fixesAppliedCount * 25) / 60).toFixed(1);

  const tiles = [
    { icon: GitBranch, label: "audits run", value: String(auditsRun), hint: pro ? "unlimited on PRO" : "3/day on FREE" },
    { icon: Wrench, label: "fixes applied", value: String(fixesAppliedCount), hint: "tracked per audit" },
    { icon: Timer, label: "time saved", value: `${hoursSaved} h`, hint: "≈ 25 min per fix" },
    { icon: TrendingUp, label: "avg uplift / audit", value: avgUplift === null ? "—" : `+${avgUplift} pts`, hint: `${ready.length} finished audit${ready.length === 1 ? "" : "s"}` },
  ];

  return (
    <Section
      title={
        <span className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
          <Icon icon={TrendingUp} size="sm" className="text-primary" />
          {"// PRO STATS"}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Metric
            key={t.label}
            label={
              <span className="flex items-center gap-1.5 font-mono text-label-sm uppercase tracking-wider">
                <Icon icon={t.icon} size="sm" className="text-primary" />
                {t.label}
              </span>
            }
            value={<span className="font-mono text-title-lg">{t.value}</span>}
            hint={<span className="font-mono">{t.hint}</span>}
          />
        ))}
      </div>
    </Section>
  );
}

// ── Badge Generator ──────────────────────────────────────────────────────────

function BadgeGenerator({ job, pro, onUpgrade }: { job: AuditJobResponse | null; pro: boolean; onUpgrade: () => void }) {
  const score = job?.status === "ready" ? (job.audit?.score ?? job.score) : null;
  const grade = score !== null ? gradeFor(score) : null;
  const color = grade ? BADGE_COLORS[grade] : "10b981";
  const markdown = score !== null ? `![ShipOS Score](https://img.shields.io/badge/ShipOS%20Score-${score}%2F100-${color})` : "";

  const content = (
    <Card padding="none" className="p-4 sm:p-5">
      <SectionTitle icon={BadgeCheck} label="// BADGE GENERATOR" />
      {job && score !== null ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 rounded-small bg-surface-container-low p-3">
            <img
              src={`https://img.shields.io/badge/ShipOS%20Score-${score}%2F100-${color}.svg`}
              alt={`ShipOS Score badge for ${job.owner}/${job.repo}: ${score} out of 100, grade ${grade}`}
              className="h-5 w-auto"
            />
            <span className="font-mono text-label-sm text-on-surface-variant">
              {job.owner}/{job.repo} · grade {grade} · color {color}
            </span>
          </div>
          <CodeBlock
            title="README.md"
            action={
              <Button
                variant="outlined"
                size="xs"
                aria-label="Copy badge markdown"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(markdown);
                    toast({ title: "Copied", description: "Badge markdown is on your clipboard.", tone: "success" });
                  } catch {
                    toast({ title: "Copy failed", description: "Clipboard unavailable in this context.", tone: "danger" });
                  }
                }}
                icon={Copy}
                className="font-mono"
              >
                Copy markdown
              </Button>
            }
          >
            {markdown}
          </CodeBlock>
          <p className="font-mono text-label-sm text-on-surface-variant">paste it at the top of your README — it re-renders as your score moves</p>
        </div>
      ) : (
        <p className="mt-3 rounded-small bg-surface-container-low p-4 text-center text-body-sm text-on-surface-variant">
          Run an audit first — the badge is generated from the audited repo&apos;s score and grade.
        </p>
      )}
    </Card>
  );

  if (!pro) {
    return (
      <LockedCard
        title="Badge Generator"
        description="ShipOS score badges for your README, colored by grade (S violet → F rose), with one-click markdown."
        badge="PRO"
        onUpgrade={onUpgrade}
      />
    );
  }
  return content;
}

// ── Scheduled Audits ─────────────────────────────────────────────────────────

function ScheduledAudits({
  pro,
  onUpgrade,
  onAuditStarted,
}: {
  pro: boolean;
  onUpgrade: () => void;
  onAuditStarted: (id: string, repoUrl: string) => void;
}) {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [repoUrl, setRepoUrl] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduled", { cache: "no-store" });
      if (!res.ok) return;
      setItems((await res.json()) as ScheduledItem[]);
    } catch {
      toast({ title: "Could not load scheduled audits", tone: "danger" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async () => {
    if (!repoUrl.trim()) {
      toast({ title: "Repo URL required", description: "e.g. https://github.com/owner/repo" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim(), frequency }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setRepoUrl("");
      await refresh();
      toast({ title: "Scheduled", description: `This repo will be audited ${frequency}.`, tone: "success" });
    } catch (err) {
      toast({ title: "Could not schedule", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: ScheduledItem) => {
    try {
      const res = await fetch("/api/scheduled", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, enabled: !item.enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, enabled: !i.enabled } : i)));
    } catch {
      toast({ title: "Toggle failed", tone: "danger" });
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/scheduled?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Schedule removed", tone: "success" });
    } catch {
      toast({ title: "Delete failed", tone: "danger" });
    }
  };

  const runNow = async (item: ScheduledItem) => {
    setRunningId(item.id);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: item.repoUrl }),
      });
      const body = (await res.json()) as { ok: boolean; id?: string; error?: string };
      if (!res.ok || !body.ok || !body.id) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast({ title: "Audit started", description: `${item.repo} is being audited now.`, tone: "success" });
      onAuditStarted(body.id, item.repoUrl);
    } catch (err) {
      toast({ title: "Run now failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setRunningId(null);
    }
  };

  const content = (
    <Card padding="none" className="p-4 sm:p-5">
      <SectionTitle icon={CalendarClock} label="// SCHEDULED AUDITS" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            label="Repo URL"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            hint="https://github.com/owner/repo"
            className="flex-1 font-mono"
            spellCheck={false}
          />
          <Select label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value === "weekly" ? "weekly" : "daily")} className="sm:w-40">
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
          </Select>
          <div className="flex items-end">
            <Button icon={Plus} onClick={() => void add()} disabled={busy} loading={busy} loadingLabel="Scheduling…">
              Schedule
            </Button>
          </div>
        </div>

        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-small bg-surface-container-low p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-body-sm text-on-surface">
                  {item.owner}/{item.repo}
                </p>
                <p className="font-mono text-label-sm text-on-surface-variant">
                  {item.frequency} · {item.lastRunAt ? `last run ${format(new Date(item.lastRunAt), "MMM d")}` : "never run"}
                  {item.lastScore !== null ? ` · last score ${item.lastScore}/100` : ""}
                </p>
              </div>
              <Badge tone={item.enabled ? "primary" : "neutral"} className="font-mono text-label-sm">
                {item.enabled ? "on" : "off"}
              </Badge>
              <Switch
                checked={item.enabled}
                onChange={() => void toggle(item)}
                label={<span className="sr-only">Toggle schedule for {item.repo}</span>}
                className="shrink-0"
              />
              <Button
                variant="outlined"
                size="xs"
                icon={Play}
                onClick={() => void runNow(item)}
                disabled={runningId === item.id}
                loading={runningId === item.id}
                loadingLabel="Running…"
                aria-label={`Run ${item.repo} audit now`}
                className="font-mono"
              >
                Run now
              </Button>
              <IconButton icon={Trash2} label={`Delete schedule for ${item.repo}`} size="sm" onClick={() => void remove(item.id)} />
            </div>
          ))}
          {items.length === 0 && (
            <p className="rounded-small bg-surface-container-low p-4 text-center text-body-sm text-on-surface-variant">No scheduled audits yet — add a repo above.</p>
          )}
        </div>
      </div>
    </Card>
  );

  if (!pro) {
    return <LockedCard title="Scheduled Audits" description="Put repos on a daily or weekly audit cadence, run them on demand, and watch scores move over time." badge="PRO" onUpgrade={onUpgrade} />;
  }
  return content;
}

// ── API Keys (TEAM) ──────────────────────────────────────────────────────────

function ApiKeysSection({ team, onUpgrade }: { team: boolean; onUpgrade: () => void }) {
  const [items, setItems] = useState<ApiKeyItem[]>([]);
  const [label, setLabel] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/apikeys", { cache: "no-store" });
      if (!res.ok) return;
      setItems((await res.json()) as ApiKeyItem[]);
    } catch {
      toast({ title: "Could not load API keys", tone: "danger" });
    }
  }, []);

  useEffect(() => {
    if (team) void refresh();
  }, [team, refresh]);

  const generate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = (await res.json()) as ApiKeyItem & { ok: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setNewKey(body.key);
      setLabel("");
      await refresh();
      toast({ title: "API key generated", description: "Copy it now — it is shown in full once.", tone: "success" });
    } catch (err) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/apikeys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Key revoked", tone: "success" });
    } catch {
      toast({ title: "Revoke failed", tone: "danger" });
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: `${what} is on your clipboard.`, tone: "success" });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard unavailable in this context.", tone: "danger" });
    }
  };

  const maskKey = (k: string) => `${k.slice(0, 9)}…${k.slice(-4)}`;
  const exampleCurl = `curl -X POST ${origin || "https://your-shipos"}/api/v1/audit -H "x-api-key: skos_..." -H "Content-Type: application/json" -d '{"repoUrl":"https://github.com/owner/repo"}'`;

  const content = (
    <Card padding="none" className="p-4 sm:p-5">
      <SectionTitle icon={KeyRound} label="// API ACCESS" />
      <div className="mt-3 flex flex-col gap-3">
        {newKey && (
          <Alert tone="success" action={
            <Button variant="tonal" size="xs" onClick={() => void copy(newKey, "API key")} icon={Copy} className="font-mono">
              Copy
            </Button>
          }>
            <span className="break-all font-mono">{newKey}</span>
          </Alert>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextField
            label="Key label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            hint="e.g. ci-bot"
            className="flex-1 font-mono"
          />
          <div className="flex items-end">
            <Button icon={Plus} onClick={() => void generate()} disabled={busy} loading={busy} loadingLabel="Generating…">
              Generate key
            </Button>
          </div>
        </div>

        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
          {items.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-small bg-surface-container-low p-3">
              <Icon icon={KeyRound} size="sm" className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-body-sm text-on-surface">{maskKey(k.key)}</p>
                <p className="font-mono text-label-sm text-on-surface-variant">
                  {k.label} · {k.usageCount} call{k.usageCount === 1 ? "" : "s"} · {format(new Date(k.createdAt), "MMM d")}
                </p>
              </div>
              <IconButton icon={Copy} label={`Copy key ${k.label}`} size="sm" onClick={() => void copy(k.key, "API key")} />
              <IconButton icon={Trash2} label={`Revoke key ${k.label}`} size="sm" onClick={() => void remove(k.id)} />
            </div>
          ))}
          {items.length === 0 && (
            <p className="rounded-small bg-surface-container-low p-4 text-center text-body-sm text-on-surface-variant">No keys yet — generate one to call the audit API.</p>
          )}
        </div>

        <CodeBlock
          title="example — start an audit over HTTP"
          action={
            <Button variant="outlined" size="xs" aria-label="Copy curl example" onClick={() => void copy(exampleCurl, "curl example")} icon={Copy} className="font-mono">
              Copy
            </Button>
          }
          wrap
        >
          {exampleCurl}
        </CodeBlock>
      </div>
    </Card>
  );

  if (!team) {
    return <LockedCard title="API Access" description="Generate skos_ keys and trigger audits over HTTP — perfect for CI pipelines." badge="PRO TEAM" onUpgrade={onUpgrade} />;
  }
  return content;
}

// ── Team (TEAM only) ─────────────────────────────────────────────────────────

function TeamSection({ team, onUpgrade }: { team: boolean; onUpgrade: () => void }) {
  const [items, setItems] = useState<TeamMemberItem[]>([]);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<string>("MEMBER");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/team", { cache: "no-store" });
      if (!res.ok) return;
      setItems((await res.json()) as TeamMemberItem[]);
    } catch {
      toast({ title: "Could not load team", tone: "danger" });
    }
  }, []);

  useEffect(() => {
    if (team) void refresh();
  }, [team, refresh]);

  const invite = async () => {
    if (!handle.trim()) {
      toast({ title: "Handle required", description: "GitHub handle or email." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, handle, role }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setName("");
      setHandle("");
      await refresh();
      toast({ title: "Invite sent", description: "They appear as invited until they accept.", tone: "success" });
    } catch (err) {
      toast({ title: "Invite failed", description: err instanceof Error ? err.message : "Try again.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, data: { role?: string; status?: string }) => {
    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch {
      toast({ title: "Update failed", tone: "danger" });
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/team?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Member removed", tone: "success" });
    } catch {
      toast({ title: "Remove failed", tone: "danger" });
    }
  };

  const content = (
    <Card padding="none" className="p-4 sm:p-5">
      <SectionTitle icon={Users} label="// TEAM WORKSPACE" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} hint="Ada Lovelace" />
          <TextField label="Handle / email" value={handle} onChange={(e) => setHandle(e.target.value)} hint="@ada" className="font-mono" />
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="w-32">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.toLowerCase()}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <Button onClick={() => void invite()} disabled={busy} loading={busy} loadingLabel="Inviting…" icon={Plus}>
              Invite
            </Button>
          </div>
        </div>

        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
          {items.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-small bg-surface-container-low p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container font-mono text-label-md font-bold text-on-primary-container">
                {m.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-semibold text-on-surface">{m.name}</p>
                <p className="truncate font-mono text-label-sm text-on-surface-variant">@{m.handle}</p>
              </div>
              <Badge tone={m.status === "active" ? "primary" : "tertiary"} className="font-mono text-label-sm">
                {m.status}
              </Badge>
              {m.status === "invited" && (
                <Button variant="outlined" size="xs" icon={Check} onClick={() => void patch(m.id, { status: "active" })} className="font-mono text-primary">
                  Accept invite
                </Button>
              )}
              <Select label={`Role for ${m.name}`} value={m.role} onChange={(e) => void patch(m.id, { role: e.target.value })} className="w-32">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.toLowerCase()}
                  </option>
                ))}
              </Select>
              <IconButton icon={Trash2} label={`Remove ${m.name}`} size="sm" onClick={() => void remove(m.id)} />
            </div>
          ))}
          {items.length === 0 && (
            <p className="rounded-small bg-surface-container-low p-4 text-center text-body-sm text-on-surface-variant">No members yet — invite your first teammate.</p>
          )}
        </div>
      </div>
    </Card>
  );

  if (!team) {
    return <LockedCard title="Team Workspaces" description="Invite your team, assign roles, accept invites and remove members — fixes and audits stay shared." badge="PRO TEAM" onUpgrade={onUpgrade} />;
  }
  return content;
}

// ── ROI Calculator (everyone) ────────────────────────────────────────────────

function RoiCalculator() {
  const [repos, setRepos] = useState(8);
  const [minutes, setMinutes] = useState(90);
  const [rate, setRate] = useState(50);

  const hours = (repos * minutes) / 60;
  const money = hours * rate;
  const beatsPro = money > 9;

  return (
    <Card padding="none" className="p-4 sm:p-5">
      <SectionTitle icon={Calculator} label="// ROI CALCULATOR — DOES PRO PAY FOR ITSELF?" />
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex flex-col gap-4">
          {(
            [
              { label: "repos audited / month", value: repos, set: setRepos, min: 1, max: 40, step: 1, fmt: (v: number) => `${v}` },
              { label: "minutes saved / audit", value: minutes, set: setMinutes, min: 15, max: 240, step: 5, fmt: (v: number) => `${v} min` },
              { label: "your hourly rate", value: rate, set: setRate, min: 10, max: 200, step: 5, fmt: (v: number) => `$${v}` },
            ] as const
          ).map((s) => (
            <Slider
              key={s.label}
              label={s.label}
              valueLabel={s.fmt(s.value)}
              value={s.value}
              min={s.min}
              max={s.max}
              step={s.step}
              onInput={(e) => s.set(Number(e.currentTarget.value))}
            />
          ))}
        </div>
        <div
          className={cn(
            "flex flex-col justify-center gap-2 rounded-medium p-4 text-center",
            beatsPro ? "bg-primary-container text-on-primary-container" : "bg-surface-container-low text-on-surface"
          )}
        >
          <p className="font-mono text-label-sm uppercase tracking-widest opacity-80">monthly savings</p>
          <p className="font-mono text-display-sm font-bold tnum">
            ${money.toFixed(0)}
          </p>
          <p className="font-mono text-label-sm opacity-80">
            {hours.toFixed(1)} h saved · vs PRO at $9/mo
          </p>
          {beatsPro && (
            <Badge tone="primary" className="mx-auto font-mono text-label-sm">
              PRO pays for itself {(money / 9).toFixed(1)}×
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

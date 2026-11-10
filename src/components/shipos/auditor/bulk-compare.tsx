"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Crown, Layers, Trophy, X } from "@/ui/symbols";
import { Badge, Button, Card, Icon, IconButton, SegmentedButton, Spinner, TextField, Textarea, toast, cn, type BadgeTone } from "@/ui";
import type { AuditJobResponse } from "@/lib/shipos/audit-types";
import { gradeFor } from "@/lib/shipos/audit-types";
import { ProLockOverlay } from "@/components/shipos/auditor/pro-badge";

// ─────────────────────────────────────────────────────────────────────────────
// BulkCompare — two PRO tools: Bulk Audit (up to 5 repos, ranked) and
// Compare Repos (2-3 repos, side-by-side categories + winner summary).
// Also exports the shared pollAudit() helper used by the main auditor.
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

const REPO_PATTERN = /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

/** Poll GET /api/audit/[id] every 2s until the job leaves "processing". */
export async function pollAudit(id: string): Promise<AuditJobResponse> {
  for (let attempt = 0; attempt < 150; attempt++) {
    const res = await fetch(`/api/audit/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as AuditJobResponse;
    if (data.status !== "processing") return data;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Audit timed out after 5 minutes");
}

async function startAudit(repoUrl: string): Promise<string> {
  const res = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl }),
  });
  const body = (await res.json()) as { ok: boolean; id?: string; error?: string };
  if (!res.ok || !body.ok || !body.id) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.id;
}

function gradeTone(grade: string): BadgeTone {
  if (grade === "S") return "premium";
  if (grade === "A") return "primary";
  if (grade === "B") return "tertiary";
  if (grade === "C") return "neutral";
  return "error";
}

export function BulkCompare({
  initialMode,
  isProUser,
  onUpgrade,
  onOpenAudit,
}: {
  initialMode: "bulk" | "compare";
  isProUser: boolean;
  onUpgrade: () => void;
  onOpenAudit?: (id: string) => void;
}) {
  const [mode, setMode] = useState<"bulk" | "compare">(initialMode);

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <SegmentedButton
          label="Tool mode"
          value={mode}
          onChange={(v) => setMode(v as "bulk" | "compare")}
          options={[
            { value: "bulk", label: "Bulk Audit", icon: Layers },
            { value: "compare", label: "Compare Repos", icon: ArrowLeftRight },
          ]}
        />
        <Badge tone="premium" icon={Crown} className="font-mono">
          PRO tool
        </Badge>
      </div>
      <div className="p-4">
        {mode === "bulk" ? <BulkTool isProUser={isProUser} onUpgrade={onUpgrade} onOpenAudit={onOpenAudit} /> : <CompareTool isProUser={isProUser} onUpgrade={onUpgrade} />}
      </div>
    </Card>
  );
}

// ── Bulk audit ───────────────────────────────────────────────────────────────

function BulkTool({
  isProUser,
  onUpgrade,
  onOpenAudit,
}: {
  isProUser: boolean;
  onUpgrade: () => void;
  onOpenAudit?: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<AuditJobResponse[]>([]);

  const urls = useMemo(
    () =>
      text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 5),
    [text]
  );

  const run = useCallback(async () => {
    if (urls.length === 0) {
      toast({ title: "Nothing to audit", description: "Paste at least one repo URL, one per line." });
      return;
    }
    const invalid = urls.filter((u) => !REPO_PATTERN.test(u));
    if (invalid.length) {
      toast({ title: "Invalid URL", description: `Check format: ${invalid[0]}`, tone: "danger" });
      return;
    }
    setRunning(true);
    setResults([]);
    const settled = await Promise.allSettled(
      urls.map(async (u) => {
        const id = await startAudit(u);
        return pollAudit(id);
      })
    );
    const ok: AuditJobResponse[] = [];
    const bad: string[] = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.status === "ready") ok.push(r.value);
      else bad.push(urls[i]);
    });
    ok.sort((a, b) => b.score - a.score);
    setResults(ok);
    setRunning(false);
    if (ok.length) {
      toast({
        title: `Bulk audit complete — ${ok.length} repo${ok.length === 1 ? "" : "s"}`,
        description: `Winner: ${ok[0].owner}/${ok[0].repo} at ${ok[0].score}/100.`,
        tone: "success",
      });
    }
    if (bad.length) {
      toast({ title: `${bad.length} audit${bad.length === 1 ? "" : "s"} failed`, description: bad.join(", "), tone: "danger" });
    }
  }, [urls]);

  const content = (
    <div className="flex flex-col gap-4">
      <Textarea
        label="Repo URLs — one per line (max 5)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        hint="https://github.com/owner/repo\nhttps://github.com/other/repo"
        className="font-mono"
        spellCheck={false}
      />
      <Button icon={Layers} onClick={() => void run()} disabled={running} loading={running} loadingLabel="Auditing…">
        {running
          ? `Auditing ${urls.length} repo${urls.length === 1 ? "" : "s"}…`
          : `Audit ${urls.length || ""} ${urls.length === 1 ? "repo" : "repos"}`.trim()}
      </Button>

      {running && (
        <div className="flex items-center gap-2 font-mono text-label-md text-on-surface-variant">
          <Spinner size="sm" label="Polling each repo" />
          polling each repo — 50 checks each, this takes ~30-60s
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded-small bg-surface-container-low">
          <table className="w-full min-w-[560px] border-collapse text-body-sm">
            <thead>
              <tr className="bg-surface-container-high font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
                <th className="px-3 py-2 text-left font-medium">Rank</th>
                <th className="px-3 py-2 text-left font-medium">Repo</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-center font-medium">Grade</th>
                <th className="px-3 py-2 text-right font-medium">Fixes</th>
                <th className="px-3 py-2 text-right font-medium">To 100</th>
                <th className="px-3 py-2" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const grade = gradeFor(r.score);
                return (
                  <tr key={r.id} className={cn("border-t border-outline-variant", i === 0 && "bg-primary/[0.06]")}>
                    <td className="px-3 py-2.5 font-mono text-on-surface-variant">
                      {i === 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-premium">
                          <Icon icon={Crown} size="sm" aria-label="winner" /> 1
                        </span>
                      ) : (
                        i + 1
                      )}
                    </td>
                    <td className="max-w-48 truncate px-3 py-2.5 font-mono text-on-surface">
                      {r.owner}/{r.repo}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-positive tnum">{r.score}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge tone={gradeTone(grade)} className="font-mono text-label-sm">
                        {grade}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-on-surface-variant tnum">{r.fixesCount}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-on-surface-variant tnum">+{100 - r.score}</td>
                    <td className="px-3 py-2.5 text-right">
                      {onOpenAudit && (
                        <Button variant="text" size="xs" onClick={() => onOpenAudit(r.id)} className="font-mono text-primary">
                          open
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (!isProUser) {
    return (
      <ProLockOverlay
        title="Bulk Audit is a PRO tool"
        description="Line up to 5 repos, audit them in one shot, and get a ranked table with the crown on the winner."
        features={["5 repos per run", "ranked table", "winner summary"]}
        onUpgrade={onUpgrade}
        className="min-h-72"
      >
        {content}
      </ProLockOverlay>
    );
  }
  return content;
}

// ── Compare repos ────────────────────────────────────────────────────────────

function CompareTool({ isProUser, onUpgrade }: { isProUser: boolean; onUpgrade: () => void }) {
  const [urls, setUrls] = useState<string[]>(["", "", ""]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<AuditJobResponse[]>([]);

  const setUrl = (i: number, v: string) => setUrls((prev) => prev.map((u, idx) => (idx === i ? v : u)));
  const active = useMemo(() => urls.map((u) => u.trim()).filter(Boolean), [urls]);

  const run = useCallback(async () => {
    if (active.length < 2) {
      toast({ title: "Need 2-3 repos", description: "Fill at least two repo URLs to compare." });
      return;
    }
    const invalid = active.filter((u) => !REPO_PATTERN.test(u));
    if (invalid.length) {
      toast({ title: "Invalid URL", description: `Check format: ${invalid[0]}`, tone: "danger" });
      return;
    }
    setRunning(true);
    setResults([]);
    const settled = await Promise.allSettled(
      active.map(async (u) => {
        const id = await startAudit(u);
        return pollAudit(id);
      })
    );
    const ok = settled
      .filter((r): r is PromiseFulfilledResult<AuditJobResponse> => r.status === "fulfilled" && r.value.status === "ready")
      .map((r) => r.value);
    ok.sort((a, b) => b.score - a.score);
    setResults(ok);
    setRunning(false);
    if (ok.length >= 2) {
      toast({ title: `${ok[0].repo} leads by ${ok[0].score - ok[1].score} pts`, description: "Category breakdown below.", tone: "success" });
    } else if (ok.length === 1) {
      toast({ title: "Only one repo finished", description: "One of the audits failed — try again.", tone: "danger" });
    }
  }, [active]);

  const winner = results[0];
  const runnerUp = results[1];
  const strongerCats = useMemo(() => {
    if (!winner?.audit || !runnerUp?.audit) return [];
    return winner.audit.categories
      .map((c) => {
        const other = runnerUp.audit?.categories.find((o) => o.id === c.id);
        return { name: c.name, delta: c.score / c.max - (other ? other.score / other.max : 0) };
      })
      .filter((c) => c.delta >= 0.15)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 2)
      .map((c) => c.name);
  }, [winner, runnerUp]);

  const content = (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {urls.map((u, i) => (
          <TextField
            key={i}
            label={`Repo URL ${i + 1}`}
            value={u}
            onChange={(e) => setUrl(i, e.target.value)}
            hint={`https://github.com/owner/repo-${i + 1}`}
            className="font-mono"
            spellCheck={false}
            trailing={
              u ? (
                <IconButton icon={X} label={`Clear repo URL ${i + 1}`} size="sm" onClick={() => setUrl(i, "")} />
              ) : undefined
            }
          />
        ))}
      </div>
      <Button icon={ArrowLeftRight} onClick={() => void run()} disabled={running} loading={running} loadingLabel="Auditing all repos…">
        {running ? "Auditing all repos…" : "Compare repos"}
      </Button>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
            {winner && runnerUp && (
              <div className="flex items-center gap-2 rounded-small bg-premium/10 p-3">
                <Icon icon={Trophy} size="sm" className="shrink-0 text-premium" />
                <p className="text-body-sm text-on-surface">
                  <span className="font-mono font-bold">{winner.repo}</span> wins by {winner.score - runnerUp.score} pts
                  {strongerCats.length ? ` — stronger ${strongerCats.join(" & ")}` : ""}
                </p>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {results.map((r, i) => (
                <Card key={r.id} className={cn("flex flex-col gap-3", i === 0 && "bg-premium/10")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-body-sm font-bold text-on-surface">
                      {i === 0 && <Icon icon={Crown} size="sm" className="mr-1 inline text-premium" aria-label="winner" />}
                      {r.owner}/{r.repo}
                    </p>
                    <span className="font-mono text-title-lg font-bold text-positive tnum">{r.score}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {r.audit?.categories.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 font-mono text-label-sm">
                        <span className="w-24 shrink-0 truncate text-on-surface-variant">{c.name}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
                          <div
                            className={cn("h-full rounded-full", c.score / c.max >= 0.7 ? "bg-primary" : c.score / c.max >= 0.4 ? "bg-premium" : "bg-error")}
                            style={{ width: `${(c.score / c.max) * 100}%` }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-on-surface-variant tnum">
                          {c.score}/{c.max}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="font-mono text-label-sm text-on-surface-variant">
                    {r.fixesCount} fixes · +{100 - r.score} pts to 100
                  </p>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (!isProUser) {
    return (
      <ProLockOverlay
        title="Compare Repos is a PRO tool"
        description="Put 2-3 repos head-to-head across all five categories and get a winner summary."
        features={["side-by-side categories", "winner summary", "per-category deltas"]}
        onUpgrade={onUpgrade}
        className="min-h-72"
      >
        {content}
      </ProLockOverlay>
    );
  }
  return content;
}

"use client";

// ─────────────────────────────────────────────────────────────────────────────
// StoryReportTab — the executive Project Report:
// Executive Summary · Problem · Solution · Stack · Score Breakdown · Risk ·
// Roadmap to 100 · Next Steps. Rendered + copy/download as markdown.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { BadgeCheck, Compass, Copy, Download, FileText, ShieldAlert, Sparkles, XCircle } from "@/ui/symbols";
import { Badge, Button, Card, Icon, cn, type BadgeTone } from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { AuditJobResponse, RiskSeverity } from "@/lib/shipos/audit-types";
import { RISK_SEVERITY_ORDER } from "@/lib/shipos/audit-types";
import { buildRealPicture, buildStoryReportMarkdown } from "@/lib/shipos/story-engine";
import { copyText, downloadText } from "./story-utils";

const SECTIONS = [
  { id: "exec", label: "Executive Summary" },
  { id: "problem", label: "Problem" },
  { id: "solution", label: "Solution" },
  { id: "serves", label: "Who It Serves" },
  { id: "stack", label: "Stack" },
  { id: "score", label: "Score Breakdown" },
  { id: "risk", label: "Risk" },
  { id: "roadmap", label: "Roadmap to 100" },
  { id: "next", label: "Next Steps" },
] as const;

const RISK_TONE: Record<RiskSeverity, BadgeTone> = {
  critical: "error",
  high: "premium",
  medium: "tertiary",
  low: "neutral",
};

export function StoryReportTab({ job }: { job: AuditJobResponse }) {
  const audit = job.audit;
  const pic = useMemo(() => buildRealPicture(job), [job]);
  const markdown = useMemo(() => buildStoryReportMarkdown(job), [job]);

  const risks = useMemo(
    () => (audit ? [...audit.risks].sort((a, b) => RISK_SEVERITY_ORDER[a.severity] - RISK_SEVERITY_ORDER[b.severity]) : []),
    [audit]
  );

  if (!audit) return null;

  return (
    <div className="flex flex-col gap-4">
      <Card padding="none" className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        <span className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <Icon icon={FileText} size="sm" className="text-positive" />
          project-report.md
        </span>
        <span className="font-mono text-label-sm text-on-surface-variant/70">9 sections · ready for investors, maintainers and README sidebars</span>
        <div className="ml-auto flex gap-2">
          <Button size="xs" variant="outlined" icon={Copy} onClick={() => void copyText(markdown, "Project report")} className="font-mono">
            Copy
          </Button>
          <Button size="xs" variant="outlined" icon={Download} onClick={() => downloadText(`${job.repo}-project-report.md`, markdown)} className="font-mono">
            Download .md
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#sr-${s.id}`}
            className={cn(
              "rounded-small px-2.5 py-1 font-mono text-label-sm text-on-surface-variant transition-colors hover:text-on-surface",
              "shadow-[inset_0_0_0_1px_rgb(var(--md-sys-color-outline-variant-rgb))]",
              interactive(),
            )}
          >
            {s.label}
          </a>
        ))}
      </div>

      {/* Executive Summary */}
      <div id="sr-exec" className="scroll-mt-4">
        <Card padding="none" className="flex flex-col gap-3 bg-primary-container/25 p-4 sm:p-6">
          <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            <Icon icon={Sparkles} size="sm" className="text-primary" />
            {"// EXECUTIVE SUMMARY"}
          </p>
          <p className="text-body-md leading-relaxed text-on-surface">
            <span className="font-mono font-bold text-positive">{job.owner}/{job.repo}</span> is a {stackLine(job)} project scoring{" "}
            <span className="font-mono font-bold">{audit.score}/100</span> (Grade {audit.grade}, {audit.tier}, {audit.percentile}). The deterministic
            audit ran {audit.stats.checksTotal} checks across 5 weighted categories — <span className="font-semibold">Documentation 25 · Code Quality 25 · Security 20 · DevOps 15 · Community 15</span> —
            finding <span className="text-positive">{audit.stats.checksPassed} passing</span>, {audit.stats.checksFailed} failing.{" "}
            <span className="font-semibold text-error">{audit.stats.pointsAtStake} points are recoverable</span> through {audit.fixes.length} ranked
            fixes, projecting exactly <span className="font-mono font-bold text-positive">100/100</span> in ~{minutes(job)} minutes of copy-paste
            work.
          </p>
          <div className="flex flex-wrap gap-2 font-mono">
            <Badge variant="outlined" numeric className="text-positive">
              {audit.score} → 100
            </Badge>
            <Badge variant="outlined" numeric>{audit.fixes.length} fixes</Badge>
            <Badge variant="outlined" numeric>{audit.stats.fixFiles.length} files</Badge>
            <Badge variant="outlined" numeric>~{minutes(job)} min</Badge>
          </div>
        </Card>
      </div>

      {/* Problem + Solution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div id="sr-problem" className="scroll-mt-4">
          <Card padding="none" className="flex flex-col gap-2 p-4 sm:p-5">
            <p className="font-mono text-label-md uppercase tracking-widest text-error">{"// PROBLEM"}</p>
            <p className="text-body-md leading-relaxed text-on-surface-variant">{pic.problem}</p>
          </Card>
        </div>
        <div id="sr-solution" className="scroll-mt-4">
          <Card padding="none" className="flex flex-col gap-2 p-4 sm:p-5">
            <p className="font-mono text-label-md uppercase tracking-widest text-positive">{"// SOLUTION"}</p>
            <ul className="flex flex-col gap-1.5">
              {pic.provides.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-body-md text-on-surface-variant">
                  <Icon icon={BadgeCheck} size="sm" className="mt-0.5 shrink-0 text-positive" />
                  {p}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Who it serves */}
      <div id="sr-serves" className="scroll-mt-4">
        <Card padding="none" className="flex flex-col gap-3 p-4 sm:p-5">
          <p className="font-mono text-label-md uppercase tracking-widest text-tertiary">{"// WHO IT SERVES"}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {pic.serves.map((s, i) => (
              <div key={i} className="rounded-small bg-surface-container-low p-3">
                <p className="text-title-sm text-on-surface">{s.who}</p>
                <p className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">{s.why}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Stack */}
      <div id="sr-stack" className="scroll-mt-4">
        <Card padding="none" className="flex flex-col gap-3 p-4 sm:p-5">
          <p className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">{"// STACK"}</p>
          {job.repoMeta ? (
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {(
                [
                  ["Language", job.repoMeta.languages.map((l) => `${l.name} ${l.pct}%`).join(", ") || job.repoMeta.language || "—"],
                  ["Package manager", job.repoMeta.packageManager ?? "—"],
                  ["CI", job.repoMeta.ciWorkflows.length ? job.repoMeta.ciWorkflows.join(", ") : "none detected"],
                  ["Tests", job.repoMeta.hasTests ? "detected" : "not detected"],
                  ["License", job.repoMeta.license ?? "none"],
                  ["Community", `${job.repoMeta.stars.toLocaleString()} ★ · ${job.repoMeta.forks.toLocaleString()} forks`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 rounded-extra-small bg-surface-container-low px-3 py-1.5">
                  <span className="font-mono text-label-sm text-on-surface-variant">{k}</span>
                  <span className="text-right font-mono text-label-md text-on-surface">{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-body-md text-on-surface-variant">Offline audit — stack inferred from the pasted file list only.</p>
          )}
        </Card>
      </div>

      {/* Score breakdown */}
      <div id="sr-score" className="scroll-mt-4">
        <Card padding="none" className="flex flex-col gap-3 p-4 sm:p-5">
          <p className="font-mono text-label-md uppercase tracking-widest text-on-surface-variant">{"// SCORE BREAKDOWN"}</p>
          <div className="flex flex-col gap-2.5">
            {audit.categories.map((c) => {
              const pct = Math.round((c.score / c.max) * 100);
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 truncate font-mono text-label-sm text-on-surface-variant">{c.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
                    <div
                      className={cn("h-full rounded-full", pct >= 70 ? "bg-positive" : pct >= 40 ? "bg-premium" : "bg-error")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={cn("w-14 shrink-0 text-right font-mono text-label-sm font-bold tnum", pct >= 70 ? "text-positive" : pct >= 40 ? "text-premium" : "text-error")}>
                    {c.score}/{c.max}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Risk + Roadmap */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div id="sr-risk" className="scroll-mt-4">
          <Card padding="none" className="flex flex-col gap-3 p-4 sm:p-5">
            <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-premium">
              <Icon icon={ShieldAlert} size="sm" />
              {"// RISK"}
            </p>
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {risks.length === 0 && <p className="text-body-md text-positive">No risks flagged at {audit.strictness} strictness.</p>}
              {risks.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-small bg-surface-container-low p-2.5">
                  <Badge tone={RISK_TONE[r.severity]} className="shrink-0 font-mono text-label-sm uppercase">
                    {r.severity}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-label-md font-semibold text-on-surface">{r.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-label-sm text-on-surface-variant">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div id="sr-roadmap" className="scroll-mt-4">
          <Card padding="none" className="flex flex-col gap-3 p-4 sm:p-5">
            <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-positive">
              <Icon icon={Compass} size="sm" />
              {"// ROADMAP TO 100"}
            </p>
            <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
              {audit.roadmap.slice(0, 10).map((r) => (
                <div key={r.rank} className="flex items-center gap-2.5 rounded-small bg-surface-container-low px-3 py-2">
                  <span className="font-mono text-label-sm text-on-surface-variant">#{r.rank}</span>
                  <span className="min-w-0 flex-1 truncate text-label-md font-medium text-on-surface">
                    {r.title}
                    {r.quickWin && <span className="ml-1.5 font-mono text-label-sm text-positive">⚡quick win</span>}
                  </span>
                  <span className="shrink-0 font-mono text-label-sm text-positive tnum">+{r.points}</span>
                  <span className="shrink-0 font-mono text-label-sm text-on-surface-variant">{r.effort}</span>
                  <span className="w-14 shrink-0 text-right font-mono text-label-sm text-on-surface-variant tnum">{r.cumulative}/100</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Next steps */}
      <div id="sr-next" className="scroll-mt-4">
        <Card padding="none" className="flex flex-col gap-3 bg-primary-container/25 p-4 sm:p-6">
          <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-primary">
            <Icon icon={XCircle} size="sm" />
            {"// NEXT STEPS"}
          </p>
          <ol className="flex flex-col gap-2 text-body-md text-on-surface-variant">
            <li className="flex gap-2.5">
              <span className="font-mono font-bold text-primary">1.</span>
              <span>
                Apply fix #1 — <span className="font-semibold text-on-surface">{audit.fixes[0]?.title ?? "open the Auto Fix tab"}</span> (+{audit.fixes[0]?.points ?? 0} pts, {audit.fixes[0]?.effort ?? "5 min"}). Full code is in the Auto Fix tab.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-mono font-bold text-primary">2.</span>
              <span>
                Clear the quick wins — {audit.roadmap.filter((r) => r.quickWin).length} fixes take ≤5 min each and move the score fastest per minute
                spent.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-mono font-bold text-primary">3.</span>
              <span>Re-audit and publish the badge — the README badge and this Story Engine output turn the new score into proof.</span>
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

function stackLine(job: AuditJobResponse): string {
  const meta = job.repoMeta;
  const parts: string[] = [];
  if (meta?.language) parts.push(meta.language);
  if (meta?.packageManager) parts.push(meta.packageManager);
  parts.push(meta?.hasTests ? "tests ✓" : "tests missing");
  return parts.join(" · ");
}

function minutes(job: AuditJobResponse): number {
  const a = job.audit;
  if (!a) return 0;
  return a.fixes.reduce((sum, f) => {
    const m = f.effort.match(/(\d+)\s*min/i);
    return sum + (m ? Number(m[1]) : 10);
  }, 0);
}

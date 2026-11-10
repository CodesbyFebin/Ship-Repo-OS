"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Crown,
  ExternalLink,
  Gauge,
  ListChecks,
  Lock,
  SortDesc,
  Zap,
} from "@/ui/symbols";
import { Badge, Button, Card, Checkbox, Chip, CodeBlock, EmptyState, Icon, IconButton, Progress, toast, cn, type BadgeTone } from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { CodeFix, RepoAudit } from "@/lib/shipos/audit-types";
import { effortMinutes } from "@/lib/shipos/audit-types";
import { FREE_FREE_FIXES, useProStore } from "@/lib/shipos/pro-store";

// ─────────────────────────────────────────────────────────────────────────────
// RoadmapTab — ranked fixes, quick-wins filter, projected score calculator.
// FREE tier sees the first 5 fixes; the rest stay blurred behind an upgrade.
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_TONE: Record<string, BadgeTone> = {
  critical: "error",
  high: "tertiary",
  medium: "neutral",
  low: "neutral",
};

/** Projected score → the role colour it reads as. */
function recoveredClass(score: number): string {
  if (score >= 100) return "text-premium";
  if (score >= 85) return "text-positive";
  if (score >= 70) return "text-primary";
  return "text-error";
}

export function RoadmapTab({
  audit,
  auditId,
  isProUser,
  onUpgrade,
}: {
  audit: RepoAudit;
  auditId: string;
  isProUser: boolean;
  onUpgrade: () => void;
}) {
  const markFixApplied = useProStore((s) => s.markFixApplied);
  const markAllApplied = useProStore((s) => s.markAllApplied);
  const storedApplied = useProStore((s) => s.fixesApplied[auditId]);
  const [quickWinsOnly, setQuickWinsOnly] = useState(false);

  const applied = useMemo(() => new Set(storedApplied ?? []), [storedApplied]);

  const fixes = useMemo(
    () => (quickWinsOnly ? audit.fixes.filter((f) => effortMinutes(f.effort) <= 5) : audit.fixes),
    [audit.fixes, quickWinsOnly]
  );

  const appliedCount = audit.fixes.filter((f) => applied.has(f.id)).length;
  const recovered = Math.min(
    100,
    audit.score + audit.fixes.filter((f) => applied.has(f.id)).reduce((sum, f) => sum + f.points, 0)
  );

  const toggleApplied = (fixId: string) => {
    if (applied.has(fixId)) {
      markAllApplied(
        auditId,
        audit.fixes.filter((f) => f.id !== fixId && applied.has(f.id)).map((f) => f.id)
      );
    } else {
      markFixApplied(auditId, fixId);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Projected score calculator */}
      <Card padding="none" className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
              <Icon icon={Gauge} size="sm" className="text-primary" />
              {"// PROJECTED SCORE"}
            </p>
            <p className="font-mono text-label-sm text-on-surface-variant">
              tick a fix once you applied it — the projection updates live
            </p>
          </div>
          <motion.p
            key={recovered}
            initial={{ scale: 0.9, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="font-mono text-title-lg tnum sm:text-display-sm"
          >
            <span className="text-on-surface-variant">After {appliedCount} fix{appliedCount === 1 ? "" : "es"}: </span>
            <span className={recoveredClass(recovered)}>{recovered}/100</span>
          </motion.p>
        </div>
        <Progress value={recovered} label={`Projected score ${recovered} of 100`} className="mt-3" />
        {/* sparkline-ish strip: one bar per fix, height = points */}
        <div className="mt-2 flex h-8 items-end gap-1" aria-hidden>
          {audit.fixes.map((f) => {
            const isApplied = applied.has(f.id);
            const h = Math.max(3, Math.min(28, f.points * 5));
            return (
              <motion.span
                key={f.id}
                layout
                title={`${f.title} +${f.points} pts`}
                className={cn("w-full rounded-extra-small", isApplied ? "bg-primary" : "bg-surface-container-highest")}
                style={{ height: h }}
                animate={isApplied ? { scaleY: [1.15, 1] } : {}}
              />
            );
          })}
        </div>
        <p className="mt-2 font-mono text-label-sm text-on-surface-variant">
          {appliedCount}/{audit.fixes.length} fixes applied · {Math.max(0, 100 - recovered)} pts to go
        </p>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
          <Icon icon={SortDesc} size="sm" className="text-primary" />
          {"// RANKED FIXES"}
        </p>
        <Chip
          kind="filter"
          selected={quickWinsOnly}
          icon={Zap}
          onClick={() => setQuickWinsOnly((v) => !v)}
          className="font-mono"
        >
          Quick wins only (≤ 5 min)
        </Chip>
      </div>

      {/* Fix cards */}
      <div className="flex flex-col gap-3">
        {fixes.map((fix, i) => (
          <RoadmapFixCard
            key={fix.id}
            fix={fix}
            displayIndex={audit.fixes.indexOf(fix) + 1}
            gated={!isProUser && audit.fixes.indexOf(fix) >= FREE_FREE_FIXES}
            applied={applied.has(fix.id)}
            onToggle={() => toggleApplied(fix.id)}
            onUpgrade={onUpgrade}
            index={i}
          />
        ))}
        {fixes.length === 0 && (
          <EmptyState
            icon={ListChecks}
            title="No quick wins at this filter"
            description="Expand to see the full ranked roadmap."
          />
        )}
      </div>
    </div>
  );
}

function RoadmapFixCard({
  fix,
  displayIndex,
  gated,
  applied,
  onToggle,
  onUpgrade,
  index,
}: {
  fix: CodeFix;
  displayIndex: number;
  gated: boolean;
  applied: boolean;
  onToggle: () => void;
  onUpgrade: () => void;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.35 }}>
      <Card padding="none" className={cn(applied && "bg-primary-container/40", open && "bg-primary-container/25")}>
        {/* Header — always visible, even when gated */}
        <div className="flex items-start gap-3 p-4">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-small font-mono text-title-sm font-bold tnum",
              applied ? "bg-primary text-on-primary" : "bg-primary-container text-on-primary-container"
            )}
          >
            {displayIndex}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-title-sm text-on-surface">{fix.title}</span>
              <Badge tone={PRIORITY_TONE[fix.priority]} className="shrink-0 font-mono text-label-sm uppercase">
                {fix.priority}
              </Badge>
              <Badge tone="primary" className="shrink-0 font-mono text-label-sm">
                +{fix.points} pts
              </Badge>
              <span className="font-mono text-label-sm text-on-surface-variant">{fix.effort}</span>
            </div>
            <p
              className={cn("mt-1 line-clamp-2 text-body-sm leading-relaxed text-on-surface-variant", gated && "blur-[2px] select-none")}
              aria-hidden={gated || undefined}
            >
              {fix.why}
            </p>
          </div>
          {/* Mark applied checkbox */}
          <div
            className={cn(
              "flex shrink-0 flex-col items-center gap-1 rounded-small bg-surface-container-low p-2",
              gated && "pointer-events-none opacity-40"
            )}
            title={gated ? "Upgrade to PRO to track this fix" : applied ? "Unmark as applied" : "Mark as applied"}
          >
            <Checkbox
              checked={applied}
              onChange={onToggle}
              disabled={gated}
              aria-label={`Mark "${fix.title}" as applied`}
              label={
                <span className="font-mono text-label-sm uppercase tracking-wide text-on-surface-variant" aria-hidden>
                  done
                </span>
              }
            />
          </div>
          {!gated && (
            <IconButton
              icon={ChevronDown}
              label={`${open ? "Collapse" : "Expand"} fix details for ${fix.title}`}
              size="sm"
              aria-expanded={open}
              className={cn("[&>svg]:transition-transform", open && "[&>svg]:rotate-180")}
            />
          )}
        </div>

        {/* Body */}
        {gated ? (
          <div className="relative">
            <div aria-hidden className="pointer-events-none select-none p-4 blur-[3px] saturate-[0.5]">
              <p className="text-body-sm text-on-surface-variant">{fix.why}</p>
              <div className="mt-2 h-24 rounded-small bg-surface-container-low" />
            </div>
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface/80 p-4 text-center backdrop-blur-[1px]">
              <Icon icon={Lock} size="sm" className="text-premium" />
              <p className="text-body-sm text-on-surface">
                Fix #{displayIndex} is a PRO preview — applying it recovers <span className="font-mono font-bold text-positive">+{fix.points} pts</span>.
              </p>
              <Button
                size="xs"
                onClick={onUpgrade}
                className="bg-premium text-on-premium"
                icon={Crown}
              >
                Unlock with PRO
              </Button>
            </div>
          </div>
        ) : open ? (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-label-sm text-on-surface-variant">
              <span>
                resolves {fix.checkIds.length} check{fix.checkIds.length === 1 ? "" : "s"}: {fix.checkIds.join(", ")}
              </span>
              {fix.docsUrl && (
                <a
                  href={fix.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                >
                  official guide <Icon icon={ExternalLink} size="sm" />
                </a>
              )}
            </div>
            {fix.files.map((file) => (
              <FixFileBlock key={file.path} file={file} />
            ))}
            {fix.manualSteps?.map((step, si) => (
              <div key={si} className="flex items-start gap-2 rounded-small bg-surface-container-low p-3 text-body-sm text-on-surface">
                <span className="font-mono text-label-sm text-primary">{si + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
            {fix.files.length === 0 && !fix.manualSteps?.length && (
              <p className="flex items-center gap-2 font-mono text-label-sm text-on-surface-variant">
                <Icon icon={BookOpen} size="sm" /> no generated files — follow the official guide above
              </p>
            )}
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}

function FixFileBlock({ file }: { file: CodeFix["files"][number] }) {
  return (
    <div className="min-w-0">
      <CodeBlock
        title={file.path}
        action={
          <Button
            type="button"
            variant="outlined"
            size="xs"
            aria-label={`Copy ${file.path}`}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(file.content);
                toast({ title: "Copied", description: `${file.path} is on your clipboard.`, tone: "success" });
              } catch {
                toast({ title: "Copy failed", description: "Clipboard unavailable in this context.", tone: "danger" });
              }
            }}
            icon={Copy}
            className="font-mono"
          >
            Copy
          </Button>
        }
      >
        {file.content}
      </CodeBlock>
      {file.note && <p className="px-1 pt-1.5 font-mono text-label-sm text-premium">{file.note}</p>}
      <div className="flex items-center gap-1 px-1 pt-1.5 font-mono text-label-sm text-on-surface-variant">
        <Icon icon={Check} size="sm" className="text-positive" />
        full file content — paste-ready
      </div>
    </div>
  );
}

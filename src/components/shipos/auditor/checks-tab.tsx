"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, Crown, Lock, Minus, ScanLine, XCircle } from "@/ui/symbols";
import { Badge, Button, Card, Icon, SegmentedButton, cn, type BadgeTone, type IconGlyph } from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { RepoAudit, RepoAuditCheck } from "@/lib/shipos/audit-types";
import { FREE_VISIBLE_CHECKS } from "@/lib/shipos/pro-store";

// ─────────────────────────────────────────────────────────────────────────────
// ChecksTab — all 50 checks grouped by category, with pass/fail filter and
// FREE-tier gating: checks beyond the 20th are blurred behind a PRO unlock.
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

type Filter = "all" | "passed" | "failed";

interface FlatCheck extends RepoAuditCheck {
  categoryId: string;
  categoryName: string;
  flatIndex: number;
}

/** Category score health → the M3 container role that carries it. */
function scoreTone(score: number, max: number): BadgeTone {
  if (max > 0 && score / max >= 0.7) return "primary";
  if (max > 0 && score / max >= 0.4) return "tertiary";
  return "error";
}

export function ChecksTab({
  audit,
  gated,
  owner,
  repo,
  onUpgrade,
}: {
  audit: RepoAudit;
  gated: boolean;
  owner: string;
  repo: string;
  onUpgrade: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  // Flatten once, preserving category order, to compute each check's global index.
  const indexed = useMemo<{ id: string; name: string; score: number; max: number; checks: FlatCheck[] }[]>(() => {
    let idx = 0;
    return audit.categories.map((c) => ({
      id: c.id,
      name: c.name,
      score: c.score,
      max: c.max,
      checks: c.checks.map((ch) => ({ ...ch, categoryId: c.id, categoryName: c.name, flatIndex: idx++ })),
    }));
  }, [audit]);

  const passedCount = audit.stats.checksPassed;
  const failedCount = audit.stats.checksFailed;

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: audit.stats.checksTotal },
    { id: "passed", label: "Passed", count: passedCount },
    { id: "failed", label: "Failed", count: failedCount },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card padding="none" className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex items-center gap-2 font-mono text-label-md uppercase tracking-widest text-on-surface-variant">
            <Icon icon={ScanLine} size="sm" className="text-primary" />
            {"// ALL CHECKS"}
          </p>
          <p className="truncate font-mono text-label-sm text-on-surface-variant">
            {owner}/{repo} · {audit.stats.checksTotal} checks · {audit.stats.pointsAtStake} pts at stake
          </p>
        </div>
        <SegmentedButton
          label="Filter checks"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={FILTERS.map((f) => ({ value: f.id, label: `${f.label} · ${f.count}` }))}
        />
      </Card>

      {indexed.map((category, ci) => {
        const visibleChecks =
          filter === "all" ? category.checks : category.checks.filter((c) => (filter === "passed" ? c.pass && !c.na : !c.pass && !c.na));
        if (visibleChecks.length === 0) return null;
        const catScore = category.score;
        const catMax = category.max;
        return (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(ci * 0.05, 0.25), duration: 0.35 }}
          >
            <CategoryCard
              category={category}
              catScore={catScore}
              catMax={catMax}
              visibleChecks={visibleChecks}
              gated={gated}
              audit={audit}
              onUpgrade={onUpgrade}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function CategoryCard({
  category,
  catScore,
  catMax,
  visibleChecks,
  gated,
  audit,
  onUpgrade,
}: {
  category: { id: string; name: string; checks: FlatCheck[] };
  catScore: number;
  catMax: number;
  visibleChecks: FlatCheck[];
  gated: boolean;
  audit: RepoAudit;
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card padding="none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("flex w-full items-center gap-3 p-4 text-left", interactive())}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-title-sm text-on-surface">{category.name}</span>
            <Badge tone={scoreTone(catScore, catMax)} className="font-mono text-label-sm">
              {catScore}/{catMax} pts
            </Badge>
            <span className="font-mono text-label-sm text-on-surface-variant">
              {category.checks.filter((c) => c.pass).length}/{category.checks.length} passing
            </span>
          </span>
        </span>
        <Icon
          icon={ChevronDown}
          size="sm"
          className={cn("shrink-0 text-on-surface-variant transition-transform duration-short4", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-1 bg-surface-container-low p-2 sm:p-3">
          {visibleChecks.map((check) => (
            <CheckRow key={check.id} check={check} gated={gated} />
          ))}
          {gated && visibleChecks.some((c) => c.flatIndex >= FREE_VISIBLE_CHECKS) && (
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-small bg-premium/10 p-3">
              <Icon icon={Lock} size="sm" className="shrink-0 text-premium" />
              <p className="flex-1 text-body-sm text-on-surface">
                {audit.stats.checksTotal - FREE_VISIBLE_CHECKS} more checks are PRO — see every failure, weight and evidence.
              </p>
              <Button
                size="xs"
                onClick={onUpgrade}
                className="bg-premium text-on-premium"
                icon={Crown}
              >
                Unlock all 50 checks with PRO
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const PASS_ICON: Record<string, { icon: IconGlyph; className: string }> = {
  pass: { icon: CheckCircle2, className: "mt-0.5 shrink-0 text-positive" },
  na: { icon: Minus, className: "mt-0.5 shrink-0 text-on-surface-variant" },
  fail: { icon: XCircle, className: "mt-0.5 shrink-0 text-error" },
};

function CheckRow({ check, gated }: { check: FlatCheck; gated: boolean }) {
  const locked = gated && check.flatIndex >= FREE_VISIBLE_CHECKS;
  const pass = check.pass ? "pass" : check.na ? "na" : "fail";
  const mark = PASS_ICON[pass];

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-small px-2 py-2 transition-colors",
          !locked && interactive(),
          locked && "pointer-events-none select-none blur-[3px]"
        )}
        aria-hidden={locked || undefined}
      >
        <Icon icon={mark.icon} size="sm" className={mark.className} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "text-body-sm font-semibold",
                check.pass ? "text-on-surface" : check.na ? "text-on-surface-variant" : "text-on-surface"
              )}
            >
              {check.label}
            </span>
            <Badge
              tone="neutral"
              variant="outlined"
              className={cn("shrink-0 font-mono text-label-sm", check.na && "text-on-surface-variant")}
            >
              {check.na ? "n/a" : `+${check.weight} pts`}
            </Badge>
          </div>
          <p className="mt-0.5 truncate font-mono text-label-sm text-on-surface-variant" title={check.detail}>
            {check.detail}
          </p>
        </div>
      </div>
      {locked && <Icon icon={Lock} size="sm" className="absolute right-3 top-1/2 -translate-y-1/2 text-premium" aria-hidden />}
    </div>
  );
}

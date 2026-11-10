"use client";

import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";
import { Badge, Card, Progress } from "@/ui";
import type { Scores, ShipResult } from "@/lib/shipos/types";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// ScoreCards — SEO / README / Health / Claim-Ledger row with count-up numbers
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);
  return <span className={className}>{display}</span>;
}

/** Score band → Ink role (success / premium / error), never a hex. */
function scoreTone(score: number): string {
  return score >= 70 ? "text-positive" : score >= 40 ? "text-premium" : "text-error";
}

const TIER_STYLES: Record<Scores["readme"]["tier"], string> = {
  Bronze: "bg-on-surface/[0.06] text-on-surface-variant",
  Silver: "bg-on-surface/10 text-on-surface",
  Gold: "bg-premium/15 text-premium",
  Platinum: "bg-positive/15 text-positive",
};

function ScoreCard({
  label,
  score,
  sub,
  accent,
  delay,
  badge,
}: {
  label: string;
  score: number;
  sub: React.ReactNode;
  accent?: boolean;
  delay: number;
  badge?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        padding="md"
        className={cn(
          "flex flex-col gap-3",
          accent && "bg-primary-container text-on-primary-container"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">
            {label}
          </p>
          {badge}
        </div>
        <p className="font-mono text-display-sm tracking-tight">
          <AnimatedNumber value={score} className={scoreTone(score)} />
          <span className="text-body-lg font-normal text-on-surface-variant">/100</span>
        </p>
        <Progress
          value={score}
          label={`${label} score ${score} out of 100`}
          className="h-1.5"
        />
        <p className="text-body-sm text-on-surface-variant">{sub}</p>
      </Card>
    </motion.div>
  );
}

export function ScoreRow({ data }: { data: ShipResult }) {
  const { scores, ledger } = data;
  const { summary } = ledger;
  const seoPassed = scores.seo.checks.filter((c) => c.pass).length;
  const featuresPresent = scores.readme.features.filter((f) => f.present).length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ScoreCard
        label="SEO Score"
        score={scores.seo.score}
        delay={0}
        sub={`${seoPassed}/${scores.seo.checks.length} checks passed`}
      />
      <ScoreCard
        label="README Score"
        score={scores.readme.score}
        delay={0.06}
        badge={
          <Badge tone="neutral" numeric className={cn("font-mono", TIER_STYLES[scores.readme.tier])}>
            {scores.readme.tier}
          </Badge>
        }
        sub={`${featuresPresent}/${scores.readme.features.length} README features present`}
      />
      <ScoreCard
        label="Repo Health"
        score={scores.health.score}
        delay={0.12}
        sub={
          scores.health.fixes.length > 0
            ? `${scores.health.fixes.length} fix${scores.health.fixes.length === 1 ? "" : "es"} suggested`
            : "All pillars green — submission ready"
        }
      />
      {/* Ledger ratio card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card padding="md" className="flex flex-col gap-3">
          <p className="font-mono text-label-sm uppercase tracking-widest text-on-surface-variant">
            Claim Ledger
          </p>
          <p className="font-mono text-headline-lg tracking-tight">
            <span className="text-positive">{summary.verified}</span>
            <span className="mx-1 text-on-surface-variant/60">/</span>
            <span className="text-premium">{summary.partial}</span>
            <span className="mx-1 text-on-surface-variant/60">/</span>
            <span className="text-error">{summary.rejected}</span>
          </p>
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest"
            aria-hidden="true"
          >
            {summary.total > 0 && (
              <>
                <span
                  className="h-full bg-positive"
                  style={{ width: `${(summary.verified / summary.total) * 100}%` }}
                />
                <span
                  className="h-full bg-premium"
                  style={{ width: `${(summary.partial / summary.total) * 100}%` }}
                />
                <span
                  className="h-full bg-error"
                  style={{ width: `${(summary.rejected / summary.total) * 100}%` }}
                />
              </>
            )}
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Verified / Partial / Rejected · {summary.total} claims audited
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

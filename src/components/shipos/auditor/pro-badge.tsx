"use client";

import { Crown, Lock, Sparkles } from "@/ui/symbols";
import { Button, Icon, cn } from "@/ui";
import { interactive } from "@/ui/state-layer";
import type { Plan } from "@/lib/shipos/pro-store";

// ─────────────────────────────────────────────────────────────────────────────
// PRO visual identity: gold badge pill + reusable lock overlay for gated areas.
// Built on AMNT UI (Ink): colour roles, type scale, square corners.
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_LABEL: Record<Plan, string> = {
  "": "",
  monthly: "MONTHLY",
  lifetime: "LIFETIME",
  team: "TEAM",
};

export function ProBadge({ plan, onOpenManage }: { plan: Plan; onOpenManage: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenManage}
      aria-label="Manage PRO subscription"
      title="Manage your PRO subscription"
      className={cn(
        "inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full bg-premium px-3 text-label-sm font-bold text-on-premium",
        "font-mono shadow-level-1 transition-press",
        interactive({ inverse: true }),
      )}
    >
      <Icon icon={Crown} size="sm" className="shrink-0" />
      <span className="shrink-0">PRO ACTIVE</span>
      {PLAN_LABEL[plan] && (
        <span className="hidden rounded-extra-small bg-on-premium/20 px-1.5 py-0.5 text-label-sm tracking-wider sm:inline">
          {PLAN_LABEL[plan]}
        </span>
      )}
    </button>
  );
}

// ── Gated-section overlay: renders children blurred behind an upgrade panel ──

export function ProLockOverlay({
  title,
  description,
  features,
  onUpgrade,
  upgradeLabel = "Upgrade to PRO",
  children,
  className,
}: {
  title: string;
  description?: string;
  features?: string[];
  onUpgrade: () => void;
  upgradeLabel?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0 overflow-hidden rounded-medium bg-surface-container", className)}>
      {children && (
        <div aria-hidden className="pointer-events-none select-none blur-[3px] saturate-[0.55]">
          {children}
        </div>
      )}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface/80 p-6 text-center backdrop-blur-[2px]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-premium-container text-on-premium-container dark:bg-premium dark:text-on-premium">
          <Icon icon={Lock} size="md" />
        </span>
        <div className="flex max-w-md flex-col gap-1">
          <p className="text-title-md text-on-surface">{title}</p>
          {description && <p className="text-body-sm leading-relaxed text-on-surface-variant">{description}</p>}
        </div>
        {features && features.length > 0 && (
          <ul className="flex max-w-md flex-wrap justify-center gap-1.5">
            {features.map((f) => (
              <li
                key={f}
                className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 font-mono text-label-sm text-on-surface"
              >
                <Icon icon={Sparkles} size="sm" className="text-premium" />
                {f}
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          onClick={onUpgrade}
          className="mt-1 bg-premium text-on-premium"
          icon={Crown}
        >
          {upgradeLabel}
        </Button>
      </div>
    </div>
  );
}

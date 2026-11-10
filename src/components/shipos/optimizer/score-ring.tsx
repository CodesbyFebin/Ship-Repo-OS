"use client";

import { Icon, type IconGlyph } from "@/ui";
import { cn } from "@/lib/utils";

/**
 * ScoreRing — one visibility ring (SEO / AEO / GEO).
 * Shows the score measured from the scanned repository.
 */
export function ScoreRing({
  label,
  hint,
  icon,
  score,
  toneClass,
  trackClass,
}: {
  label: string;
  hint: string;
  icon: IconGlyph;
  score: number;
  toneClass: string;
  trackClass: string;
}) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score)) / 100;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-medium bg-surface-container p-4">
      <div className="relative h-28 w-28" role="img" aria-label={`${label}: ${score} out of 100 observed`}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="7" className={trackClass} />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(C * pct).toFixed(1)} ${C.toFixed(1)}`}
            className={cn(toneClass, "transition-[stroke-dasharray] duration-700 ease-out")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-display-sm tnum leading-none">{score}</span>
          <span className="mt-0.5 flex items-center gap-1 text-label-sm text-on-surface-variant">
            <Icon icon={icon} size="sm" />
            observed
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-title-sm">{label}</div>
        <div className="text-label-md text-on-surface-variant">{hint}</div>
      </div>
    </div>
  );
}

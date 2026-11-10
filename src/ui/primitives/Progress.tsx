import { cn } from "../cn";

/**
 * M3 progress indicators — https://m3.material.io/components/progress-indicators
 *
 * Two shapes, one meaning: something is happening. Determinate when the length
 * is known (an upload, a batch), indeterminate when it is not (a request).
 *
 * Shape decision (law: recorded per component): square track and indicator
 * (Ink, 2026-10-21), not M3's `full`.
 */

const CIRCULAR = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-12 w-12" } as const;

export type SpinnerProps = {
    size?: keyof typeof CIRCULAR;
    /** Announced to screen readers. Omit when a parent already says what is loading. */
    label?: string;
    className?: string;
};

/**
 * Indeterminate. Ink (2026-10-21): a pixel loader, not a circle - eight
 * squares round a 3x3 grid, one light chasing round (CSS in ui.css,
 * `.m3-pixload`). Takes the colour of the text around it, so it is correct
 * inside a filled button (`on-primary`) and on a page (`on-surface`)
 * without anyone choosing. Reduced motion: the squares sit still.
 */
export function Spinner({ size = "md", label, className }: SpinnerProps) {
    return (
        <span
            role={label ? "status" : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            className={cn("m3-pixload", CIRCULAR[size], className)}
        >
            {Array.from({ length: 9 }, (_, i) => <i key={i} />)}
        </span>
    );
}

export type ProgressProps = {
    /** 0–100. Leave undefined for indeterminate. */
    value?: number;
    /** What is progressing. Required — a bare bar tells a screen reader nothing. */
    label: string;
    className?: string;
};

/**
 * Linear progress. 4dp tall, `primary` on `secondary-container`, square.
 *
 * The indeterminate animation is transform-only, so it never triggers layout,
 * and it stops entirely under `prefers-reduced-motion` (see globals.css).
 */
export function Progress({ value, label, className }: ProgressProps) {
    const determinate = typeof value === "number";
    const pct = determinate ? Math.max(0, Math.min(100, value)) : undefined;
    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuenow={determinate ? pct : undefined}
            aria-valuemin={determinate ? 0 : undefined}
            aria-valuemax={determinate ? 100 : undefined}
            className={cn("h-1 w-full overflow-hidden bg-secondary-container", className)}
        >
            <div
                className={cn(
                    "h-full bg-primary",
                    determinate ? "transition-[width] duration-medium2 ease-standard" : "w-full animate-m3-progress origin-left",
                )}
                style={determinate ? { width: `${pct}%` } : undefined}
            />
        </div>
    );
}

import type { ReactNode } from "react";
import type { IconGlyph } from "../primitives/Icon";
import { cn } from "../cn";
import { Icon } from "./Icon";

/**
 * M3 badge — https://m3.material.io/components/badges
 *
 * A short, non-interactive label: a state, a chain, a count. If it can be
 * clicked it is a Chip or a Button, not a Badge.
 *
 * Shape (recorded per law §2.3): `small`. Counts use `full`.
 *
 * ⚠️ There are no invented tones. M3 gives four container pairs — `primary`,
 * `secondary`, `tertiary`, `error` — and those are the only ones. A badge
 * never carries meaning by colour alone: the word inside it does that, which
 * is why `tone` has no "success" and no "warning".
 *
 * `premium` is the one M3 custom colour (tokens.ts `customColors`): the gold
 * on Pro items, with the word "Pro" inside, owner 2026-09-27.
 */

const TONE = {
    neutral: "bg-surface-container-highest text-on-surface-variant",
    primary: "bg-primary-container text-on-primary-container",
    secondary: "bg-secondary-container text-on-secondary-container",
    tertiary: "bg-tertiary-container text-on-tertiary-container",
    error: "bg-error-container text-on-error-container",
    // Gold in both themes: the pale container on light, the bright role on dark (its container is brown).
    premium: "bg-premium-container text-on-premium-container dark:bg-premium dark:text-on-premium",
} as const;

const SOLID = {
    neutral: "bg-inverse-surface text-inverse-on-surface",
    primary: "bg-primary text-on-primary",
    secondary: "bg-inverse-surface text-inverse-on-surface",
    tertiary: "bg-tertiary text-on-tertiary",
    error: "bg-error text-on-error",
    premium: "bg-premium text-on-premium",
} as const;

export type BadgeTone = keyof typeof TONE;

export type BadgeProps = {
    tone?: BadgeTone;
    variant?: "tonal" | "solid" | "outlined";
    size?: "sm" | "md";
    icon?: IconGlyph;
    /** Prices and counts: keeps digits aligned between rows (§2.2). */
    numeric?: boolean;
    className?: string;
    children: ReactNode;
};

export function Badge({ tone = "neutral", variant = "tonal", size = "md", icon, numeric, className, children }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-small",
                size === "sm" ? "h-5 px-1.5 text-label-sm" : "h-6 px-2 text-label-md",
                variant === "solid" ? SOLID[tone] : TONE[tone],
                variant === "outlined" && "bg-surface-container-high text-on-surface-variant",
                numeric && "tnum",
                className,
            )}
        >
            {icon ? <Icon icon={icon} size="sm" className="h-4 w-4" /> : null}
            {children}
        </span>
    );
}

export type CountBadgeProps = { count: number; max?: number; label: string; className?: string };

/**
 * M3's small/large badge: the number on a nav item or an avatar. Anything over
 * `max` reads "99+", because a four-digit badge stops being a badge.
 */
export function CountBadge({ count, max = 99, label, className }: CountBadgeProps) {
    if (count <= 0) return null;
    return (
        <span
            aria-label={`${count} ${label}`}
            className={cn(
                "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 text-label-sm text-on-error tnum",
                className,
            )}
        >
            {count > max ? `${max}+` : count}
        </span>
    );
}

/* ── Product state ────────────────────────────────────────────────────── */

/**
 * An agent's state as a dot plus a word.
 *
 * The roles come from `tokens.semantic`, which maps a product state to an M3
 * role — §2.1 forbids inventing a colour for one. The dot alone never carries
 * the meaning: colour-blind users and screen readers both get the word, and
 * `running` is the only state that also moves, because it is the only one
 * that is changing.
 */
const AGENT_STATE = {
    live: { tone: "text-positive", label: "Live" },
    running: { tone: "text-primary", label: "Running" },
    paused: { tone: "text-on-surface-variant", label: "Paused" },
    failed: { tone: "text-error", label: "Failed" },
    draft: { tone: "text-outline", label: "Draft" },
} as const;

export type StatusProps = {
    state: keyof typeof AGENT_STATE;
    /** Defaults to the state's own word. */
    children?: ReactNode;
    /** Dot only, with the state still announced to screen readers. */
    dotOnly?: boolean;
    className?: string;
};

export function Status({ state, children, dotOnly, className }: StatusProps) {
    const s = AGENT_STATE[state];
    return (
        <span className={cn("inline-flex items-center gap-1.5 text-label-md", s.tone, className)}>
            <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full bg-current", state === "running" && "m3-pulse")} />
            {dotOnly ? <span className="sr-only">{children ?? s.label}</span> : (children ?? s.label)}
        </span>
    );
}

/* ── Divider ──────────────────────────────────────────────────────────── */

export type DividerProps = {
    orientation?: "horizontal" | "vertical";
    /** M3 inset divider: indented to line up with list text past the leading icon. */
    inset?: boolean;
    /** A word in the gap, like "or" between two ways to sign in. Still no line. */
    label?: string;
    className?: string;
};

/** M3 divider — 1dp of `outline-variant`, and never a colour of its own. */
/**
 * 🔴 Law 11: this draws NO line. It is the semantic separator plus the space a
 * line used to occupy — the gap is what the eye reads, the role is what a
 * screen reader reads. Kept as a component so the two stay in step, and so the
 * ~2 call sites did not each have to invent their own margin.
 *
 * If you want a visible rule, you want a surface step or a `Section` instead.
 */
export function Divider({ orientation = "horizontal", inset, label, className }: DividerProps) {
    if (label) {
        return (
            <div role="separator" aria-label={label} className={cn("text-center text-label-md uppercase text-on-surface-variant", className)}>
                {label}
            </div>
        );
    }
    return (
        <div
            role="separator"
            aria-orientation={orientation}
            className={cn(
                "shrink-0",
                orientation === "horizontal" ? "h-4 w-full" : "w-4 self-stretch",
                inset && orientation === "horizontal" && "ml-4",
                className,
            )}
        />
    );
}

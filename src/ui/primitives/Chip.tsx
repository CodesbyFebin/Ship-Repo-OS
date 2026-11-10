"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import type { IconGlyph } from "../primitives/Icon";
import { Check, X } from "../symbols";
import { cn } from "../cn";
import { Icon } from "./Icon";
import { interactive } from "../state-layer";

/**
 * M3 chips — https://m3.material.io/components/chips
 *
 * Four kinds, and the kind is decided by what the chip DOES, not how it looks:
 *
 *   assist      helps with the current task: "Add to calendar", "Share".
 *   filter      narrows a set. Toggles. Shows a check when on.
 *   input       a thing the user entered: a tag, a recipient. Has a remove X.
 *   suggestion  a shortcut the app is offering: a prompt, a saved query.
 *
 * Shape (recorded per law §2.3): `small` — M3's chip corner, 8dp.
 * Height is 32dp, and the 48dp touch target is added without growing the box.
 */

/* M3 flat chip (material-web md-comp-*-chip): no fill, a 1dp stroke drawn
   inset so the box never grows; selected is `secondary-container` with no
   stroke. The stroke is `outline-variant`, the calmer M3 2025 value, so a row
   of chips reads as a set of options and not as a row of boxes. The icon is
   muted ink (2026-10-09); selected is the blue tint, the one place a chip
   uses the accent, so "picked" reads at a glance. */
const UNSELECTED = "bg-transparent text-on-surface shadow-[inset_0_0_0_1px_rgb(var(--md-sys-color-on-surface-rgb)/0.14)] [&>[data-chip-icon]]:text-on-surface-variant";
const SELECTED = "bg-primary-container text-on-primary-container shadow-[inset_0_0_0_1px_rgb(var(--md-sys-color-primary-rgb)/0.24)]";

export type ChipKind = "assist" | "filter" | "input" | "suggestion";

const BASE =
    "inline-flex h-8 shrink-0 select-none items-center gap-2 whitespace-nowrap rounded-small px-3 text-label-lg " +
    "transition-press " +
    /* 48dp to the finger, on a 32dp box. */
    "before:absolute before:left-1/2 before:top-1/2 before:h-touch before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onSelect"> & {
    kind?: ChipKind;
    /** Filter and input chips: whether this one is on. */
    selected?: boolean;
    /** Leading icon, or an avatar element for an input chip. */
    icon?: IconGlyph;
    avatar?: ReactNode;
    /** Input chips: shown as a trailing X. Makes the chip removable. */
    onRemove?: () => void;
    /** The word on the remove button, e.g. "Remove tag Solana". */
    removeLabel?: string;
    children: ReactNode;
};

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
    { kind = "assist", selected, icon, avatar, onRemove, removeLabel, children, className, type = "button", disabled, ...rest },
    ref,
) {
    /* A filter chip is a toggle, so it announces pressed state; everything
       else is a plain button. An input chip is not a toggle at all. */
    const isToggle = kind === "filter";
    const on = Boolean(selected);

    return (
        <span className={cn("relative inline-flex", disabled && "pointer-events-none opacity-[0.38]")}>
            <button
                ref={ref}
                type={type}
                disabled={disabled}
                aria-pressed={isToggle ? on : undefined}
                data-selected={on || undefined}
                /* The prompt bar folds a chip to an icon on a phone (ui.css). */
                data-chip=""
                className={cn(
                    BASE,
                    on ? SELECTED : kind === "suggestion" || kind === "assist" ? UNSELECTED : cn(UNSELECTED, "text-on-surface-variant"),
                    /* An input chip that can be removed leaves room for the X. */
                    onRemove && "pr-1",
                    avatar && "pl-1",
                    interactive(),
                    className,
                )}
                {...rest}
            >
                {on && isToggle ? <Icon icon={Check} size="sm" className="h-[18px] w-[18px]" /> : null}
                {avatar}
                {icon && !(on && isToggle) ? <Icon icon={icon} size="sm" data-chip-icon="" className="h-[18px] w-[18px]" /> : null}
                {children}
                {onRemove ? <span aria-hidden className="w-[18px]" /> : null}
            </button>
            {onRemove ? (
                /* Its own button, not a click zone inside the chip: removing is
                   a different action from selecting and needs its own name. */
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={disabled}
                    aria-label={removeLabel ?? "Remove"}
                    className={cn(
                        "absolute right-1 top-1/2 inline-flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full",
                        "text-on-surface-variant",
                        "before:absolute before:left-1/2 before:top-1/2 before:h-touch before:w-touch before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
                        interactive(),
                    )}
                >
                    <Icon icon={X} width={16} height={16} strokeWidth={2} aria-hidden focusable={false} />
                </button>
            ) : null}
        </span>
    );
});

export type ChipLinkProps = {
    href: string;
    /** This chip is the page you are on: shown selected, announced as current. */
    current?: boolean;
    icon?: IconGlyph;
    /** A count after the label, e.g. 36 items. */
    count?: number;
    prefetch?: boolean;
    className?: string;
    children: ReactNode;
};

/**
 * An assist chip that GOES somewhere: a category, a tag, a style. A link,
 * never a button, so crawlers and "open in new tab" work. Same shape, height
 * and 48dp touch target as `Chip`.
 */
export function ChipLink({ href, current, icon, count, prefetch, className, children }: ChipLinkProps) {
    return (
        <Link
            href={href}
            prefetch={prefetch}
            aria-current={current ? "page" : undefined}
            className={cn(
                "relative",
                BASE,
                current ? SELECTED : UNSELECTED,
                interactive(),
                className,
            )}
        >
            {icon ? <Icon icon={icon} size="sm" data-chip-icon="" className="h-[18px] w-[18px]" /> : null}
            {children}
            {count !== undefined ? <span className="text-on-surface-variant">{count}</span> : null}
        </Link>
    );
}

export type ChipGroupProps = {
    /** What the set of chips is for, e.g. "Filter by chain". */
    label: string;
    /** Chips wrap by default; `scroll` keeps them on one line on a phone. */
    overflow?: "wrap" | "scroll";
    children: ReactNode;
    className?: string;
};

/**
 * A set of chips. It is a `group` with a name, so a screen reader says what
 * the row of chips is filtering before reading the chips themselves.
 */
export function ChipGroup({ label, overflow = "wrap", children, className }: ChipGroupProps) {
    return (
        <div
            role="group"
            aria-label={label}
            className={cn(
                "flex gap-2",
                overflow === "wrap" ? "flex-wrap" : "overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                className,
            )}
        >
            {children}
        </div>
    );
}

"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { IconGlyph } from "../primitives/Icon";
import { cn } from "../cn";
import { Icon } from "./Icon";
import { Spinner } from "./Progress";
import { interactive } from "../state-layer";

/**
 * M3 common buttons — https://m3.material.io/components/buttons
 *
 * Five variants, in order of emphasis. Pick by how important the action is on
 * the screen, never by how it looks:
 *
 *   filled    the one thing the screen is for. At most one per view.
 *   tonal     an important action next to the filled one.
 *   elevated  the same emphasis as tonal, but on a busy or scrolling surface
 *             where a tonal fill would disappear.
 *   outlined  a secondary action that still needs a boundary.
 *   text      the lowest emphasis: in a card footer, in a dialog, in a row.
 *
 * Shape (2026-10-09): `small`, an 8px corner, on every size. Pills read as
 * a phone OS; a firm small corner reads as a tool. A dense data action uses
 * `size="xs"`, 32dp tall.
 *
 * Every variant gets the same state layer and the same focus ring, from
 * `src/ui/state-layer.ts`. No variant invents a hover colour.
 */

const VARIANT = {
    /* Flat fills, no lift on hover: the state layer is the only hover. Only
       `filled` is blue; every other variant is neutral ink, so one screen
       never has three blue buttons competing. */
    filled: "bg-primary text-on-primary",
    /* A see-through ink fill, not a fixed grey: it stays visible on the
       white page AND on a grey card, where a grey button used to vanish. */
    tonal: "bg-on-surface/[0.07] text-on-surface",
    elevated: "bg-surface-container-lowest text-on-surface shadow-level-1 dark:bg-surface-container-high",
    /* A 1px hairline, drawn inset so the box never grows. */
    outlined: "bg-transparent text-on-surface shadow-[inset_0_0_0_1px_rgb(var(--md-sys-color-on-surface-rgb)/0.14)] disabled:shadow-[inset_0_0_0_1px_rgb(var(--md-sys-color-on-surface-rgb)/0.12)]",
    text: "text-on-surface",
    /** Destructive. M3 has no danger variant; `error` is the role for it. */
    danger: "bg-error text-on-error",
} as const;

/**
 * M3 button heights. 40dp is the spec default; `xs` is AMNT's dense step for
 * table rows and toolbars, and it still carries a 48dp touch target.
 */
const SIZE = {
    xs: "h-8 px-3 text-label-lg gap-1.5",
    md: "h-10 px-4 text-label-lg gap-2",
    lg: "h-12 px-5 text-title-sm gap-2",
} as const;

/** Text buttons sit closer to their neighbours: M3 gives them 12dp, not 24dp. */
const TEXT_PAD = { xs: "px-2", md: "px-3", lg: "px-4" } as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

/** The shared shape of every button-like thing, so a link matches a button. */
export function buttonStyles(variant: ButtonVariant = "filled", size: ButtonSize = "md", fullWidth?: boolean) {
    return cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-small",
        /* 🔴 The shape never changes on press. It used to animate the corner
           from 9999px to 12px, which a browser interpolates in px: the pill
           stayed round, snapped square at the last frame, then jumped back
           round on release - read as a glitch (owner, 2026-09-28). The press
           is the M3 state layer, nothing else. */
        "transition-press",
        /* 40dp box (M3), 48dp to a finger: the hit area is a pseudo-element,
           so the button itself never grows. */
        "before:absolute before:inset-x-0 before:top-1/2 before:h-touch before:-translate-y-1/2 before:content-['']",
        VARIANT[variant],
        SIZE[size],
        variant === "text" && TEXT_PAD[size],
        fullWidth && "w-full",
        interactive({ inverse: variant === "filled" || variant === "danger" }),
        "disabled:pointer-events-none disabled:text-on-surface/[0.38]",
        /* M3 disabled: a 12% container on the filled kinds; the outlined one
           keeps its stroke at 12%; a text button has no container at all. */
        variant === "outlined" || variant === "text" ? "disabled:bg-transparent" : "disabled:bg-on-surface/[0.12] disabled:shadow-none",
    );
}

type Common = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Leading icon. Decorative — the label says what the button does. */
    icon?: IconGlyph;
    /** Trailing icon: a chevron, an external-link mark. */
    trailingIcon?: IconGlyph;
    fullWidth?: boolean;
    children?: ReactNode;
};

export type ButtonProps = Common &
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
        /** Swaps the leading icon for a spinner and blocks the click. */
        loading?: boolean;
        /** Announced while `loading`. Without it a screen reader hears nothing change. */
        loadingLabel?: string;
    };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "filled", size = "md", icon, trailingIcon, fullWidth, loading, loadingLabel = "Working…", children, className, disabled, type = "button", ...rest },
    ref,
) {
    const iconSize = size === "lg" ? "md" : "sm";
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(buttonStyles(variant, size, fullWidth), className)}
            {...rest}
        >
            {loading ? <Spinner size="sm" label={loadingLabel} /> : icon ? <Icon icon={icon} size={iconSize} /> : null}
            {children}
            {trailingIcon && !loading ? <Icon icon={trailingIcon} size={iconSize} /> : null}
        </button>
    );
});

export type ButtonLinkProps = Common & {
    href: string;
    /** Opens in a new tab and adds the rel that stops the new page reaching back. */
    external?: boolean;
    className?: string;
    "aria-label"?: string;
    prefetch?: boolean;
};

/**
 * A link that looks like a button. It is an `<a>`, because it navigates —
 * which means middle-click, ⌘-click and "copy link address" all work.
 */
export function ButtonLink({ href, external, variant = "filled", size = "md", icon, trailingIcon, fullWidth, children, className, prefetch, ...rest }: ButtonLinkProps) {
    const iconSize = size === "lg" ? "md" : "sm";
    const inner = (
        <>
            {icon ? <Icon icon={icon} size={iconSize} /> : null}
            {children}
            {trailingIcon ? <Icon icon={trailingIcon} size={iconSize} /> : null}
        </>
    );
    const cls = cn(buttonStyles(variant, size, fullWidth), className);
    if (external) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
                {inner}
            </a>
        );
    }
    return (
        <Link href={href} prefetch={prefetch} className={cls} {...rest}>
            {inner}
        </Link>
    );
}

/* ── Icon button ──────────────────────────────────────────────────────── */

const ICON_VARIANT = {
    standard: "text-on-surface-variant",
    filled: "bg-primary text-on-primary",
    tonal: "bg-on-surface/[0.07] text-on-surface",
    outlined: "bg-transparent text-on-surface shadow-[inset_0_0_0_1px_rgb(var(--md-sys-color-on-surface-rgb)/0.14)]",
    /** Save, and nothing else: the one green button (tokens.ts `positive`). */
    positive: "bg-positive text-on-positive",
} as const;

const ICON_SIZE = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" } as const;

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    icon: IconGlyph;
    /** Required: the button has no words, so this IS its name. */
    label: string;
    variant?: keyof typeof ICON_VARIANT;
    size?: keyof typeof ICON_SIZE;
    /** A toggle icon button. Sets `aria-pressed` and the selected state layer. */
    pressed?: boolean;
};

/**
 * M3 icon button — https://m3.material.io/components/icon-buttons
 *
 * 40dp visual box, 48dp touch target. The extra hit area is a transparent
 * pseudo-element, so growing it never moves the neighbours.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { icon, label, variant = "standard", size = "md", pressed, className, type = "button", ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            aria-label={label}
            aria-pressed={pressed}
            data-selected={pressed || undefined}
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-small transition-press",
                /* 48dp to the finger without a 48dp box. */
                "before:absolute before:left-1/2 before:top-1/2 before:h-touch before:w-touch before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
                ICON_VARIANT[variant],
                ICON_SIZE[size],
                interactive({ inverse: variant === "filled" || variant === "positive" }),
                "disabled:pointer-events-none disabled:text-on-surface/[0.38] disabled:bg-transparent",
                className,
            )}
            {...rest}
        >
            <Icon icon={icon} size={size === "sm" ? "sm" : "md"} />
        </button>
    );
});

/* ── FAB ──────────────────────────────────────────────────────────────── */

const FAB_SIZE = { sm: "h-10 w-10 rounded-medium", md: "h-14 w-14 rounded-large", lg: "h-20 w-20 rounded-extra-large" } as const;

export type FabProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    icon: IconGlyph;
    label: string;
    size?: keyof typeof FAB_SIZE;
    /** An extended FAB shows its label. Use it when the action needs a word. */
    extended?: boolean;
};

/**
 * M3 FAB — https://m3.material.io/components/floating-action-button
 *
 * The single most important action on a screen, and only when it is a screen
 * where that action is the point. If a page has two, neither is a FAB.
 */
export const Fab = forwardRef<HTMLButtonElement, FabProps>(function Fab(
    { icon, label, size = "md", extended, className, type = "button", ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            aria-label={extended ? undefined : label}
            className={cn(
                "inline-flex items-center justify-center gap-3 bg-primary text-on-primary shadow-level-3",
                "transition-press",
                extended ? "h-12 rounded-medium px-5 text-label-lg" : FAB_SIZE[size],
                interactive({ inverse: true }),
                className,
            )}
            {...rest}
        >
            <Icon icon={icon} size={size === "lg" ? "lg" : "md"} />
            {extended ? label : null}
        </button>
    );
});

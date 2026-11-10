"use client";

import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Check, Minus } from "../symbols";
import type { IconGlyph } from "../primitives/Icon";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { useFieldState } from "./Field";
import { focusRing, interactive } from "../state-layer";

/**
 * M3 selection controls —
 * https://m3.material.io/components/checkbox · /radio-button · /switch
 *
 * All three are a real `<input>` underneath, visually hidden and driven with
 * `peer-*`. That is what keeps the browser's own behaviour: form submission,
 * `:checked`, the label click target, keyboard, autofill and — for radios —
 * arrow-key roving within a name group, which a `role="radio"` div has to
 * re-implement and usually gets wrong.
 *
 * Every one carries a 48dp touch target without a 48dp visual box.
 */

/** The real control, off-screen but still focusable and still the form's value. */
const HIDDEN = "peer sr-only";

/* ── Checkbox ─────────────────────────────────────────────────────────── */

export type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "size"> & {
    label: ReactNode;
    /** Under the label: what choosing this means. */
    hint?: ReactNode;
    /** Some-but-not-all of a group. Renders the M3 dash. */
    indeterminate?: boolean;
    className?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
    { label, hint, indeterminate, className, ...rest },
    ref,
) {
    const field = useFieldState();
    const uid = useId();
    const id = rest.id ?? `cb-${uid}`;
    return (
        <div className={cn("flex min-w-0 items-start gap-1", className)}>
            <input
                ref={node => {
                    if (node) node.indeterminate = Boolean(indeterminate);
                    if (typeof ref === "function") ref(node);
                    else if (ref) ref.current = node;
                }}
                type="checkbox"
                id={id}
                disabled={rest.disabled ?? field?.disabled}
                aria-describedby={rest["aria-describedby"] ?? (hint ? `${id}-hint` : field?.describedBy)}
                className={HIDDEN}
                {...rest}
            />
            <label
                htmlFor={id}
                className={cn(
                    "-ml-3.5 flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full",
                    "text-on-surface-variant peer-checked:text-primary peer-indeterminate:text-primary",
                    "peer-disabled:cursor-not-allowed peer-disabled:opacity-[0.38]",
                    "peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-[-6px] peer-focus-visible:outline-primary",
                    /* Checked/indeterminate reach the box and the glyph through
                       the label — the only element the input can select. */
                    "peer-checked:[&>span]:bg-current peer-indeterminate:[&>span]:bg-current",
                    "peer-checked:[&_[data-check]]:block peer-indeterminate:[&_[data-dash]]:block",
                    "m3-state",
                )}
            >
                {/* The 18dp box M3 draws. The 48dp label around it is the target. */}
                <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center rounded-extra-small border-2 border-current transition-[background-color] duration-short4 ease-standard">
                    <Icon icon={Check} width={14} height={14} strokeWidth={3} aria-hidden data-check className="hidden text-on-primary" />
                    <Icon icon={Minus} width={14} height={14} strokeWidth={3} aria-hidden data-dash className="hidden text-on-primary" />
                </span>
            </label>
            <label htmlFor={id} className="min-w-0 cursor-pointer py-3 peer-disabled:cursor-not-allowed peer-disabled:opacity-[0.38]">
                <span className="block text-body-lg text-on-surface">{label}</span>
                {hint ? (
                    <span id={`${id}-hint`} className="block text-body-sm text-on-surface-variant">
                        {hint}
                    </span>
                ) : null}
            </label>
        </div>
    );
});

/* ── Radio ────────────────────────────────────────────────────────────── */

export type RadioProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "size"> & {
    label: ReactNode;
    hint?: ReactNode;
    className?: string;
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ label, hint, className, ...rest }, ref) {
    const field = useFieldState();
    const uid = useId();
    const id = rest.id ?? `rd-${uid}`;
    return (
        <div className={cn("flex min-w-0 items-start gap-1", className)}>
            <input
                ref={ref}
                type="radio"
                id={id}
                disabled={rest.disabled ?? field?.disabled}
                aria-describedby={rest["aria-describedby"] ?? (hint ? `${id}-hint` : undefined)}
                className={HIDDEN}
                {...rest}
            />
            <label
                htmlFor={id}
                className={cn(
                    "-ml-3.5 flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full",
                    "text-on-surface-variant peer-checked:text-primary",
                    "peer-disabled:cursor-not-allowed peer-disabled:opacity-[0.38]",
                    "peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-[-6px] peer-focus-visible:outline-primary",
                    "peer-checked:[&_[data-dot]]:scale-100",
                    "m3-state",
                )}
            >
                <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current">
                    <span data-dot className="h-2.5 w-2.5 scale-0 rounded-full bg-current transition-transform duration-short4 ease-standard" />
                </span>
            </label>
            <label htmlFor={id} className="min-w-0 cursor-pointer py-3 peer-disabled:cursor-not-allowed peer-disabled:opacity-[0.38]">
                <span className="block text-body-lg text-on-surface">{label}</span>
                {hint ? (
                    <span id={`${id}-hint`} className="block text-body-sm text-on-surface-variant">
                        {hint}
                    </span>
                ) : null}
            </label>
        </div>
    );
});

export type RadioGroupProps = {
    /** The `name` every radio in the group shares. Arrow keys roam within it. */
    name: string;
    children: ReactNode;
    className?: string;
};

/** Radios in one group. `FormField as="group"` supplies the legend. */
export function RadioGroup({ children, className }: RadioGroupProps) {
    return <div className={cn("flex flex-col", className)}>{children}</div>;
}

/* ── Switch ───────────────────────────────────────────────────────────── */

export type SwitchProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "size"> & {
    label: ReactNode;
    hint?: ReactNode;
    className?: string;
};

/**
 * M3 switch: 52×32dp track, a handle that grows from 16dp to 24dp when on.
 * A switch takes effect immediately — if the change needs a Save button, it is
 * a Checkbox.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch({ label, hint, className, ...rest }, ref) {
    const field = useFieldState();
    const uid = useId();
    const id = rest.id ?? `sw-${uid}`;
    return (
        <div className={cn("flex min-w-0 items-center justify-between gap-4", className)}>
            <label htmlFor={id} className="min-w-0 cursor-pointer py-2">
                <span className="block text-body-lg text-on-surface">{label}</span>
                {hint ? (
                    <span id={`${id}-hint`} className="block text-body-sm text-on-surface-variant">
                        {hint}
                    </span>
                ) : null}
            </label>
            <input
                ref={ref}
                type="checkbox"
                role="switch"
                id={id}
                disabled={rest.disabled ?? field?.disabled}
                aria-describedby={rest["aria-describedby"] ?? (hint ? `${id}-hint` : undefined)}
                className={HIDDEN}
                {...rest}
            />
            <label
                htmlFor={id}
                className={cn(
                    "relative flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full px-1",
                    /* M3 unselected track: `surface-container-highest` with a
                       2dp `outline` stroke - without it the off switch vanished
                       into a light surface. Selected: `primary`, no stroke. */
                    "bg-surface-container-highest shadow-[inset_0_0_0_2px_var(--md-sys-color-outline)]",
                    "transition-[background-color,box-shadow] duration-short4 ease-standard",
                    "peer-checked:bg-primary peer-checked:shadow-none",
                    "peer-disabled:cursor-not-allowed peer-disabled:opacity-[0.38]",
                    "peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
                    /* 48dp to the finger on a 32dp track. */
                    "before:absolute before:left-1/2 before:top-1/2 before:h-touch before:w-touch before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
                    /* The handle grows 16dp → 24dp and slides. Written on the
                       label, which is the only sibling the input can select. */
                    "peer-checked:[&>span]:h-6 peer-checked:[&>span]:w-6 peer-checked:[&>span]:translate-x-5 peer-checked:[&>span]:bg-on-primary",
                )}
            >
                <span
                    aria-hidden
                    className="pointer-events-none block h-4 w-4 translate-x-0 rounded-full bg-outline transition-[transform,width,height,background-color] duration-short4 ease-emphasized"
                />
            </label>
        </div>
    );
});

/* ── Slider ───────────────────────────────────────────────────────────── */

export type SliderProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "size"> & {
    label: string;
    /** Shown beside the label, e.g. the current price. */
    valueLabel?: ReactNode;
    /** Just the track, for a dense row that says the value itself. The label still names it for screen readers. */
    hideLabel?: boolean;
    className?: string;
};

/**
 * M3 slider, on the browser's own `<input type="range">` — which already has
 * arrow keys, Home/End, Page Up/Down and the right screen-reader role. The
 * track and handle are styled with the vendor pseudo-elements; nothing about
 * the behaviour is re-implemented.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider({ label, valueLabel, hideLabel, className, onInput, ...rest }, ref) {
    const field = useFieldState();
    const uid = useId();
    const id = rest.id ?? `sl-${uid}`;
    /* WebKit has no `::-moz-range-progress`, so the active track is a
       gradient stop at the value (`--m3-p`). Without it Chrome and Safari
       drew one pale track and the value was invisible (found 2026-09-28). */
    const pct = (v: unknown) => {
        const min = Number(rest.min ?? 0), max = Number(rest.max ?? 100), n = Number(v ?? (min + max) / 2);
        return max > min ? `${((n - min) / (max - min)) * 100}%` : "0%";
    };
    const sync = (el: HTMLInputElement | null) => el?.style.setProperty("--m3-p", pct(el.value));
    return (
        <div className={cn("flex min-w-0 flex-col gap-1", className)}>
            {hideLabel ? null : (
                <div className="flex items-baseline justify-between gap-4">
                    <label htmlFor={id} className="text-title-sm text-on-surface">
                        {label}
                    </label>
                    {valueLabel ? <span className="text-body-md text-on-surface-variant tnum">{valueLabel}</span> : null}
                </div>
            )}
            <input
                ref={node => {
                    sync(node);
                    if (typeof ref === "function") ref(node);
                    else if (ref) ref.current = node;
                }}
                type="range"
                id={id}
                aria-label={hideLabel ? label : undefined}
                disabled={rest.disabled ?? field?.disabled}
                aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
                onInput={e => {
                    sync(e.currentTarget);
                    onInput?.(e);
                }}
                style={{ ["--m3-p" as string]: pct(rest.value ?? rest.defaultValue) }}
                className={cn(
                    /* `touch-none`: browsers let a range pan the page up and down,
                       so a slightly slanted drag scrolled the popup instead of
                       moving the handle (owner, 2026-09-30). */
                    "h-touch w-full cursor-pointer touch-none appearance-none bg-transparent",
                    focusRing,
                    "outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-[0.38]",
                    /* M3 track: 4dp, `primary` up to the value, `secondary-container` after. */
                    "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full",
                    "[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--md-sys-color-primary)_var(--m3-p,50%),var(--md-sys-color-secondary-container)_var(--m3-p,50%))]",
                    "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-secondary-container",
                    "[&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary",
                    /* M3 handle: a 20dp `primary` circle, level-1 shadow. */
                    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-level-1",
                    "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-level-1",
                )}
                {...rest}
            />
        </div>
    );
});

/* ── Segmented button ─────────────────────────────────────────────────── */

export type SegmentedOption<T extends string> = {
    value: T;
    label: string;
    icon?: IconGlyph;
};

export type SegmentedButtonProps<T extends string> = {
    /** What the set chooses, e.g. "Chart range". Named for screen readers. */
    label: string;
    options: SegmentedOption<T>[];
    value: T;
    onChange: (value: T) => void;
    /** More than one may be on at once. */
    multi?: boolean;
    /**
     * Stretch to fill the row, with every segment the same width.
     *
     * ⚠️ Off by default, and that is the whole bug this prop exists for. The
     * SELECTED segment grows by a 18dp check plus its gap, so equal widths mean
     * the selected label has ~26dp less room than the others — "Grid" rendered
     * as "G…" on a phone while "List" fitted. Segments size to their content
     * unless a caller genuinely wants a full-width bar.
     */
    fullWidth?: boolean;
    className?: string;
};

/**
 * M3 segmented button — https://m3.material.io/components/segmented-buttons
 *
 * Two to five options, all visible, one row. More than five is a Select; two
 * that are on/off is a Switch.
 *
 * Shape (2026-10-09): a grey track with an 8px corner; the picked segment is
 * a white raised thumb inside it (4px corner). Reads at a glance on any
 * surface, including a grey card, without a check mark.
 */
export function SegmentedButton<T extends string>({ label, options, value, onChange, multi, fullWidth, className }: SegmentedButtonProps<T>) {
    return (
        <div role={multi ? "group" : "radiogroup"} aria-label={label} className={cn(
            "h-10 max-w-full gap-0.5 rounded-small bg-surface-container-high p-1",
            fullWidth ? "flex w-full" : "inline-flex",
            className,
        )}>
            {options.map((o, i) => {
                const on = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role={multi ? undefined : "radio"}
                        aria-checked={multi ? undefined : on}
                        aria-pressed={multi ? on : undefined}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            /* nowrap: a squeezed segment broke "Never" into "Ne / ver". */
                            "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-extra-small px-3 text-label-lg",
                            /* flex-auto, not flex-1: the selected segment carries a check, so it needs more room than the rest. */
                            fullWidth ? "min-w-0 flex-auto" : "shrink-0",
                            "transition-state duration-short4 ease-standard active:![scale:1]",
                            on ? "bg-surface-container-lowest text-on-surface shadow-level-1 dark:bg-surface-container-highest" : "text-on-surface-variant",
                            /* 48dp to a finger on a 40dp segment. */
                            "before:absolute before:inset-x-0 before:top-1/2 before:h-touch before:-translate-y-1/2 before:content-['']",
                            interactive(),
                        )}
                    >
                        {o.icon ? <Icon icon={o.icon} size="sm" className="h-[18px] w-[18px]" /> : null}
                        <span className={cn(fullWidth && "truncate")}>{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

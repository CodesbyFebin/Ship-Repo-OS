"use client";

import { Children, forwardRef, isValidElement, useEffect, useId, useRef, useState, type ChangeEvent, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react";
import { ChevronDown, Search as SearchIcon, X } from "../symbols";
import type { IconGlyph } from "../primitives/Icon";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { SupportingText, useFieldState } from "./Field";
import { ColorPopover } from "./ColorPicker";
import { Menu, MenuItem } from "./Menu";
import { focusRing, interactive } from "../state-layer";

/**
 * M3 text fields — https://m3.material.io/components/text-fields
 *
 * Two variants, and the choice is about the surface the field sits on, not
 * taste:
 *
 *   filled    the default. A `surface-container-highest` fill. Reads as a
 *             field on a plain page without adding a box.
 *   outlined  the quieter one, `surface-container-high` — for a field on a
 *             card, where the loudest fill would shout.
 *
 * 🔴 Neither draws a line (law 11). M3's bottom active indicator and 1dp
 * outline are both gone; the fill is the field and the focus ring is focus.
 *
 * Shape (recorded per law §2.3): `small` all round on both — the top-corners-
 * only shape existed to give the bottom indicator a square foot, and there is
 * no indicator now.
 *
 * The label floats. It is driven by `:placeholder-shown`, not by React state,
 * so a field that is filled by the browser's autofill or by a password manager
 * floats its label too — a `useState` version does not, and that is the bug
 * every hand-rolled floating label ships with.
 */

/** The `peer` selectors that float the label. One string, used by both variants. */
const FLOAT =
    "pointer-events-none absolute left-4 z-[1] origin-left text-on-surface-variant " +
    "transition-[transform,color] duration-short4 ease-standard " +
    /* resting: centred in the field, at body-lg */
    "top-1/2 -translate-y-1/2 text-body-lg " +
    /* floated: small, at the top. Both when focused and when it has a value. */
    "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-body-sm peer-focus:text-primary " +
    "peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-body-sm " +
    "peer-disabled:opacity-[0.38] " +
    "peer-aria-[invalid=true]:text-error";

/**
 * Filled (2026-10-09): a soft grey box with an 8px corner, no underline. On
 * focus it turns white, takes a 1px blue edge and a faint blue halo - the
 * focus every pro tool uses. Invalid = the same in `error`.
 */
const FILLED =
    "peer w-full min-w-0 rounded-small bg-surface-container text-body-lg text-on-surface caret-primary " +
    "shadow-[inset_0_0_0_1px_transparent] " +
    "transition-[box-shadow,background-color] duration-short4 ease-standard " +
    "[@media(hover:hover)]:hover:bg-surface-container-high " +
    "outline-none focus:bg-surface-container-lowest focus:hover:bg-surface-container-lowest dark:focus:bg-surface-container-low dark:focus:hover:bg-surface-container-low focus:shadow-[inset_0_0_0_1px_var(--md-sys-color-primary),0_0_0_3px_rgb(var(--md-sys-color-primary-rgb)/0.18)] " +
    "aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--md-sys-color-error),0_0_0_3px_rgb(var(--md-sys-color-error-rgb)/0.14)] " +
    "disabled:bg-on-surface/[0.04] disabled:text-on-surface/[0.38] disabled:cursor-not-allowed";

/**
 * Outlined: the same box with a hairline edge instead of a fill. For a field
 * on a card or a sheet, where a second fill would stack on the first.
 */
const OUTLINED =
    "peer w-full min-w-0 rounded-small bg-surface-container-lowest text-body-lg text-on-surface caret-primary dark:bg-surface-container-low " +
    "shadow-[inset_0_0_0_1px_rgb(var(--md-sys-color-on-surface-rgb)/0.16)] " +
    "transition-[box-shadow] duration-short4 ease-standard " +
    "[@media(hover:hover)]:hover:shadow-[inset_0_0_0_1px_rgb(var(--md-sys-color-on-surface-rgb)/0.32)] " +
    "outline-none focus:shadow-[inset_0_0_0_1px_var(--md-sys-color-primary),0_0_0_3px_rgb(var(--md-sys-color-primary-rgb)/0.18)] focus:hover:shadow-[inset_0_0_0_1px_var(--md-sys-color-primary),0_0_0_3px_rgb(var(--md-sys-color-primary-rgb)/0.18)] " +
    "aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--md-sys-color-error),0_0_0_3px_rgb(var(--md-sys-color-error-rgb)/0.14)] " +
    "disabled:text-on-surface/[0.38] disabled:shadow-[inset_0_0_0_1px_rgb(var(--md-sys-color-on-surface-rgb)/0.08)] disabled:cursor-not-allowed";

/**
 * The two M3 field boxes as classes, for a bare `<input>` that has no label
 * to float (the legacy `@/components/ui/input` wrapper, a search box inside
 * a toolbar). Anything with a label uses `TextField`.
 */
export const fieldStyles = { filled: FILLED, outlined: OUTLINED } as const;

export type TextFieldVariant = "filled" | "outlined";

export type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "size" | "placeholder"> & {
    /** The floating label. Required — M3 fields are never unlabelled. */
    label: string;
    variant?: TextFieldVariant;
    /** Shown under the field. Becomes the error message when `error` is set. */
    hint?: ReactNode;
    /** Say what went wrong AND what to do next. */
    error?: ReactNode;
    /** Leading icon inside the field. */
    icon?: IconGlyph;
    /** Trailing icon or small control (a clear button, a unit, a reveal toggle). */
    trailing?: ReactNode;
    /** A fixed prefix or suffix, e.g. "$" or "/month". Never a placeholder. */
    prefix?: string;
    suffix?: string;
    /** Shows "12 / 80" under the field and sets `maxLength`. */
    counter?: number;
    /** 48dp instead of 56dp — for toolbars and dense tables, not for forms. */
    dense?: boolean;
    className?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
    { label, variant = "filled", hint, error, icon, trailing, prefix, suffix, counter, dense, className, value, defaultValue, onChange, ...rest },
    ref,
) {
    const field = useFieldState();
    const uid = useId();
    const id = rest.id ?? field?.id ?? `tf-${uid}`;
    const msgId = error || hint || counter ? `${id}-msg` : undefined;
    const invalid = rest["aria-invalid"] ?? (error ? true : field?.invalid) ?? undefined;

    /* The counter is the only thing here that needs to know the length, and an
       uncontrolled field has to be measured from the DOM to show it. */
    const [len, setLen] = useState(String(value ?? defaultValue ?? "").length);

    return (
        <div className={cn("flex min-w-0 flex-col", className)}>
            <div className="relative flex min-w-0 items-center">
                {icon ? (
                    <Icon icon={icon} size="md" className="pointer-events-none absolute left-3 z-[1] text-on-surface-variant" />
                ) : null}
                <input
                    ref={ref}
                    /* A single space, never a real placeholder: it is what makes
                       `:placeholder-shown` mean "empty" and float the label. */
                    placeholder=" "
                    id={id}
                    value={value}
                    defaultValue={defaultValue}
                    maxLength={counter ?? rest.maxLength}
                    aria-describedby={rest["aria-describedby"] ?? msgId ?? field?.describedBy}
                    aria-invalid={invalid}
                    required={rest.required ?? field?.required}
                    disabled={rest.disabled ?? field?.disabled}
                    onChange={e => {
                        if (counter) setLen(e.currentTarget.value.length);
                        onChange?.(e);
                    }}
                    className={cn(
                        variant === "filled" ? FILLED : OUTLINED,
                        dense ? "h-12" : "h-14",
                        /* Room for the floated label above the text. */
                        variant === "filled" ? "px-4 pb-2 pt-6" : "px-4 pt-2",
                        icon && "pl-12",
                        (trailing || suffix) && "pr-12",
                        prefix && "pl-8",
                    )}
                    {...rest}
                />
                <label
                    htmlFor={id}
                    className={cn(
                        FLOAT,
                        icon && "left-12",
                    )}
                >
                    {label}
                </label>
                {prefix ? (
                    <span aria-hidden className="pointer-events-none absolute left-4 z-[1] text-body-lg text-on-surface-variant opacity-0 peer-focus:opacity-100 peer-[:not(:placeholder-shown)]:opacity-100">
                        {prefix}
                    </span>
                ) : null}
                {trailing ? <span className="absolute right-2 z-[1] flex items-center">{trailing}</span> : null}
                {suffix && !trailing ? (
                    <span aria-hidden className="pointer-events-none absolute right-4 z-[1] text-body-lg text-on-surface-variant">
                        {suffix}
                    </span>
                ) : null}
            </div>

            {error || hint || counter ? (
                <div className="flex items-start justify-between gap-4">
                    {error ? (
                        <SupportingText id={msgId} error>
                            {error}
                        </SupportingText>
                    ) : hint ? (
                        <SupportingText id={msgId}>{hint}</SupportingText>
                    ) : (
                        <span />
                    )}
                    {counter ? (
                        <span className="shrink-0 px-4 pt-1 text-body-sm text-on-surface-variant tnum">
                            {len} / {counter}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
});

/* ── Textarea ─────────────────────────────────────────────────────────── */

export type TextareaProps = Omit<ComponentPropsWithoutRef<"textarea">, "placeholder"> & {
    label: string;
    variant?: TextFieldVariant;
    hint?: ReactNode;
    error?: ReactNode;
    /** Grows with the text up to `maxHeight` px, then scrolls. */
    autoResize?: boolean;
    maxHeight?: number;
    className?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { label, variant = "outlined", hint, error, autoResize, maxHeight = 240, className, onInput, rows = 3, ...rest },
    ref,
) {
    const field = useFieldState();
    const uid = useId();
    const id = rest.id ?? field?.id ?? `ta-${uid}`;
    const msgId = error || hint ? `${id}-msg` : undefined;
    const inner = useRef<HTMLTextAreaElement | null>(null);

    const fit = (el: HTMLTextAreaElement | null) => {
        if (!el || !autoResize) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    };
    /* Fit once for a value that arrived with the page, not just on typing. */
    useEffect(() => fit(inner.current), [autoResize, maxHeight, rest.value, rest.defaultValue]);

    return (
        <div className={cn("flex min-w-0 flex-col", className)}>
            <div className="relative flex min-w-0">
                <textarea
                    ref={node => {
                        inner.current = node;
                        if (typeof ref === "function") ref(node);
                        else if (ref) ref.current = node;
                    }}
                    placeholder=" "
                    rows={rows}
                    id={id}
                    aria-describedby={rest["aria-describedby"] ?? msgId ?? field?.describedBy}
                    aria-invalid={rest["aria-invalid"] ?? (error ? true : field?.invalid) ?? undefined}
                    required={rest.required ?? field?.required}
                    disabled={rest.disabled ?? field?.disabled}
                    onInput={e => {
                        fit(e.currentTarget);
                        onInput?.(e);
                    }}
                    className={cn(
                        variant === "filled" ? FILLED : OUTLINED,
                        "resize-y px-4 pb-3 pt-6 leading-6",
                        autoResize && "resize-none",
                    )}
                    {...rest}
                />
                <label
                    htmlFor={id}
                    className={cn(
                        "pointer-events-none absolute left-4 top-4 z-[1] origin-left text-body-lg text-on-surface-variant",
                        "transition-[transform,color] duration-short4 ease-standard",
                        "peer-focus:top-2 peer-focus:text-body-sm peer-focus:text-primary",
                        "peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-body-sm",
                        "peer-disabled:opacity-[0.38] peer-aria-[invalid=true]:text-error",
                    )}
                >
                    {label}
                </label>
            </div>
            {error ? (
                <SupportingText id={msgId} error>
                    {error}
                </SupportingText>
            ) : hint ? (
                <SupportingText id={msgId}>{hint}</SupportingText>
            ) : null}
        </div>
    );
});

/* ── Select ───────────────────────────────────────────────────────────── */

export type SelectProps = Omit<ComponentPropsWithoutRef<"select">, "size"> & {
    label: string;
    variant?: TextFieldVariant;
    hint?: ReactNode;
    error?: ReactNode;
    dense?: boolean;
    className?: string;
};

/**
 * A value picked from `Menu` — the same floating list every other dropdown
 * in the app uses, so a select looks and opens the
 * same way on a laptop as on a phone. Was the browser's own `<select>`;
 * owner reversed that 2026-09-22 — every dropdown, every device, one look.
 *
 * Takes `<option>` children so no call site had to change: value defaults to
 * `value`/`children` text the same way a native option does, and `onChange`
 * still gets a `{ target: { value } }` event.
 *
 * The label does not float here: a select always has a value, so it would be
 * floated from the first paint anyway. It sits above, small, permanently.
 */
export const Select = function Select(
    { label, variant = "filled", hint, error, dense, className, children, value, onChange, disabled, id: idProp, "aria-describedby": describedBy, "aria-invalid": invalidProp }: SelectProps,
) {
    const field = useFieldState();
    const uid = useId();
    const id = idProp ?? field?.id ?? `sel-${uid}`;
    const msgId = error || hint ? `${id}-msg` : undefined;
    const isDisabled = disabled ?? field?.disabled;

    const options = Children.toArray(children)
        .filter((c): c is ReactElement<{ value?: string; disabled?: boolean; children?: ReactNode }> => isValidElement(c) && c.type === "option")
        .map((c) => ({
            value: c.props.value !== undefined ? String(c.props.value) : String(c.props.children ?? ""),
            label: c.props.children,
            disabled: c.props.disabled,
        }));
    const current = options.find((o) => o.value === value) ?? options[0];

    return (
        <div className={cn("flex min-w-0 flex-col", className)}>
            <Menu
                label={label}
                trigger={(p) => (
                    <div className="relative flex min-w-0 items-center">
                        <button
                            {...p}
                            type="button"
                            id={id}
                            disabled={isDisabled}
                            aria-describedby={describedBy ?? msgId ?? field?.describedBy}
                            aria-invalid={invalidProp ?? (error ? true : field?.invalid) ?? undefined}
                            className={cn(
                                variant === "filled" ? FILLED : OUTLINED,
                                dense ? "h-12 pt-5" : "h-14 pt-6",
                                "w-full text-left cursor-pointer pb-2 pl-4 pr-10",
                            )}
                        >
                            <span className="block truncate">{current?.label}</span>
                        </button>
                        <span aria-hidden className={cn("pointer-events-none absolute left-4 z-[1] text-body-sm text-on-surface-variant", dense ? "top-1" : "top-2")}>
                            {label}
                        </span>
                        <Icon icon={ChevronDown} size="md" className="pointer-events-none absolute right-3 text-on-surface-variant" />
                    </div>
                )}
            >
                {options.map((o) => (
                    <MenuItem
                        key={o.value}
                        checked={o.value === current?.value}
                        disabled={o.disabled}
                        onSelect={() => onChange?.({ target: { value: o.value } } as unknown as ChangeEvent<HTMLSelectElement>)}
                    >
                        {o.label}
                    </MenuItem>
                ))}
            </Menu>
            {error ? (
                <SupportingText id={msgId} error>
                    {error}
                </SupportingText>
            ) : hint ? (
                <SupportingText id={msgId}>{hint}</SupportingText>
            ) : null}
        </div>
    );
};

/* ── Search ───────────────────────────────────────────────────────────── */

export type SearchProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "size"> & {
    /** What is being searched, e.g. "Search agents". It is the field's name. */
    label: string;
    /** Shows a clear button when there is text. */
    onClear?: () => void;
    className?: string;
};

/**
 * M3 search bar — https://m3.material.io/components/search
 *
 * A `full`-cornered `surface-container-high` bar, not a text field. It is
 * `type="search"`, so the browser gives Escape-to-clear and the right keyboard
 * on a phone for free.
 */
export const Search = forwardRef<HTMLInputElement, SearchProps>(function Search({ label, onClear, className, value, ...rest }, ref) {
    const uid = useId();
    const id = rest.id ?? `search-${uid}`;
    return (
        <div className={cn("relative flex min-w-0 items-center", className)}>
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <Icon icon={SearchIcon} size="sm" className="pointer-events-none absolute left-3.5 text-on-surface-variant" />
            <input
                ref={ref}
                id={id}
                type="search"
                value={value}
                placeholder={label}
                className={cn(
                    "h-11 w-full min-w-0 rounded-small bg-surface-container pl-11 pr-11 text-body-lg text-on-surface",
                    "placeholder:text-on-surface-variant",
                    "transition-[background-color,box-shadow] duration-short4 ease-standard",
                    "hover:bg-surface-container-high",
                    /* Focus: the same white box, blue edge and halo as every field. */
                    "outline-none focus:bg-surface-container-lowest dark:focus:bg-surface-container-low focus:shadow-[inset_0_0_0_1px_var(--md-sys-color-primary),0_0_0_3px_rgb(var(--md-sys-color-primary-rgb)/0.18)]",
                    /* The browser's own clear X would be a second one. */
                    "[&::-webkit-search-cancel-button]:appearance-none",
                )}
                {...rest}
            />
            {onClear && value ? (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label={`Clear ${label.toLowerCase()}`}
                    className={cn(
                        "absolute right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-small text-on-surface-variant before:absolute before:left-1/2 before:top-1/2 before:h-touch before:w-touch before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
                        interactive(),
                    )}
                >
                    <Icon icon={X} size="md" />
                </button>
            ) : null}
        </div>
    );
});

/* ── Colour field ─────────────────────────────────────────────────────── */

export type ColorFieldProps = {
    /** What the colour is for, e.g. "Background colour". Never unlabelled. */
    label: string;
    /** An upper-case `#RRGGBB`. */
    value: string;
    /** Every step of a drag. */
    onChange: (hex: string) => void;
    /** Once, when the picker closes on a new colour. */
    onCommit?: (hex: string) => void;
    /** The picture's own colours, shown first in the picker. */
    swatches?: string[];
    /** Shown under the swatch. Keep it to a few words. */
    hint?: ReactNode;
    className?: string;
};

/**
 * Pick any colour: the colour as a circle, and a tap opens our picker
 * (ColorPicker.tsx) - square, hue, hex, eyedropper, palettes.
 *
 * 🔴 Not the browser's `<input type="color">` any more (owner, 2026-10-04):
 * its popup is an OS window, so a sheet around it closed the moment a finger
 * touched its slider. The whole control is the button, so the tap target is the
 * control, not a 20px chip inside it.
 *
 * The value is a colour a person chose - content, not a design token - so it
 * is the one place a raw hex legitimately lives.
 */
export function ColorField({ label, value, onChange, onCommit, swatches, hint, className }: ColorFieldProps) {
    const uid = useId();
    return (
        <ColorPopover
            label={label}
            value={value}
            onChange={(hex) => onChange(hex.toUpperCase())}
            onCommit={onCommit ? (hex) => onCommit(hex.toUpperCase()) : undefined}
            swatches={swatches}
            trigger={(p) => (
                <button
                    type="button"
                    {...p}
                    aria-label={`${label}: ${value.toUpperCase()}`}
                    aria-describedby={hint ? `cf-${uid}-msg` : undefined}
                    className={cn("relative flex min-h-touch min-w-0 flex-col items-center justify-center gap-1", focusRing, className)}
                >
                    <span aria-hidden className="h-6 w-6 rounded-full shadow-level-1" style={{ backgroundColor: value }} />
                    <span className="text-label-sm font-medium text-on-surface-variant">{label}</span>
                    {hint ? <SupportingText id={`cf-${uid}-msg`}>{hint}</SupportingText> : null}
                </button>
            )}
        />
    );
}

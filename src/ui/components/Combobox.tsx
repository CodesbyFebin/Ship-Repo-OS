"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../cn";
import { Icon, type IconGlyph } from "../primitives/Icon";
import { Check, ChevronDown, Plus, X } from "../symbols";
import { fuzzy } from "./CommandMenu";

export type Option = { value: string; label: string; description?: string; icon?: IconGlyph };

type ListProps = {
    id: string;
    options: Option[];
    active: number;
    selected: (v: string) => boolean;
    onPick: (o: Option) => void;
    onHover: (i: number) => void;
    empty: string;
    create?: string | null;
    multi?: boolean;
};

/** The dropdown both pickers share. Clicks never steal focus from the field. */
function List({ id, options, active, selected, onPick, onHover, empty, create, multi }: ListProps) {
    return (
        <ul
            id={id}
            role="listbox"
            aria-multiselectable={multi || undefined}
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-medium bg-surface-container-lowest p-1.5 shadow-level-3 dark:bg-surface-container-high"
        >
            {options.map((o, i) => (
                <li
                    key={o.value}
                    id={`${id}-${i}`}
                    role="option"
                    aria-selected={selected(o.value)}
                    onMouseMove={() => onHover(i)}
                    onClick={() => onPick(o)}
                    className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-small px-3 text-body-md text-on-surface", i === active && "bg-on-surface/[0.08]")}
                >
                    {o.icon ? <Icon icon={o.icon} className="text-on-surface-variant" /> : null}
                    <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.label}</span>
                        {o.description ? <span className="block truncate text-label-md text-on-surface-variant">{o.description}</span> : null}
                    </span>
                    {selected(o.value) ? <Icon icon={Check} className="text-on-surface" /> : null}
                </li>
            ))}
            {create ? (
                <li
                    id={`${id}-${options.length}`}
                    role="option"
                    aria-selected={false}
                    onMouseMove={() => onHover(options.length)}
                    onClick={() => onPick({ value: create, label: create })}
                    className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-small px-3 text-body-md text-on-surface", active === options.length && "bg-on-surface/[0.08]")}
                >
                    <Icon icon={Plus} className="text-on-surface-variant" />
                    Add “{create}”
                </li>
            ) : null}
            {!options.length && !create ? <li className="px-3 py-3 text-body-md text-on-surface-variant">{empty}</li> : null}
        </ul>
    );
}

/** Typing, open state, the highlighted row and the keys, for both pickers. */
function usePicker(options: Option[], creatable: boolean, has: (v: string) => boolean) {
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const shown = useMemo(
        () => (q ? options.map((o) => ({ o, s: Math.max(fuzzy(q, o.label), fuzzy(q, o.value)) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.o) : options),
        [options, q],
    );
    const create = creatable && q.trim() && !options.some((o) => o.label.toLowerCase() === q.trim().toLowerCase()) && !has(q.trim()) ? q.trim() : null;
    const count = shown.length + (create ? 1 : 0);
    return { q, setQ, open, setOpen, active, setActive, shown, create, count };
}

const FIELD = "relative flex min-h-14 w-full min-w-0 flex-wrap items-center gap-1.5 rounded-small bg-surface-container px-3 py-2 hover:bg-surface-container-high focus-within:bg-surface-container-lowest focus-within:shadow-[inset_0_0_0_1px_var(--md-sys-color-primary),0_0_0_3px_rgb(var(--md-sys-color-primary-rgb)/0.18)] dark:focus-within:bg-surface-container-low";

export type MultiSelectProps = {
    label: string;
    options: Option[];
    value: string[];
    onChange: (value: string[]) => void;
    /** Let people add a value that isn't in the list (tags). */
    creatable?: boolean;
    max?: number;
    hint?: ReactNode;
    empty?: string;
    /** Sends each value as a hidden field with this name. */
    name?: string;
    className?: string;
};

/**
 * Pick several: chips in the field, a filtered list under it. Backspace in an
 * empty field removes the last chip; Enter picks the highlighted row.
 */
export function MultiSelect({ label, options, value, onChange, creatable, max, hint, empty = "No matches.", name, className }: MultiSelectProps) {
    const uid = useId();
    const input = useRef<HTMLInputElement>(null);
    const has = (v: string) => value.includes(v);
    const p = usePicker(options, Boolean(creatable), has);
    const full = max !== undefined && value.length >= max;
    const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

    const toggle = (o: Option) => {
        if (has(o.value)) onChange(value.filter((v) => v !== o.value));
        else if (!full) onChange([...value, o.value]);
        p.setQ("");
        input.current?.focus();
    };
    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") { e.preventDefault(); p.setOpen(true); p.setActive((a) => Math.min(a + 1, p.count - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); p.setActive((a) => Math.max(a - 1, 0)); }
        else if (e.key === "Enter" && p.open && p.count) {
            e.preventDefault();
            toggle(p.active < p.shown.length ? p.shown[p.active] : { value: p.create!, label: p.create! });
        } else if (e.key === "Backspace" && !p.q && value.length) onChange(value.slice(0, -1));
        else if (e.key === "Escape") p.setOpen(false);
    };

    return (
        <div className={cn("flex min-w-0 flex-col gap-1", className)}>
            <label htmlFor={uid} className="px-1 text-label-md text-on-surface-variant">{label}</label>
            <div className={FIELD} onClick={() => input.current?.focus()}>
                {value.map((v) => (
                    <span key={v} className="inline-flex h-8 max-w-full items-center gap-1 rounded-small bg-on-surface/[0.07] pl-2.5 pr-1 text-label-lg text-on-surface">
                        <span className="truncate">{labelOf(v)}</span>
                        <button type="button" aria-label={`Remove ${labelOf(v)}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }} className="inline-flex h-6 w-6 items-center justify-center rounded-extra-small hover:bg-on-surface/[0.08]">
                            <Icon icon={X} size="sm" />
                        </button>
                    </span>
                ))}
                <input
                    ref={input}
                    id={uid}
                    value={p.q}
                    disabled={full}
                    placeholder={full ? `Up to ${max}` : value.length ? "" : "Type to search"}
                    onChange={(e) => { p.setQ(e.target.value); p.setOpen(true); p.setActive(0); }}
                    onFocus={() => p.setOpen(true)}
                    onBlur={() => p.setOpen(false)}
                    onKeyDown={onKey}
                    role="combobox"
                    aria-expanded={p.open}
                    aria-controls={`${uid}-list`}
                    aria-activedescendant={p.open && p.count ? `${uid}-list-${p.active}` : undefined}
                    className="h-8 min-w-[6rem] flex-1 bg-transparent text-body-lg text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                {p.open && !full ? (
                    <List id={`${uid}-list`} options={p.shown} active={p.active} selected={has} onPick={toggle} onHover={p.setActive} empty={empty} create={p.create} multi />
                ) : null}
            </div>
            {hint ? <p className="px-1 text-body-sm text-on-surface-variant">{hint}</p> : null}
            {name ? value.map((v) => <input key={v} type="hidden" name={name} value={v} />) : null}
        </div>
    );
}

export type ComboboxProps = Omit<MultiSelectProps, "value" | "onChange" | "max"> & {
    value: string | null;
    onChange: (value: string | null) => void;
};

/** Pick one from a long list by typing: a country, a timezone, a member. */
export function Combobox({ label, options, value, onChange, creatable, hint, empty = "No matches.", name, className }: ComboboxProps) {
    const uid = useId();
    const has = (v: string) => v === value;
    const p = usePicker(options, Boolean(creatable), has);
    const current = options.find((o) => o.value === value)?.label ?? value ?? "";

    const pick = (o: Option) => { onChange(o.value); p.setQ(""); p.setOpen(false); };
    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") { e.preventDefault(); p.setOpen(true); p.setActive((a) => Math.min(a + 1, p.count - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); p.setActive((a) => Math.max(a - 1, 0)); }
        else if (e.key === "Enter" && p.open && p.count) { e.preventDefault(); pick(p.active < p.shown.length ? p.shown[p.active] : { value: p.create!, label: p.create! }); }
        else if (e.key === "Escape") { p.setOpen(false); p.setQ(""); }
    };

    return (
        <div className={cn("flex min-w-0 flex-col gap-1", className)}>
            <label htmlFor={uid} className="px-1 text-label-md text-on-surface-variant">{label}</label>
            <div className={FIELD}>
                <input
                    id={uid}
                    value={p.open ? p.q : current}
                    placeholder={current || "Type to search"}
                    onChange={(e) => { p.setQ(e.target.value); p.setOpen(true); p.setActive(0); }}
                    onFocus={() => p.setOpen(true)}
                    onBlur={() => { p.setOpen(false); p.setQ(""); }}
                    onKeyDown={onKey}
                    role="combobox"
                    aria-expanded={p.open}
                    aria-controls={`${uid}-list`}
                    aria-activedescendant={p.open && p.count ? `${uid}-list-${p.active}` : undefined}
                    className="h-10 min-w-0 flex-1 bg-transparent text-body-lg text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                <Icon icon={ChevronDown} className="pointer-events-none text-on-surface-variant" />
                {p.open ? <List id={`${uid}-list`} options={p.shown} active={p.active} selected={has} onPick={pick} onHover={p.setActive} empty={empty} create={p.create} /> : null}
            </div>
            {hint ? <p className="px-1 text-body-sm text-on-surface-variant">{hint}</p> : null}
            {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
        </div>
    );
}

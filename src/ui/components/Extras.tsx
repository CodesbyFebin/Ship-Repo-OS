"use client";

import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../cn";
import { Icon, type IconGlyph } from "../primitives/Icon";
import { CountBadge } from "../primitives/Badge";
import { Bell, Check, ChevronDown, X } from "../symbols";
import { Popover } from "./Popover";
import { interactive } from "../state-layer";

/* ── Accordion ────────────────────────────────────────────────────────── */

export type AccordionItem = { id?: string; title: ReactNode; body: ReactNode };

/**
 * Questions that open in place: FAQs, "details". Built on <details>, so it
 * works before the page wakes up, finds-in-page opens the right one, and a
 * `name` makes them close each other (one open at a time).
 */
export function Accordion({ items, single, className }: { items: AccordionItem[]; single?: boolean; className?: string }) {
    const group = useId();
    return (
        <div className={cn("flex min-w-0 flex-col divide-y divide-outline-variant rounded-medium bg-surface-container", className)}>
            {items.map((it, i) => (
                <details key={it.id ?? i} id={it.id} name={single ? group : undefined} className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-title-sm text-on-surface marker:hidden [&::-webkit-details-marker]:hidden">
                        {it.title}
                        <Icon icon={ChevronDown} className="shrink-0 text-on-surface-variant transition-transform duration-short4 group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 text-body-md text-on-surface-variant">{it.body}</div>
                </details>
            ))}
        </div>
    );
}

/* ── Steps ────────────────────────────────────────────────────────────── */

/** Where someone is in a few steps: sign-up, onboarding, checkout. Done steps get a tick. */
export function Steps({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
    return (
        <ol className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2", className)}>
            {steps.map((s, i) => {
                const done = i < current, now = i === current;
                return (
                    <li key={s} aria-current={now ? "step" : undefined} className="flex items-center gap-2">
                        <span className={cn("flex h-7 w-7 items-center justify-center text-label-lg tnum", done || now ? "bg-primary text-on-primary" : "bg-surface-container-highest text-on-surface-variant")}>
                            {done ? <Icon icon={Check} size="sm" /> : i + 1}
                        </span>
                        <span className={cn("text-label-lg", now ? "text-on-surface" : "text-on-surface-variant")}>{s}</span>
                        {i < steps.length - 1 ? <span aria-hidden className="hidden h-px w-8 bg-outline-variant medium:block" /> : null}
                    </li>
                );
            })}
        </ol>
    );
}

/* ── Code input ───────────────────────────────────────────────────────── */

export type CodeInputProps = {
    label: string;
    length?: number;
    value: string;
    onChange: (code: string) => void;
    /** Called once every box is filled. */
    onComplete?: (code: string) => void;
    error?: ReactNode;
    autoFocus?: boolean;
    className?: string;
};

/**
 * One box per digit: sign-in codes, two-step codes. Typing moves on,
 * Backspace moves back, pasting "123456" fills them all, and the phone's
 * "fill code from messages" works (autocomplete="one-time-code").
 */
export function CodeInput({ label, length = 6, value, onChange, onComplete, error, autoFocus, className }: CodeInputProps) {
    const boxes = useRef<(HTMLInputElement | null)[]>([]);
    const set = (next: string) => {
        const clean = next.replace(/\D/g, "").slice(0, length);
        onChange(clean);
        if (clean.length === length) onComplete?.(clean);
        boxes.current[Math.min(clean.length, length - 1)]?.focus();
    };
    const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !value[i] && i > 0) { e.preventDefault(); onChange(value.slice(0, i - 1)); boxes.current[i - 1]?.focus(); }
        if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
        if (e.key === "ArrowRight" && i < length - 1) boxes.current[i + 1]?.focus();
    };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); set(e.clipboardData.getData("text")); };
    return (
        <fieldset className={cn("flex min-w-0 flex-col gap-2", className)}>
            <legend className="mb-2 text-label-md text-on-surface-variant">{label}</legend>
            <div className="flex gap-2" onPaste={onPaste}>
                {Array.from({ length }, (_, i) => (
                    <input
                        key={i}
                        ref={(el) => { boxes.current[i] = el; }}
                        aria-label={`Digit ${i + 1} of ${length}`}
                        inputMode="numeric"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        autoFocus={autoFocus && i === 0}
                        maxLength={i === 0 ? length : 1}
                        value={value[i] ?? ""}
                        aria-invalid={error ? true : undefined}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                            const d = e.target.value.replace(/\D/g, "");
                            if (d.length > 1) return set(value.slice(0, i) + d);
                            set((value.slice(0, i) + d + value.slice(i + 1)).slice(0, length));
                            if (d && i < length - 1) boxes.current[i + 1]?.focus();
                        }}
                        onKeyDown={(e) => onKey(i, e)}
                        className={cn(
                            "h-14 w-11 min-w-0 rounded-small bg-surface-container text-center text-title-lg tnum text-on-surface outline-none medium:w-12",
                            "focus:bg-surface-container-lowest focus:shadow-[inset_0_0_0_2px_var(--md-sys-color-primary)] dark:focus:bg-surface-container-low",
                            error && "shadow-[inset_0_0_0_2px_var(--md-sys-color-error)]",
                        )}
                    />
                ))}
            </div>
            {error ? <p role="alert" className="text-body-sm text-error">{error}</p> : null}
        </fieldset>
    );
}

/* ── Banner ───────────────────────────────────────────────────────────── */

/** A line across the top of the page: a launch, an outage, a sale. Dismissable. */
export function Banner({ children, action, onClose, tone = "ink", className }: { children: ReactNode; action?: ReactNode; onClose?: () => void; tone?: "ink" | "soft"; className?: string }) {
    const [gone, setGone] = useState(false);
    if (gone) return null;
    return (
        <div role="region" aria-label="Announcement" className={cn("flex min-h-12 items-center gap-3 px-4 py-2 text-body-md", tone === "ink" ? "kit-inverse" : "bg-secondary-container text-on-secondary-container", className)}>
            <p className="min-w-0 flex-1 text-center">{children}</p>
            {action}
            {onClose ? (
                <button type="button" aria-label="Close" onClick={() => { setGone(true); onClose(); }} className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-small", interactive())}>
                    <Icon icon={X} />
                </button>
            ) : null}
        </div>
    );
}

/* ── Notifications ────────────────────────────────────────────────────── */

export type NotificationItem = { id: string; title: ReactNode; body?: ReactNode; at: string; read?: boolean; icon?: IconGlyph; href?: string };

/** The bell in an app bar: a count, and a list that opens under it. */
export function NotificationBell({ items, onReadAll, empty = "Nothing new." }: { items: NotificationItem[]; onReadAll?: () => void; empty?: string }) {
    const unread = items.filter((n) => !n.read).length;
    return (
        <Popover
            label="Notifications"
            placement="bottom-end"
            className="w-[min(22rem,calc(100vw-1rem))] max-w-none p-0"
            trigger={(p) => (
                <button {...p} type="button" aria-label={unread ? `Notifications, ${unread} new` : "Notifications"} className={cn("relative inline-flex h-10 w-10 items-center justify-center rounded-small text-on-surface", interactive())}>
                    <Icon icon={Bell} />
                    {unread ? <CountBadge count={unread} label={`${unread} new`} className="absolute -right-0.5 -top-0.5" /> : null}
                </button>
            )}
        >
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <p className="text-title-sm text-on-surface">Notifications</p>
                {unread && onReadAll ? <button type="button" onClick={onReadAll} className={cn("rounded-small px-2 py-1 text-label-lg text-on-surface", interactive())}>Mark all read</button> : null}
            </div>
            {!items.length ? <p className="px-4 pb-6 pt-2 text-body-md text-on-surface-variant">{empty}</p> : (
                <ul className="max-h-96 overflow-y-auto pb-2">
                    {items.map((n) => {
                        const inner = (
                            <>
                                <span aria-hidden className={cn("mt-2 h-2 w-2 shrink-0", n.read ? "bg-transparent" : "bg-primary")} />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-body-md text-on-surface">{n.title}</span>
                                    {n.body ? <span className="block text-body-sm text-on-surface-variant">{n.body}</span> : null}
                                    <span className="block text-label-sm text-on-surface-variant">{n.at}</span>
                                </span>
                            </>
                        );
                        const cls = cn("flex gap-3 px-4 py-3 text-left", n.href && interactive());
                        return <li key={n.id}>{n.href ? <a href={n.href} className={cls}>{inner}</a> : <div className={cls}>{inner}</div>}</li>;
                    })}
                </ul>
            )}
        </Popover>
    );
}

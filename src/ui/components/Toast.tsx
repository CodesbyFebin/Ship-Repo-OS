"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Info, X, XCircle } from "../symbols";
import type { IconGlyph } from "../primitives/Icon";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { Spinner } from "../primitives/Progress";
import { interactive } from "../state-layer";

/**
 * M3 snackbar — https://m3.material.io/components/snackbar
 *
 * One brief message about something that just happened, at the foot of the
 * screen, on the prompt bar's own surface (owner, 2026-09-30: the inverse
 * surface was a white slab in dark mode). No tone colours: the same
 * surface every time, and the WORDS say whether it went well (§2.1 — colour
 * alone never carries meaning). The icon is there for scanning, not for
 * meaning.
 *
 * Use an `Alert` instead for a condition that persists, and a `Dialog` for
 * anything that needs a decision. A snackbar can be missed, so it is never
 * the only way to learn something.
 *
 * 🔴 The ONE notification on the site (owner, 2026-09-29): every page and
 * studio calls `toast()` from `@/ui` — no Sonner, no top-bar status chips.
 * Something still running ("Drawing 14 traits") is a snackbar with
 * `progress`: it stays, updates in place through `updateToast()`, and the ✕
 * closes it. The only other notice is the download card, top right.
 *
 * Shape (recorded per law §2.3): `extra-small`.
 */

export type ToastTone = "success" | "danger" | "warning" | "info";

export type ToastInput = {
    /** What happened, in the past tense: "Published", "Payment failed". */
    title: ReactNode;
    /** Optional detail, or what to do next when something failed. */
    description?: ReactNode;
    tone?: ToastTone;
    /** One button. Undo, Retry, View — never the only way to do the thing. */
    action?: { label: string; onClick: () => void };
    /** Milliseconds on screen. 0 keeps it until dismissed; use it for errors. */
    duration?: number;
    /**
     * Something still running. Shows a spinner (and a bar when `total` is
     * known) and stays until it is updated, dismissed or closed with ✕.
     */
    progress?: { done?: number; total?: number };
};

type ToastItem = ToastInput & { id: number };

/*
 * A tiny store instead of a context provider: `toast()` can then be called
 * from an event handler, a server-action result or a hook, without every
 * caller being inside a provider tree.
 */
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(items: ToastItem[]) => void>();
const emit = () => listeners.forEach(l => l(items));

/**
 * 🔴 Nothing mounted `<Snackbar>` outside /design-system, so every `toast()`
 * on the site went nowhere - saves, errors and Undo all silent (found
 * 2026-09-27). The root layout is off limits (PERFORMANCE_RULES.md rule 2), so
 * the first `toast()` mounts one itself, into its own node on <body>. A page
 * that never shows a snackbar pays nothing; `react-dom/client` is already in
 * every page's framework chunk.
 */
let selfMounted = false;
function ensureMounted() {
    if (selfMounted || listeners.size > 0 || typeof document === "undefined") return;
    selfMounted = true;
    void import("react-dom/client").then(({ createRoot }) => {
        const host = document.createElement("div");
        host.setAttribute("data-snackbar-host", "");
        document.body.appendChild(host);
        createRoot(host).render(<Snackbar />);
    });
}

/** Show a snackbar. Returns its id so it can be updated or dismissed early. */
export function toast(input: ToastInput) {
    ensureMounted();
    const item = { ...input, id: nextId++ };
    /* M3 shows one snackbar at a time. Three is already a log, and nobody
       reads a log that is covering the thing they are working on. Something
       still running is dropped last - it is the one that says "not done". */
    items = [...items, item];
    while (items.length > 3) {
        const old = items.findIndex(t => !t.progress);
        items = items.filter((_, i) => i !== (old === -1 ? 0 : old));
    }
    emit();
    return item.id;
}

/** Change a snackbar in place: new words, new count, or "done". False if it is gone. */
export function updateToast(id: number, patch: Partial<ToastInput>) {
    if (!items.some(t => t.id === id)) return false;
    items = items.map(t => (t.id === id ? { ...t, ...patch, id } : t));
    emit();
    return true;
}

export function dismissToast(id?: number) {
    items = id === undefined ? [] : items.filter(t => t.id !== id);
    emit();
}

type Short = Omit<ToastInput, "title" | "tone"> & {
    /** Replace this snackbar instead of adding one (a "Sending…" turning into "Sent"). */
    id?: number;
};
const short = (tone: ToastTone | undefined, extra?: Partial<ToastInput>) => (title: ReactNode, o: Short = {}) => {
    const { id, ...rest } = o;
    /* A settled message replaces a running one: drop the spinner and restart
       the clock (`duration` undefined = the tone's default). */
    const next: ToastInput = { progress: undefined, duration: undefined, ...extra, ...rest, title, tone };
    if (id !== undefined && updateToast(id, next)) return id;
    return toast(next);
};
/** `toast.success("Saved")` and friends — the short form most call sites need. */
toast.success = short("success");
toast.error = short("danger");
toast.warning = short("warning");
toast.info = short("info");
/** A spinner that stays until the same id gets `toast.success/error(…, { id })`. */
toast.loading = short("info", { progress: {} });
toast.dismiss = dismissToast;

const ICON: Record<ToastTone, IconGlyph> = {
    success: Check,
    danger: XCircle,
    warning: AlertTriangle,
    info: Info,
};

/**
 * Where snackbars appear. `toast()` mounts one on first use; mounting it
 * yourself (as /design-system does) is fine too - the first one wins.
 *
 * Bottom-centre on a phone (M3's position), bottom-left on wide windows so it
 * does not cover a FAB. Errors stay until dismissed; everything else leaves on
 * its own, and hovering pauses the clock.
 */
export function Snackbar() {
    const [list, setList] = useState<ToastItem[]>(items);
    useEffect(() => {
        listeners.add(setList);
        return () => {
            listeners.delete(setList);
        };
    }, []);

    return (
        <div
            aria-live="polite"
            aria-relevant="additions text"
            className={cn(
                "pointer-events-none fixed z-snackbar flex flex-col gap-2",
                /* Above a studio's prompt bar when there is one (ComposerDock
                   sets --ui-composer-h), so a running job never covers it. */
                "inset-x-2 bottom-[calc(max(env(safe-area-inset-bottom,0px),var(--ui-composer-h,0px))+0.5rem)]",
                "medium:inset-x-auto medium:bottom-[calc(var(--ui-composer-h,0px)+1.5rem)] medium:left-6 medium:w-[20rem]",
                /* With the side rail: just above the profile row, bottom left. `!` because
                   Tailwind emits the legacy `md` rules before `medium`. */
                "md:!bottom-[5.5rem] md:!left-3",
            )}
        >
            {list.map(t => (
                <SnackbarRow key={t.id} item={t} />
            ))}
        </div>
    );
}

/** The old name. Kept so a half-migrated layout still mounts it. */
export const Toaster = Snackbar;

function SnackbarRow({ item }: { item: ToastItem }) {
    const glyph = ICON[item.tone ?? "success"];
    const running = !!item.progress;
    const ms = running ? 0 : item.duration ?? (item.tone === "danger" ? 0 : 5000);
    const { done, total } = item.progress ?? {};
    const pct = total ? Math.max(0, Math.min(100, ((done ?? 0) / total) * 100)) : undefined;
    const [leaving, setLeaving] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const close = () => {
        setLeaving(true);
        setTimeout(() => dismissToast(item.id), 400);
    };

    const start = () => {
        if (!ms) return;
        timer.current = setTimeout(close, ms);
    };
    const stop = () => {
        if (timer.current) clearTimeout(timer.current);
    };

    /* Restarts when the snackbar changes: a running one that turns into
       "done" starts its clock then, not when it first appeared. */
    useEffect(() => {
        start();
        return stop;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ms, item.title]);

    return (
        <div
            role={item.tone === "danger" ? "alert" : "status"}
            data-leaving={leaving || undefined}
            onPointerEnter={stop}
            onPointerLeave={start}
            className={cn(
                "m3-snackbar pointer-events-auto flex items-start gap-2.5 rounded-small px-3 py-2.5 text-on-surface",
                "bg-surface-container-lowest shadow-level-2 dark:bg-surface-container-high dark:shadow-none",
            )}
        >
            {running ? <Spinner size="sm" className="mt-0.5" /> : <Icon icon={glyph} size="sm" className="mt-0.5 shrink-0 text-on-surface-variant" />}
            <div className="min-w-0 flex-1">
                <p className="text-body-sm">
                    {item.title}
                    {total ? <span className="tabular-nums opacity-80"> · {(done ?? 0).toLocaleString()} / {total.toLocaleString()}</span> : null}
                </p>
                {item.description ? <p className="mt-0.5 text-body-sm text-on-surface-variant">{item.description}</p> : null}
                {pct !== undefined ? (
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(pct)}
                        aria-label={typeof item.title === "string" ? item.title : "Progress"}
                        className="mt-2 h-1 overflow-hidden rounded-full bg-on-surface/10"
                    >
                        <div className="h-full rounded-full bg-primary transition-[width] duration-medium2" style={{ width: `${pct}%` }} />
                    </div>
                ) : null}
            </div>
            {item.action ? (
                <button
                    type="button"
                    onClick={() => {
                        item.action?.onClick();
                        // "View" on something still running leaves it on screen.
                        if (!running) close();
                    }}
                    className={cn(
                        "-my-1 shrink-0 rounded-extra-small px-2 py-1 text-label-lg text-primary",
                        interactive(),
                    )}
                >
                    {item.action.label}
                </button>
            ) : null}
            <button
                type="button"
                onClick={close}
                aria-label="Dismiss"
                className={cn(
                    "-my-1 -mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    "before:absolute before:left-1/2 before:top-1/2 before:h-touch before:w-touch before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
                    "text-on-surface-variant",
                    interactive(),
                )}
            >
                <Icon icon={X} size="sm" />
            </button>
        </div>
    );
}

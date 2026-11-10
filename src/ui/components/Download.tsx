"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AlertTriangle, Check, Download as DownloadGlyph, X } from "../symbols";
import { cn } from "../cn";
import { CHECKER_STYLE } from "../checker";
import { Icon } from "../primitives/Icon";
import { Progress } from "../primitives/Progress";
import { Button, IconButton } from "../primitives/Button";

/**
 * Every download on the site goes through here.
 *
 *   download({ name, preview, make })   the usual door: make the file, save it
 *   startDownload({ title })            a long job that reports its own steps (a collection ZIP)
 *   saveFile(blob, name)                a file already in hand
 *   <DownloadLink href download>        a plain link that downloads (works without JS too)
 *
 * A card drops in at the top right (full width at the top on a phone) with a
 * preview, a progress bar, then "Downloaded · 1.2 MB". It stays while it works,
 * leaves by itself once done, and keeps "Save again" until it goes.
 *
 * 🔴 Why not a plain <a download>: the page loading bar (nextjs-toploader)
 * starts on every link click and only stops when a page loads. A download
 * loads no page, so the bar crawled across the top and the save dialog
 * appeared with nothing else said. Files here are fetched first, then saved by
 * an anchor whose click never reaches the loader.
 *
 * Callers gate first (`guardDownload()`), then call these. `@/ui` knows
 * nothing about plans or the paywall.
 */

type Status = "working" | "done" | "failed" | "cancelled";

type Job = {
    id: number;
    title: string;
    preview?: string | null;
    count?: number;
    status: Status;
    /** 0–100, or undefined while the length is unknown. */
    value?: number;
    note?: string;
    file?: { url: string; name: string; size: number };
    retry?: () => void;
    cancel?: () => void;
};

export type DownloadJob = {
    /** Aborts with the card's Cancel. Pass it to every fetch the job makes. */
    signal: AbortSignal;
    /** `value` 0–100 (undefined = unknown length). `note` replaces the status line: "24 of 120". */
    progress: (value?: number, note?: string) => void;
    /** Saves the file now. A job may save several (a ZIP in parts). */
    save: (blob: Blob, name: string) => void;
    done: (note?: string) => void;
    fail: (message: string, retry?: () => void) => void;
    /** Stops it: aborts `signal` and the card says "Cancelled". The card's own X does this. */
    cancel: () => void;
    /** Takes the card away without a word (the caller opened a popup instead). */
    close: () => void;
};

/* A tiny store, like toast(): callable from any handler, no provider. */
let jobs: Job[] = [];
let nextId = 1;
const listeners = new Set<(jobs: Job[]) => void>();
const emit = () => listeners.forEach((l) => l(jobs));
const patch = (id: number, p: Partial<Job>) => {
    jobs = jobs.map((j) => (j.id === id ? { ...j, ...p } : j));
    emit();
};
function remove(id: number) {
    const j = jobs.find((x) => x.id === id);
    if (j?.file) setTimeout(() => URL.revokeObjectURL(j.file!.url), 1000);
    if (j?.preview?.startsWith("blob:")) URL.revokeObjectURL(j.preview);
    jobs = jobs.filter((x) => x.id !== id);
    emit();
}

/** The root layout is off limits (PERFORMANCE_RULES.md rule 2): the first download mounts its own host. */
let mounted = false;
function ensureMounted() {
    if (mounted || listeners.size > 0 || typeof document === "undefined") return;
    mounted = true;
    void import("react-dom/client").then(({ createRoot }) => {
        const host = document.createElement("div");
        host.setAttribute("data-download-host", "");
        document.body.appendChild(host);
        createRoot(host).render(<Downloads />);
    });
}

/** Hands a file to the browser's save flow. The click stops here, so the page loading bar never starts. */
function handOver(url: string, name: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    a.addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export function startDownload(o: { title: string; preview?: string | null; count?: number; note?: string }): DownloadJob {
    ensureMounted();
    const id = nextId++;
    const abort = new AbortController();
    /** Still on screen and still running: a cancelled job ignores late reports. */
    const alive = () => jobs.some((j) => j.id === id && j.status === "working");
    const cancel = () => {
        abort.abort();
        if (jobs.some((j) => j.id === id && j.status === "working")) patch(id, { status: "cancelled", cancel: undefined });
    };
    jobs = [{ id, title: o.title, preview: o.preview, count: o.count, note: o.note, status: "working" as Status, cancel }, ...jobs].slice(0, 4);
    emit();
    return {
        signal: abort.signal,
        cancel,
        progress: (value, note) => alive() && patch(id, { value, note }),
        save: (blob, name) => {
            const url = URL.createObjectURL(blob);
            handOver(url, name);
            const j = jobs.find((x) => x.id === id);
            if (!j) return void setTimeout(() => URL.revokeObjectURL(url), 5000);
            if (j.file) setTimeout(() => URL.revokeObjectURL(j.file!.url), 5000);
            // No preview given: a picture is its own preview.
            const preview = j.preview ?? (/^image\//.test(blob.type) ? URL.createObjectURL(blob) : null);
            patch(id, { file: { url, name, size: blob.size }, preview, title: j.count ? j.title : name });
        },
        done: (note) => alive() && patch(id, { status: "done", value: 100, note, cancel: undefined }),
        fail: (message, retry) => alive() && patch(id, { status: "failed", note: message, retry, cancel: undefined }),
        close: () => remove(id),
    };
}

/**
 * The usual door. `make` returns the file, or a URL to fetch it from (progress
 * comes from the download itself), or null to stop quietly. Resolves true once saved.
 */
export async function download(o: {
    name: string;
    title?: string;
    preview?: string | null;
    count?: number;
    /** The line shown once saved, instead of "Downloaded · 1.2 MB". */
    done?: string;
    make: (job: DownloadJob) => Promise<Blob | string | null> | Blob | string | null;
}): Promise<boolean> {
    const job = startDownload({ title: o.title ?? o.name, preview: o.preview, count: o.count });
    try {
        let out = await o.make(job);
        if (out === null) return job.close(), false;
        if (typeof out === "string") out = await fetchFile(out, job.progress, job.signal);
        if (job.signal.aborted) return false;
        job.save(out, o.name);
        job.done(o.done);
        return true;
    } catch (err) {
        if (!job.signal.aborted) job.fail(messageOf(err), () => void download(o));
        return false;
    }
}

/** A file already in hand: saved at once, with the same card. */
export function saveFile(blob: Blob, name: string, o: { title?: string; preview?: string | null } = {}) {
    const job = startDownload({ title: o.title ?? name, preview: o.preview });
    job.save(blob, name);
    job.done();
}

/** Fetches a file with real progress when the server says how big it is. */
export async function fetchFile(url: string, onProgress?: (value?: number, note?: string) => void, signal?: AbortSignal): Promise<Blob> {
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) {
        if (res.status === 402 || res.status === 401) throw new Error("Sign in to download this.");
        if (res.status === 404) throw new Error("This file is gone.");
        throw new Error("The file could not be made. Try again.");
    }
    const total = Number(res.headers.get("content-length")) || 0;
    if (!res.body || !total) return res.blob();
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let got = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        onProgress?.(Math.min(99, (got / total) * 100), `${mb(got)} of ${mb(total)}`);
    }
    return new Blob(parts as BlobPart[], { type: res.headers.get("content-type") || "" });
}

const messageOf = (err: unknown) => {
    const m = err instanceof Error ? err.message : "";
    return m && m.length < 120 && !/^(failed to fetch|load failed|networkerror)/i.test(m) ? m : "The download did not finish. Try again.";
};
const mb = (n: number) => (n < 1_048_576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1_048_576).toFixed(1)} MB`);
const nameFromUrl = (href: string) => decodeURIComponent(href.split(/[?#]/)[0].split("/").pop() || "file");

/** Downloads a link through the card. Menu rows and <DownloadLink> share it. */
export function downloadHrefClick(e: MouseEvent, href: string, name?: string | boolean, preview?: string | null) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // The native event only: React handlers above (a menu closing) still run,
    // but the page loading bar, listening on document, never hears the click.
    e.nativeEvent.stopPropagation();
    const file = typeof name === "string" && name ? name : nameFromUrl(href);
    void download({ name: file, preview, make: () => href });
}

/**
 * A link that downloads. Without JS it is a plain <a download>; with it, the
 * file comes through the card. For server pages (the brand kit).
 */
export function DownloadLink({ href, download: name, preview, className, children }: { href: string; download?: string; preview?: string | null; className?: string; children: ReactNode }) {
    return (
        <a href={href} download={name ?? true} className={className} onClick={(e) => downloadHrefClick(e, href, name, preview)}>
            {children}
        </a>
    );
}

/* ── The cards ───────────────────────────────────────────────────────── */

/*
 * 🔴 The cards live in the browser's top layer (a manual popover), because a
 * download is often started from inside something that is already there - a
 * Sheet (<dialog showModal>) - or from a legacy full-screen viewer at
 * z-[9999]. A z-index cannot climb above either. Each new job re-shows the
 * popover, which moves it to the top of the top layer; Sheet.tsx does the same
 * when a Sheet opens over it. Browsers without popovers get the z-index.
 */
const canPopover = typeof HTMLElement !== "undefined" && "showPopover" in HTMLElement.prototype;

export function Downloads() {
    const [list, setList] = useState<Job[]>(jobs);
    const layer = useRef<HTMLDivElement>(null);
    useEffect(() => {
        listeners.add(setList);
        setList(jobs);
        return () => void listeners.delete(setList);
    }, []);
    const newest = list[0]?.id;
    useEffect(() => {
        const el = layer.current;
        if (!el || !canPopover) return;
        if (el.matches(":popover-open")) el.hidePopover();
        if (newest !== undefined) el.showPopover();
    }, [newest]);
    return (
        <div
            ref={layer}
            data-download-layer=""
            popover={canPopover ? "manual" : undefined}
            aria-live="polite"
            className={cn(
                "m3-download-layer pointer-events-none fixed z-snackbar flex flex-col gap-2",
                "inset-x-2 top-[calc(env(safe-area-inset-top,0px)+0.5rem)]",
                "w-auto medium:inset-x-auto medium:right-4 medium:top-20 medium:w-[22rem]",
            )}
        >
            {list.map((j) => <Card key={j.id} job={j} />)}
        </div>
    );
}

function Card({ job }: { job: Job }) {
    const [leaving, setLeaving] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const close = () => {
        setLeaving(true);
        setTimeout(() => remove(job.id), 200);
    };
    const start = () => {
        if (job.status !== "done" && job.status !== "cancelled") return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(close, job.status === "done" ? 6000 : 2000);
    };
    const stop = () => { if (timer.current) clearTimeout(timer.current); };
    useEffect(() => {
        start();
        return stop;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [job.status]);

    const size = job.file ? mb(job.file.size) : null;
    const line =
        job.status === "done" ? job.note ?? `Downloaded${size ? ` · ${size}` : ""}`
        : job.status === "failed" ? job.note
        : job.status === "cancelled" ? "Cancelled"
        : job.note ?? (typeof job.value === "number" && job.value > 0 ? `${Math.round(job.value)}%` : "Preparing your file…");

    return (
        <div
            role={job.status === "failed" ? "alert" : "status"}
            data-leaving={leaving || undefined}
            onPointerEnter={stop}
            onPointerLeave={start}
            className={cn(
                "m3-download pointer-events-auto overflow-hidden rounded-large",
                "bg-surface-container-lowest text-on-surface shadow-level-3 dark:bg-surface-container-high dark:shadow-none",
            )}
        >
            <div className="flex items-center gap-2 p-3 pr-2">
                <Thumb job={job} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-title-sm">{job.title}</p>
                    <p className={cn("mt-0.5 text-body-sm", job.status === "failed" ? "line-clamp-2 text-error" : "truncate text-on-surface-variant")}>{line}</p>
                </div>
                {job.status === "done" && job.file ? (
                    <Button variant="text" size="xs" onClick={() => handOver(job.file!.url, job.file!.name)}>Save again</Button>
                ) : job.status === "failed" && job.retry ? (
                    <Button variant="text" size="xs" onClick={() => { remove(job.id); job.retry!(); }}>Try again</Button>
                ) : null}
                <IconButton
                    icon={X}
                    size="sm"
                    label={job.status === "working" && job.cancel ? "Cancel download" : "Close"}
                    onClick={job.status === "working" && job.cancel ? job.cancel : close}
                    className="text-on-surface-variant"
                />
            </div>
            {job.status === "working" ? <Progress value={job.value} label={`Downloading ${job.title}`} className="rounded-none" /> : null}
        </div>
    );
}

function Thumb({ job }: { job: Job }) {
    const [broken, setBroken] = useState(false);
    const glyph = job.status === "failed" ? AlertTriangle : DownloadGlyph;
    return (
        <div className="relative h-14 w-14 shrink-0">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-medium" style={CHECKER_STYLE}>
                {job.preview && !broken ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a blob: or any-host preview, shown once
                    <img src={job.preview} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
                ) : (
                    <Icon icon={glyph} className={job.status === "failed" ? "text-error" : "text-on-surface-variant"} />
                )}
            </div>
            {job.count && job.count > 1 ? (
                <span className="absolute -left-1.5 -top-1.5 rounded-full bg-secondary-container px-2 text-center text-label-sm leading-6 text-on-secondary-container">
                    {job.count > 999 ? "999+" : job.count}
                </span>
            ) : null}
            {job.status === "done" ? (
                <span className="m3-download-check absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary ring-2 ring-surface-container-lowest dark:ring-surface-container-high">
                    <Icon icon={Check} size="sm" />
                </span>
            ) : null}
        </div>
    );
}

"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { Progress } from "../primitives/Progress";
import { AlertCircle, CheckCircle2, FileText, Upload, X } from "../symbols";
import { interactive } from "../state-layer";

export type UploadItem = {
    id: string;
    file: File;
    /** 0-1 while sending; null before it starts. */
    progress: number | null;
    state: "waiting" | "sending" | "done" | "failed";
    error?: string;
    /** A picture's preview, made in the browser (revoked on remove). */
    preview?: string;
};

export type FileUploadProps = {
    label: string;
    /** What the box says under the label: "PNG or JPG, up to 10 MB". */
    hint?: string;
    /** The browser's own filter, e.g. "image/*,.pdf". Checked again on drop. */
    accept?: string;
    multiple?: boolean;
    /** Bytes. Bigger files are refused with a reason, never sent. */
    maxSize?: number;
    maxFiles?: number;
    /**
     * Send one file. Call `progress(0..1)` as it goes; throw to fail it with
     * the error's message. Leave it out to only collect files (a form posts them).
     */
    upload?: (file: File, progress: (p: number) => void) => Promise<void>;
    /** Every change to the list: added, sent, removed. */
    onChange?: (items: UploadItem[]) => void;
    /** Paste a picture anywhere on the page to add it. */
    paste?: boolean;
    className?: string;
};

const mb = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/** Does `file` match an accept string like "image/*,.pdf"? */
function accepts(file: File, accept?: string): boolean {
    if (!accept) return true;
    return accept.split(",").map((s) => s.trim().toLowerCase()).some((a) =>
        a.startsWith(".") ? file.name.toLowerCase().endsWith(a) : a.endsWith("/*") ? file.type.startsWith(a.slice(0, -1)) : file.type === a,
    );
}

/**
 * Drop files here, or click to choose, or paste. Each file gets a row with its
 * own progress and its own reason when it is refused ("too big", "not a
 * picture"), so one bad file never sinks the rest.
 *
 * The real <input type="file"> stays in the page: it is what a keyboard and a
 * screen reader use, and it opens the phone's camera and photo library.
 */
export function FileUpload({ label, hint, accept, multiple = true, maxSize, maxFiles = 20, upload, onChange, paste, className }: FileUploadProps) {
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const [items, setItems] = useState<UploadItem[]>([]);
    const [over, setOver] = useState(false);
    const latest = useRef(items);
    latest.current = items;

    const commit = (next: UploadItem[]) => { latest.current = next; setItems(next); onChange?.(next); };
    const patch = (itemId: string, p: Partial<UploadItem>) => commit(latest.current.map((i) => (i.id === itemId ? { ...i, ...p } : i)));

    const add = (files: File[]) => {
        const room = Math.max(0, (multiple ? maxFiles : 1) - (multiple ? latest.current.length : 0));
        const fresh: UploadItem[] = files.slice(0, room).map((file) => {
            const why = !accepts(file, accept) ? "This kind of file isn't allowed here." : maxSize && file.size > maxSize ? `Too big: ${mb(file.size)}. The limit is ${mb(maxSize)}.` : undefined;
            return {
                id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
                file,
                progress: null,
                state: why ? "failed" : "waiting",
                error: why,
                preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
            };
        });
        commit(multiple ? [...latest.current, ...fresh] : fresh);
        if (upload) for (const it of fresh) if (it.state === "waiting") send(it);
    };

    const send = async (it: UploadItem) => {
        patch(it.id, { state: "sending", progress: 0, error: undefined });
        try {
            await upload!(it.file, (p) => patch(it.id, { progress: Math.min(1, Math.max(0, p)) }));
            patch(it.id, { state: "done", progress: 1 });
        } catch (e) {
            patch(it.id, { state: "failed", error: (e as Error).message || "Upload failed. Try again." });
        }
    };

    const remove = (itemId: string) => {
        const it = latest.current.find((i) => i.id === itemId);
        if (it?.preview) URL.revokeObjectURL(it.preview);
        commit(latest.current.filter((i) => i.id !== itemId));
    };

    useEffect(() => {
        if (!paste) return;
        const onPaste = (e: ClipboardEvent) => {
            const files = [...(e.clipboardData?.files ?? [])];
            if (files.length) { e.preventDefault(); add(files); }
        };
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    });

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        add([...e.dataTransfer.files]);
    };

    return (
        <div className={cn("flex min-w-0 flex-col gap-3", className)}>
            <label
                htmlFor={id}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                className={cn(
                    "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-medium bg-surface-container-low px-6 py-8 text-center",
                    /* Dashed on purpose: the one place a line says "drop here". */
                    "border-2 border-dashed border-outline-variant",
                    "transition-colors duration-short4 ease-standard hover:bg-surface-container focus-within:outline focus-within:outline-2 focus-within:outline-primary",
                    over && "bg-secondary-container text-on-secondary-container",
                )}
            >
                <span className="flex h-12 w-12 items-center justify-center bg-inverse-surface text-inverse-on-surface">
                    <Icon icon={Upload} />
                </span>
                <span className="text-title-sm text-on-surface">{label}</span>
                <span className="text-body-sm text-on-surface-variant">
                    <span className="underline underline-offset-4">Choose {multiple ? "files" : "a file"}</span> or drop {multiple ? "them" : "it"} here{paste ? ". You can paste too." : "."}
                </span>
                {hint ? <span className="text-label-md text-on-surface-variant">{hint}</span> : null}
                <input
                    ref={input}
                    id={id}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    className="sr-only"
                    onChange={(e) => { add([...(e.currentTarget.files ?? [])]); e.currentTarget.value = ""; }}
                />
            </label>

            {items.length ? (
                <ul className="flex flex-col gap-2" aria-label="Files">
                    {items.map((it) => (
                        <li key={it.id} className="flex min-w-0 items-center gap-3 rounded-medium bg-surface-container p-3">
                            {it.preview ? (
                                // eslint-disable-next-line @next/next/no-img-element -- a local blob preview
                                <img src={it.preview} alt="" className="h-10 w-10 shrink-0 object-cover" />
                            ) : (
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-surface-container-highest text-on-surface-variant"><Icon icon={FileText} /></span>
                            )}
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-body-md text-on-surface">{it.file.name}</span>
                                    <span className="shrink-0 text-label-md text-on-surface-variant tnum">{mb(it.file.size)}</span>
                                </span>
                                {it.state === "sending" ? <Progress value={(it.progress ?? 0) * 100} label={`Sending ${it.file.name}`} /> : null}
                                {it.state === "failed" ? <span className="text-body-sm text-error">{it.error}</span> : null}
                            </span>
                            {it.state === "done" ? <Icon icon={CheckCircle2} label="Sent" className="text-on-surface" /> : null}
                            {it.state === "failed" && upload && !it.error?.startsWith("Too big") && !it.error?.startsWith("This kind") ? (
                                <button type="button" onClick={() => send(it)} className={cn("rounded-small px-2 py-1 text-label-lg text-on-surface", interactive())}>Retry</button>
                            ) : it.state === "failed" ? <Icon icon={AlertCircle} className="text-error" /> : null}
                            <button type="button" aria-label={`Remove ${it.file.name}`} onClick={() => remove(it.id)} className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-small text-on-surface-variant", interactive())}>
                                <Icon icon={X} />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

/** Send a file with real progress (fetch can't report upload progress; XHR can). */
export function sendFile(url: string, file: File, progress: (p: number) => void, field = "file"): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.upload.onprogress = (e) => e.lengthComputable && progress(e.loaded / e.total);
        xhr.onload = () => {
            if (xhr.status < 300) return resolve();
            let msg = "Upload failed. Try again.";
            try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* not JSON */ }
            reject(new Error(msg));
        };
        xhr.onerror = () => reject(new Error("No connection. Check your internet and try again."));
        const body = new FormData();
        body.append(field, file);
        xhr.send(body);
    });
}

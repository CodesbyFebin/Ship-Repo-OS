"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "../symbols";
import { cn } from "../cn";
import { IconButton } from "../primitives/Button";
import { useMediaQuery } from "./position";

/*
 * 🔴 A modal <dialog> sits in the browser's top layer, above every z-index,
 * and makes the rest of the page inert. The toast area lives in <body>, so
 * a toast fired while a Sheet is open ("Couldn't download", "Undo") landed
 * BEHIND it, unseen and unclickable. While any Sheet is open, the toast area
 * joins the top layer too, above the newest Sheet.
 */
const TOASTS = 'section[aria-label^="Notifications"]';
export function liftToasts() {
    // The download card (Download.tsx) is its own top-layer popover: move it above this Sheet too.
    const d = document.querySelector<HTMLElement>("[data-download-layer]");
    if (d?.matches(":popover-open")) { d.hidePopover(); d.showPopover(); }
    const t = document.querySelector<HTMLElement>(TOASTS);
    if (!t) return;
    if (!t.hasAttribute("popover")) t.setAttribute("popover", "manual");
    t.classList.add("m3-toast-layer");
    // Re-showing moves it to the top of the top layer, above this Sheet.
    if (t.matches(":popover-open")) t.hidePopover();
    t.showPopover();
}
export function dropToasts() {
    const t = document.querySelector<HTMLElement>(TOASTS);
    if (!t || document.querySelector("dialog[open]")) return;
    if (t.matches(":popover-open")) t.hidePopover();
    t.removeAttribute("popover");
    t.classList.remove("m3-toast-layer");
}

/*
 * 🔴 The page behind a popup must not scroll. Each popup used to remember
 * `body.overflow` on open and put it back on close; with one popup opened from
 * another (wallet popup over Settings) and the PARENT closing first, the child
 * restored a stale "hidden" and the page stayed frozen. Count the open popups
 * instead: the first locks, the last unlocks.
 */
let scrollLocks = 0;
let scrollBefore = "";
export function lockPageScroll() {
    if (scrollLocks++ === 0) {
        scrollBefore = document.body.style.overflow;
        document.body.style.overflow = "hidden";
    }
    return () => {
        if (--scrollLocks === 0) document.body.style.overflow = scrollBefore;
    };
}

export type WindowProps = {
    open: boolean;
    onClose: () => void;
    /** Names the window. Screen readers only, unless `showTitle` (editors draw their own). */
    title: ReactNode;
    /** Draws the title (and `description`) at the top of the scrolling content. No bar, no line. */
    showTitle?: boolean;
    /** One line under the title saying what this decides. Needs `showTitle`. */
    description?: ReactNode;
    /** Hides the ✕. Only for a decision that must be made (then give it buttons). */
    hideClose?: boolean;
    /**
     * Same 3:2 shape at every size.
     * `lg` nearly fills a desktop screen; `md` 75%, `sm` 60%, `xs` 40% (a question).
     * On a phone `lg`, `md` and `sm` are nearly the whole screen, a strip of
     * the page showing on top; `xs` stays a small card.
     * `tall` is the one exception to 3:2: a portrait card (27 rem wide, up to
     * 46 rem high) for a list that wants height, like the wallet picker.
     */
    /** `fit`: a narrow card exactly as tall as what is in it - a form like sign-in. */
    size?: "lg" | "md" | "sm" | "xs" | "tall" | "fit";
    /** Left pane: a picture, SVG, animation, a live preview. On a phone it becomes a strip on top. */
    stage?: ReactNode;
    /** On a phone: `strip` (default) a short fixed strip on top; `flow` the stage at its natural height, scrolling with the content. */
    stagePhone?: "strip" | "flow";
    /** Buttons for the top-right of the content. No bar, no line: they sit on the same surface. */
    actions?: ReactNode;
    /** Pinned bottom buttons (primary last). Same surface, no line. Leave out when the window has none. */
    footer?: ReactNode;
    /** Content edge to edge, not scrolling: an editor that owns its own canvas. */
    flush?: boolean;
    className?: string;
    children?: ReactNode;
};

/**
 * The one big popup. Every dialog, wizard and editor in AMNT is this.
 *
 * - One shape: 3:2, centred. It never grows or shrinks with its content;
 *   only the content scrolls, inside it. A step that is short stays in the
 *   same box as a step that is long.
 * - No header, no footer bar, no lines: one surface. The ✕ sits outside the
 *   top-right corner, on the dimmed page (a phone has no outside: it sits in
 *   the top strip, beside the grab handle).
 * - Phone: nearly full screen, sliding up, a strip of the page left on top;
 *   pull the handle down to close.
 *
 * Built on `<dialog showModal()>`, like Sheet: top layer, focus trap, Esc and
 * `inert` page for free. Geometry lives in ui.css (`.m3-window`).
 */
/** How far down you have to pull a phone's window before letting go closes it. */
const DRAG_CLOSE_PX = 96;

export function Window({ open, onClose, title, showTitle, description, hideClose, size = "lg", stage, stagePhone = "strip", actions, footer, flush, className, children }: WindowProps) {
    const ref = useRef<HTMLDialogElement | null>(null);
    const titleId = `window-${useId()}`;
    /* Under 840 px, or a phone turned sideways, there is no room for a big
       window with a ✕ beside it: it becomes the whole screen. */
    const compact = useMediaQuery("(max-width: 839px), (max-height: 520px)");
    const card = size === "xs";
    const full = compact && !card;
    const flowStage = compact && stagePhone === "flow";

    /* Pull the top of a phone's window down to close it: only the handle
       drags, so a scrolling body never fights the gesture, and only downwards. */
    const [drag, setDrag] = useState(0);
    const dragFrom = useRef<number | null>(null);
    const onDragStart = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragFrom.current = e.clientY;
    }, []);
    const onDragMove = useCallback((e: React.PointerEvent) => {
        if (dragFrom.current !== null) setDrag(Math.max(0, e.clientY - dragFrom.current));
    }, []);
    const onDragEnd = useCallback(() => {
        if (dragFrom.current === null) return;
        dragFrom.current = null;
        const travelled = drag;
        setDrag(0);
        if (travelled > DRAG_CLOSE_PX) onClose();
    }, [drag, onClose]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (open && !el.open) {
            el.showModal();
            liftToasts();
        }
        if (!open && el.open) {
            el.close();
            dropToasts();
        }
        if (!open) {
            dragFrom.current = null;
            setDrag(0);
        }
    }, [open]);
    useEffect(() => () => { if (ref.current?.open) { ref.current.close(); dropToasts(); } }, []);

    // The page behind must not scroll under the window, on iOS especially.
    useEffect(() => (open ? lockPageScroll() : undefined), [open]);

    return (
        <dialog
            ref={ref}
            data-placement={full ? "bottom" : "center"}
            data-size={size}
            data-full={full || undefined}
            aria-labelledby={titleId}
            onCancel={e => {
                // Esc: the parent owns `open`, the DOM does not close behind its back.
                e.preventDefault();
                onClose();
            }}
            onClick={e => {
                if (e.target === ref.current) onClose();
            }}
            className="m3-sheet m3-window"
            /* While a finger is down the window follows it exactly. */
            style={drag ? { translate: `0 ${drag}px`, transition: "none" } : undefined}
        >
            {showTitle ? null : <h2 id={titleId} className="sr-only">{title}</h2>}
            <div className={cn("flex h-full overflow-hidden bg-surface-container-lowest text-on-surface shadow-level-4 dark:bg-surface-container", full ? "flex-col rounded-t-extra-large" : "rounded-extra-large", compact && !full && "flex-col")}>
                {full ? (
                    /* The phone's top strip: the grab handle in the middle, the ✕ at
                       the right, so the ✕ never sits on top of the content's own bar. */
                    <div
                        className="relative grid h-10 shrink-0 touch-none place-items-center"
                        onPointerDown={onDragStart}
                        onPointerMove={onDragMove}
                        onPointerUp={onDragEnd}
                        onPointerCancel={onDragEnd}
                    >
                        <span aria-hidden className="h-1 w-8 rounded-full bg-on-surface-variant/[0.4]" />
                        {hideClose ? null : <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="absolute right-2 top-1" />}
                    </div>
                ) : null}
                {stage && !flowStage ? (
                    <div className={cn("m-3 shrink-0 overflow-hidden rounded-large bg-surface-container", compact ? "mx-4 mt-1 h-40" : "w-[40%]")}>
                        {stage}
                    </div>
                ) : null}
                <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
                    {actions ? (
                        <div className={cn("flex shrink-0 items-center justify-end gap-2 px-6 pt-5", full && "pt-1")}>{actions}</div>
                    ) : null}
                    <div
                        className={cn(
                            "min-h-0 flex-1",
                            flush ? "flex flex-col overflow-hidden" : "overflow-y-auto overscroll-contain px-6 py-5",
                            full && !flush && "pt-2",
                        )}
                    >
                        {showTitle ? (
                            <div className="mb-4">
                                <h2 id={titleId} className="text-headline-sm text-on-surface">{title}</h2>
                                {description ? <p className="mt-1 text-body-md text-on-surface-variant">{description}</p> : null}
                            </div>
                        ) : null}
                        {stage && flowStage ? <div className="mb-4 overflow-hidden rounded-large bg-surface-container">{stage}</div> : null}
                        {children}
                    </div>
                    {footer ? (
                        <>
                            {/* No line: the content fades out under the buttons instead. */}
                            <div aria-hidden className="-mt-6 h-6 shrink-0 bg-gradient-to-t from-surface-container-high to-transparent" />
                            <div className="flex shrink-0 flex-wrap justify-end gap-2 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{footer}</div>
                        </>
                    ) : null}
                </div>
            </div>
            {/* Outside the corner on a desktop (Canva), inside it on a phone. */}
            {hideClose || full ? null : (
                <IconButton icon={X} label="Close" variant="tonal" onClick={onClose} className="absolute left-full top-0 ml-3 shadow-level-2" />
            )}
        </dialog>
    );
}

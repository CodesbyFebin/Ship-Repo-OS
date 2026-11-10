"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "../symbols";
import { cn } from "../cn";
import { Button, IconButton } from "../primitives/Button";
import { useMediaQuery } from "./position";
import { Window, dropToasts, liftToasts, lockPageScroll } from "./Window";

const WIDTH = {
    fit: "medium:max-w-[26rem]",
    sm: "medium:max-w-[26rem]",
    md: "medium:max-w-[34rem]",
    lg: "medium:max-w-[52rem]",
    /** Wide, not tall: three plan cards side by side. `full`'s width, its own height. */
    xl: "medium:max-w-[min(72rem,calc(100vw-4rem))]",
    /**
     * An editor, not a question: the trait editor, Edit traits, Settings.
     * The whole screen on a phone, nearly the whole window on a desktop —
     * a canvas you drag things around on does not fit in 34rem, and shrinking
     * it to fit is how the studio ended up with its own full-screen frames
     * instead of using this one.
     */
    full: "medium:max-w-[min(72rem,calc(100vw-4rem))]",
    /**
     * A navigation drawer (`placement="left"`, or `"right"`): M3's modal drawer is 360dp at
     * most, and on a phone a strip of the page stays showing, so it reads as
     * a drawer over the page - ChatGPT's and Claude's ☰, not a new screen.
     */
    nav: "max-w-[min(22.5rem,88vw)] medium:w-[22.5rem]",
} as const;

/** How far down you have to drag a bottom sheet before letting go closes it. */
const DRAG_CLOSE_PX = 96;

export type SheetProps = {
    open: boolean;
    onClose: () => void;
    /** Names the dialog. Required: a dialog with no name is unusable by screen readers. */
    title: ReactNode;
    /** One line under the title saying what this decides. */
    description?: ReactNode;
    /** Buttons. The primary action goes last, on the right. */
    footer?: ReactNode;
    size?: keyof typeof WIDTH;
    /**
     * `auto` (default) is a centred dialog on desktop and a bottom sheet on a
     * phone - the same component, where the thumb can reach it.
     */
    placement?: "auto" | "center" | "bottom" | "right" | "left";
    /** Hides the ✕. Only for a decision that must be made (then give it buttons). */
    hideClose?: boolean;
    /** Small controls in the header, left of the ✕ (an editor's toggles). */
    actions?: ReactNode;
    /** Body edge to edge and not scrolling: for an editor that owns its own canvas. */
    flush?: boolean;
    /**
     * No header, no handle: the body is the whole dialog (the search view).
     * The title is still there for screen readers. Implies `flush`.
     */
    headless?: boolean;
    className?: string;
    children?: ReactNode;
};

/**
 * The side drawer, the bottom sheet and the search panel (`Sheet` hands them
 * to this; every other popup is a `Window`).
 *
 * Built on `<dialog showModal()>`, so the browser gives us the top layer, the
 * focus trap, the backdrop, Esc, and `inert` on the page behind - all the
 * things a div-with-a-z-index gets wrong. We add placement, scroll lock and
 * the motion.
 */
function Drawer({ open, onClose, title, description, footer, size = "md", placement = "auto", hideClose, actions, flush: flushProp, headless, className, children }: SheetProps) {
    const ref = useRef<HTMLDialogElement | null>(null);
    const flush = flushProp || headless;
    const uid = useId();
    const titleId = `sheet-${uid}-t`;
    const descId = description ? `sheet-${uid}-d` : undefined;
    /* M3 compact window: under 600 px is a phone. */
    const isPhone = useMediaQuery("(max-width: 599px)");
    const resolved = placement === "auto" ? (isPhone ? "bottom" : "center") : placement;
    /* The drag handlers are created once; this is how they see the current
       placement without being rebuilt on every render. */
    const resolvedRef = useRef(resolved);
    resolvedRef.current = resolved;

    /**
     * Drag-down to close, on a phone.
     *
     * The grab handle used to be decoration: it said "this drags" and nothing
     * happened. Pulling a sheet down is how people close one on a phone, and
     * the ✕ is at the top of the screen — the far corner from a thumb.
     *
     * Only the header drags, so a scrolling body is never fighting the gesture,
     * and only downwards: an upward pull does nothing rather than lifting the
     * sheet off the bottom of the screen. Let go past `DRAG_CLOSE_PX` and it
     * closes; short of it, it springs back.
     */
    const [drag, setDrag] = useState(0);
    const dragFrom = useRef<number | null>(null);

    const onDragStart = useCallback((e: React.PointerEvent) => {
        if (resolvedRef.current !== "bottom" || e.pointerType === "mouse") return;
        dragFrom.current = e.clientY;
    }, []);

    const onDragMove = useCallback((e: React.PointerEvent) => {
        if (dragFrom.current === null) return;
        setDrag(Math.max(0, e.clientY - dragFrom.current));
    }, []);

    const onDragEnd = useCallback(() => {
        if (dragFrom.current === null) return;
        const travelled = drag;
        dragFrom.current = null;
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

    // The page behind must not scroll under the sheet, on iOS especially.
    useEffect(() => (open ? lockPageScroll() : undefined), [open]);

    return (
        <dialog
            ref={ref}
            data-placement={resolved}
            aria-labelledby={titleId}
            aria-describedby={descId}
            onCancel={e => {
                // Esc: let the parent own `open` instead of the DOM closing behind its back.
                e.preventDefault();
                onClose();
            }}
            onClick={e => {
                if (e.target === ref.current) onClose();
            }}
            className={cn(
                "m3-sheet m-0 w-full border-0 bg-surface-container-lowest p-0 text-on-surface shadow-level-4 backdrop:bg-transparent dark:bg-surface-container",
                resolved === "center" && "mx-auto my-auto max-h-[calc(100dvh-4rem)] rounded-extra-large",
                /* `max-w-full`: the browser's own `dialog:modal` style caps a
                   modal at 100% - 2em - 6px, which left a 34px strip of the
                   page showing beside every bottom sheet on a phone. A size
                   class (`medium:max-w-…`) still narrows it on wider screens. */
                resolved === "bottom" && "mt-auto max-h-[92dvh] max-w-full rounded-t-extra-large pb-[env(safe-area-inset-bottom,0px)]",
                resolved === "right" && "ml-auto mr-0 h-dvh max-h-dvh rounded-l-extra-large medium:w-[28rem]",
                resolved === "left" && "ml-0 mr-auto h-dvh max-h-dvh rounded-r-extra-large medium:w-[28rem]",
                /* `full` is an editor: the whole screen on a phone (no rounded
                   top, nothing of the page showing behind it), and tall on a
                   desktop so a canvas has somewhere to be. */
                size === "full" && resolved === "bottom" && "h-dvh max-h-dvh rounded-none",
                size === "full" && resolved === "center" && "h-[calc(100dvh-4rem)]",
                WIDTH[size],
                className,
            )}
            /* While a finger is down the sheet follows it exactly, so the
               transition is off; on release it animates back or away. */
            style={drag ? { translate: `0 ${drag}px`, transition: "none" } : undefined}
        >
            {/* Grab handle. It drags — see onDragStart. */}
            {resolved === "bottom" && size !== "full" && !headless ? <div aria-hidden className="mx-auto mt-2 h-1 w-8 rounded-full bg-on-surface-variant/[0.4]" /> : null}
            {/* `full` and a side drawer are a fixed height, so the column fills
                it (an editor's canvas, a drawer's pinned footer); otherwise it
                hugs its content. */}
            <div className={cn("flex max-h-[inherit] flex-col overflow-hidden", (size === "full" || resolved === "right" || resolved === "left") && "h-full")}>
                {headless ? <h2 id={titleId} className="sr-only">{title}</h2> : <header
                    className={cn(
                        "flex touch-pan-y items-start gap-3 px-5 pb-1 pt-5",
                        /* Full screen on a phone: clear the notch / status bar. */
                        size === "full" && resolved === "bottom" && "pt-[max(1.25rem,env(safe-area-inset-top))]",
                    )}
                    onPointerDown={size === "full" ? undefined : onDragStart}
                    onPointerMove={onDragMove}
                    onPointerUp={onDragEnd}
                    onPointerCancel={onDragEnd}
                >
                    <div className="min-w-0 flex-1">
                        <h2 id={titleId} className="text-headline-sm text-on-surface">
                            {title}
                        </h2>
                        {description ? (
                            <p id={descId} className="mt-1 text-body-md text-on-surface-variant">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
                    {hideClose ? null : <IconButton icon={X} label="Close" size="sm" onClick={onClose} />}
                </header>}
                <div className={cn("min-h-0 flex-1", flush ? "flex flex-col overflow-hidden" : "overflow-y-auto overscroll-contain px-5 py-4")}>{children}</div>
                {footer ? <footer className="flex flex-wrap justify-end gap-2 px-5 pb-5 pt-1">{footer}</footer> : null}
            </div>
        </dialog>
    );
}

const WINDOW_SIZE = { fit: "fit", sm: "sm", md: "md", lg: "lg", xl: "lg", full: "lg", nav: "lg" } as const;

/**
 * Every popup in AMNT. A drawer (`placement="right"`), a bottom sheet or the
 * search panel (`placement="center"`) keep their own look; everything else is
 * the one `Window`: same 3:2 shape, no header, no footer bar, ✕ outside the
 * corner. `size` only scales it. An editor (`flush` / `headless`) draws its own
 * heading; any other popup gets its title and description at the top of the
 * scrolling content.
 */
export function Sheet(props: SheetProps) {
    const { placement = "auto", size = "md", headless, flush, title, description, className, hideClose, ...rest } = props;
    if (placement !== "auto") return <Drawer {...props} />;
    const editor = flush || headless;
    return (
        <Window
            open={rest.open}
            onClose={rest.onClose}
            title={title}
            description={description}
            showTitle={!editor}
            hideClose={hideClose}
            size={WINDOW_SIZE[size]}
            actions={rest.actions}
            footer={rest.footer}
            flush={editor}
            className={className}
        >
            {rest.children}
        </Window>
    );
}

export type ConfirmOptions = {
    /** The question, as the action: "Delete Headwear?" */
    title: ReactNode;
    /** What happens, plainly — say when it can't be undone. */
    description?: ReactNode;
    /** The verb on the button: "Delete", not "OK". */
    confirmLabel?: string;
    /** Red button, for anything that destroys work. */
    danger?: boolean;
};

/**
 * The app's "Are you sure?", instead of the browser's `confirm()`.
 *
 * `const [confirmUi, ask] = useConfirm();` — render `confirmUi` once, then
 * `if (!(await ask({ title: "Delete Headwear?", danger: true }))) return;`.
 * Esc, the ✕ and a tap outside all answer "no".
 */
export function useConfirm(): [ReactNode, (o: ConfirmOptions) => Promise<boolean>] {
    const [q, setQ] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
    const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>(resolve => setQ({ ...o, resolve })), []);
    const answer = (v: boolean) => {
        q?.resolve(v);
        setQ(null);
    };
    const ui = (
        <Window
            open={!!q}
            onClose={() => answer(false)}
            title={q?.title ?? ""}
            description={q?.description}
            showTitle
            size="xs"
            footer={
                <>
                    <Button variant="text" onClick={() => answer(false)}>Cancel</Button>
                    <Button variant={q?.danger ? "danger" : "filled"} onClick={() => answer(true)}>
                        {q?.confirmLabel ?? "OK"}
                    </Button>
                </>
            }
        />
    );
    return [ui, ask];
}

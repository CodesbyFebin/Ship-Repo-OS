"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "../cn";
import { place, useAnchoredPosition, type Placement } from "./position";

/**
 * 🔴 Clicking the trigger of an OPEN popover used to leave it open. The
 * browser's light dismiss closes it on pointerup, then the click that follows
 * toggles it straight back open. `beforetoggle` fires synchronously on close,
 * so a click within a few ms of it is that same gesture — ignore it.
 */
export function justClosed(at: number) {
    return performance.now() - at < 300;
}

export type PopoverTriggerProps = {
    ref: (node: HTMLElement | null) => void;
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": "dialog" | "menu" | "listbox";
    "aria-controls": string;
};

export type PopoverProps = {
    /** Render the control that opens it, spreading the props onto it. */
    trigger: (props: PopoverTriggerProps) => ReactNode;
    children: ReactNode | ((close: () => void) => ReactNode);
    placement?: Placement;
    /** What the popover contains, for screen readers. */
    role?: "dialog" | "menu" | "listbox";
    label?: string;
    className?: string;
    onOpenChange?: (open: boolean) => void;
    /** Controlled open state. Leave it out and the popover manages itself. */
    open?: boolean;
    /**
     * Leave the contents out of the server HTML (drawn right after the page
     * wakes up, so the first open is instant). For pickers on public pages:
     * a crawler then reads the page's sentences, not every model and colour
     * in a closed menu. Never for navigation - its links must stay in the HTML.
     */
    clientOnly?: boolean;
};

/**
 * A floating panel anchored to a trigger.
 *
 * Built on the browser's popover API, which gives us the top layer (never
 * clipped by a scrolling parent), Esc to close, and click-outside to dismiss -
 * the three things hand-rolled dropdowns get wrong. We add the positioning.
 */
export function Popover({ trigger, children, placement = "bottom-start", role = "dialog", label, className, onOpenChange, open: controlled, clientOnly }: PopoverProps) {
    const awake = useAwake(clientOnly);
    const id = `pop-${useId()}`;
    const anchor = useRef<HTMLElement | null>(null);
    const pop = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);
    /** When light dismiss last closed it - see justClosed(). */
    const closedAt = useRef(0);
    useAnchoredPosition(anchor as React.RefObject<HTMLElement>, pop as React.RefObject<HTMLElement>, open, placement);

    const close = useCallback(() => pop.current?.hidePopover(), []);

    /* A caller that owns the state (closes it after a pick) drives the
       native popover from here; the toggle listener reports back. */
    useEffect(() => {
        const el = pop.current;
        if (!el || controlled === undefined) return;
        const isOpen = el.matches(":popover-open");
        if (controlled && !isOpen) el.showPopover();
        if (!controlled && isOpen) el.hidePopover();
    }, [controlled]);

    useEffect(() => {
        const el = pop.current;
        if (!el) return;
        const onToggle = (e: Event) => {
            const next = (e as ToggleEvent).newState === "open";
            setOpen(next);
            onOpenChange?.(next);
            if (next && anchor.current && el) {
                // Position before the first paint of the open state.
                requestAnimationFrame(() => anchor.current && place(anchor.current, el, placement));
            }
        };
        const onBeforeToggle = (e: Event) => {
            if ((e as ToggleEvent).newState === "closed") closedAt.current = performance.now();
        };
        el.addEventListener("toggle", onToggle);
        el.addEventListener("beforetoggle", onBeforeToggle);
        return () => {
            el.removeEventListener("toggle", onToggle);
            el.removeEventListener("beforetoggle", onBeforeToggle);
        };
    }, [onOpenChange, placement]);

    return (
        <>
            {trigger({
                ref: node => {
                    anchor.current = node;
                },
                onClick: () => {
                    if (!justClosed(closedAt.current)) pop.current?.togglePopover();
                },
                "aria-expanded": open,
                "aria-haspopup": role === "menu" ? "menu" : role,
                "aria-controls": id,
            })}
            <div
                ref={pop}
                id={id}
                popover="auto"
                role={role === "dialog" ? "dialog" : undefined}
                aria-label={label}
                className={cn(
                    "m3-pop max-h-[min(24rem,80dvh)] min-w-[12rem] max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto overflow-x-hidden",
                    "rounded-medium border-0 bg-surface-container-lowest p-1.5 text-on-surface shadow-level-3 dark:bg-surface-container-high",
                    className,
                )}
            >
                {awake && (typeof children === "function" ? children(close) : children)}
            </div>
        </>
    );
}

/** False on the server and the first client render when `clientOnly`, true from then on. */
export function useAwake(clientOnly?: boolean): boolean {
    const [awake, setAwake] = useState(!clientOnly);
    useEffect(() => { if (clientOnly) setAwake(true); }, [clientOnly]);
    return awake;
}

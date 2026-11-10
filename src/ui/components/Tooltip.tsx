"use client";

import { cloneElement, useCallback, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from "react";
import { cn } from "../cn";
import { place, type Placement } from "./position";

export type TooltipProps = {
    /** The word or two the tooltip says. Never the only place that meaning exists. */
    content: ReactNode;
    /** One element that receives the hover, focus and aria wiring. */
    children: ReactElement;
    placement?: Placement;
    /** Wait before showing, so a cursor crossing a toolbar does not flash six tips. */
    delay?: number;
    className?: string;
};

/** A touch has to rest this long before it counts as "tell me about this". */
const LONG_PRESS_MS = 400;

/**
 * A hint on hover, long-press or keyboard focus.
 *
 * Rules that keep it honest: it never holds information that exists nowhere
 * else, it never contains a control (it is not focusable), and an icon-only
 * button keeps its own `aria-label` - the tooltip describes, it does not name.
 *
 * 🔴 TOUCH GETS IT TOO. A pointer-enter-only tooltip is missing on every
 * phone, and `pointerenter` fires on a tap, so a touch used to flash the tip
 * for the length of the tap and then lose it. A touch opens the tip by
 * resting; a lift, a scroll or a second tap closes it. The tip itself is
 * `pointer-events-none`, so it can never swallow the tap underneath.
 */
export function Tooltip({ content, children, placement = "top", delay = 500, className }: TooltipProps) {
    const id = `tip-${useId()}`;
    const anchor = useRef<HTMLElement | null>(null);
    const tip = useRef<HTMLDivElement | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [open, setOpen] = useState(false);

    const show = useCallback(
        (immediate = false) => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(
                () => {
                    const el = tip.current;
                    if (!el || !anchor.current) return;
                    el.showPopover();
                    place(anchor.current, el, placement);
                    setOpen(true);
                },
                immediate ? 0 : delay,
            );
        },
        [delay, placement],
    );

    const hide = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        tip.current?.hidePopover();
        setOpen(false);
    }, []);

    /** A finger held still on the element. A scroll cancels it. */
    const touchHold = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            const el = tip.current;
            if (!el || !anchor.current) return;
            el.showPopover();
            place(anchor.current, el, placement);
            setOpen(true);
        }, LONG_PRESS_MS);
    }, [placement]);

    useEffect(() => {
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);
    // Esc closes a tooltip too - the popover API only does that for `auto`.
    // So does a scroll: on a phone the tip is anchored to an element that is
    // moving away from it, and `manual` popovers never close themselves.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", hide, true);
        return () => {
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", hide, true);
        };
    }, [open, hide]);

    const child = cloneElement(children, {
        ref: (node: HTMLElement | null) => {
            anchor.current = node;
            const r = (children as unknown as { ref?: unknown }).ref;
            if (typeof r === "function") (r as (n: HTMLElement | null) => void)(node);
            else if (r && typeof r === "object") (r as { current: HTMLElement | null }).current = node;
        },
        "aria-describedby": open ? id : undefined,
        // A mouse hovers; a finger rests. Same tip, two ways in.
        onPointerEnter: (e: ReactPointerEvent) => { if (e.pointerType !== "touch") show(); },
        onPointerLeave: (e: ReactPointerEvent) => { if (e.pointerType !== "touch") hide(); },
        onPointerDown: (e: ReactPointerEvent) => { if (e.pointerType === "touch") touchHold(); },
        onPointerUp: (e: ReactPointerEvent) => { if (e.pointerType === "touch") hide(); },
        onPointerCancel: hide,
        onFocus: () => show(true),
        onBlur: hide,
    } as Record<string, unknown>);

    return (
        <>
            {child}
            <div
                ref={tip}
                id={id}
                popover="manual"
                role="tooltip"
                className={cn(
                    "m3-pop m3-tip pointer-events-none max-w-[16rem] rounded-small border-0 bg-inverse-surface px-2 py-1 text-label-md text-inverse-on-surface shadow-level-3",
                    className,
                )}
            >
                {content}
            </div>
        </>
    );
}

"use client";

import { useCallback, useEffect, useState } from "react";

export type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end" | "bottom" | "top" | "right-start";

/**
 * Places a floating element next to its anchor, flipping when it would run off
 * the bottom and sliding when it would run off the side. Deliberately small:
 * CSS anchor positioning will replace it once Safari and Firefox ship it, and
 * a positioning library is a dependency we do not need for a menu.
 */
export function place(anchor: HTMLElement, floater: HTMLElement, placement: Placement = "bottom-start", offset = 6) {
    const a = anchor.getBoundingClientRect();
    const w = floater.offsetWidth;
    const h = floater.offsetHeight;
    const margin = 8;
    /* Beside the anchor (a sidebar row's menu), falling back below it when
       there is no room on the right — a phone. */
    if (placement === "right-start" && a.right + offset + w + margin <= window.innerWidth) {
        const top = Math.min(Math.max(margin, a.top), Math.max(margin, window.innerHeight - h - margin));
        floater.style.position = "fixed";
        floater.style.left = `${Math.round(a.right + offset)}px`;
        floater.style.top = `${Math.round(top)}px`;
        floater.style.setProperty("--m3-pop-origin", "top left");
        return;
    }
    const wantsTop = placement.startsWith("top");
    const roomBelow = window.innerHeight - a.bottom;
    const roomAbove = a.top;
    const onTop = wantsTop ? roomAbove > h + offset + margin || roomAbove > roomBelow : roomBelow < h + offset + margin && roomAbove > roomBelow;

    let left: number;
    if (placement.endsWith("-end")) left = a.right - w;
    else if (placement === "bottom" || placement === "top") left = a.left + a.width / 2 - w / 2;
    else left = a.left;
    left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - w - margin));

    // Never off the screen: a tall panel (the colour picker) near the bottom slides up instead of hanging off.
    const top = Math.min(Math.max(margin, onTop ? a.top - h - offset : a.bottom + offset), Math.max(margin, window.innerHeight - h - margin));

    floater.style.position = "fixed";
    floater.style.left = `${Math.round(left)}px`;
    floater.style.top = `${Math.round(top)}px`;
    floater.style.setProperty("--m3-pop-origin", `${onTop ? "bottom" : "top"} ${left + w / 2 < a.left + a.width / 2 ? "left" : "right"}`);
}

/** Keeps a floating element glued to its anchor while it is open. */
export function useAnchoredPosition(
    anchor: React.RefObject<HTMLElement>,
    floater: React.RefObject<HTMLElement>,
    open: boolean,
    placement: Placement = "bottom-start",
) {
    const reposition = useCallback(() => {
        if (anchor.current && floater.current) place(anchor.current, floater.current, placement);
    }, [anchor, floater, placement]);

    useEffect(() => {
        if (!open) return;
        reposition();
        // `true` catches scrolling inside any ancestor, not just the window.
        window.addEventListener("scroll", reposition, true);
        window.addEventListener("resize", reposition);
        return () => {
            window.removeEventListener("scroll", reposition, true);
            window.removeEventListener("resize", reposition);
        };
    }, [open, reposition]);

    return reposition;
}

/** True when the viewport matches, kept in sync. SSR-safe: false first. */
export function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia(query);
        setMatches(mq.matches);
        const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, [query, setMatches]);
    return matches;
}

/* ── M3 window size classes ───────────────────────────────────────────── */

export type WindowClass = "compact" | "medium" | "expanded" | "large" | "xlarge";

/**
 * Which M3 window size class the viewport is in (§2.6). This is what a layout
 * asks before it chooses a navigation bar, a rail or a drawer.
 *
 * SSR-safe: "compact" first, because phone first means the phone layout is
 * what the server renders and what a slow client paints.
 */
export function useWindowClass(): WindowClass {
    const xlarge = useMediaQuery("(min-width: 1600px)");
    const large = useMediaQuery("(min-width: 1200px)");
    const expanded = useMediaQuery("(min-width: 840px)");
    const medium = useMediaQuery("(min-width: 600px)");
    if (xlarge) return "xlarge";
    if (large) return "large";
    if (expanded) return "expanded";
    if (medium) return "medium";
    return "compact";
}

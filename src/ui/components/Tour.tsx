"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../primitives/Button";
import { place, type Placement } from "./position";
import { usePersistedState } from "./usePersistedState";

/**
 * A first-run guide: one small card that sits next to the button it is talking
 * about and moves on as the work moves on (owner, 2026-10-01).
 *
 *   <Tour id="nft-studio" at={stepReached} steps={[{ key, title, body, target }]} />
 *
 * `at` is how far the person's own work has got (0 = nothing yet). The card
 * shows the furthest of that and the steps they pressed Next on, so it never
 * explains something they have already done. Skip hides it for good, on this
 * browser. Nothing is blocked: the page works the same with the card open.
 *
 * `target` returns the element to point at, or null while it is not on screen
 * (another tab, a popup open) - the card waits. A modal Sheet covers it by
 * itself: a dialog lives in the browser's top layer.
 */
export interface TourStep {
    key: string;
    title: string;
    body: ReactNode;
    target: () => Element | null;
    placement?: Placement;
}

/** The first visible button or tab whose words (or label) start with `text`. For `target`. */
export function tourTarget(text: string): Element | null {
    if (typeof document === "undefined") return null;
    for (const el of document.querySelectorAll<HTMLElement>("button, [role=tab]")) {
        // On a phone a button is often only its icon: its label still names it.
        if (el.offsetParent && [el.textContent, el.getAttribute("aria-label"), el.title].some((t) => (t || "").trim().startsWith(text))) return el;
    }
    return null;
}

export function Tour({ id, steps, at = 0 }: { id: string; steps: TourStep[]; at?: number }) {
    const [saved, setSaved] = usePersistedState<{ skip: boolean; passed: number }>(`tour:${id}`, { skip: false, passed: 0 });
    const card = useRef<HTMLDivElement>(null);
    const ring = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);
    const index = Math.max(at, saved.passed);
    const step = saved.skip ? undefined : steps[index];

    useEffect(() => {
        if (!step) return;
        const tick = () => {
            const el = step.target() as HTMLElement | null;
            const ok = !!el && !!card.current && !document.querySelector("dialog[open]");
            setShown(ok);
            if (!ok) return;
            place(el!, card.current!, step.placement ?? "bottom", 12);
            const r = el!.getBoundingClientRect();
            Object.assign(ring.current!.style, { left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` });
        };
        tick();
        // ponytail: a 400 ms look instead of observers. Targets come and go with tabs,
        // popups and scrolling; one cheap measure covers all of them.
        const t = setInterval(tick, 400);
        window.addEventListener("resize", tick);
        return () => { clearInterval(t); window.removeEventListener("resize", tick); };
    }, [step]);

    if (!step) return null;
    const last = index >= steps.length - 1;
    return (
        <>
            <div ref={ring} aria-hidden className={shown ? "pointer-events-none fixed z-tooltip rounded-large ring-2 ring-primary" : "hidden"} />
            <div
                ref={card}
                role="status"
                className={`fixed z-tooltip w-72 max-w-[calc(100vw-1rem)] rounded-large bg-inverse-surface p-4 text-inverse-on-surface shadow-level-3 ${shown ? "" : "invisible"}`}
            >
                <p className="text-label-md opacity-70">Step {index + 1} of {steps.length}</p>
                <p className="mt-1 text-title-md">{step.title}</p>
                <div className="mt-1 text-body-md">{step.body}</div>
                <div className="mt-3 flex items-center justify-between gap-2">
                    <Button variant="text" size="xs" className="text-inverse-on-surface" onClick={() => setSaved({ skip: true, passed: index })}>Skip</Button>
                    <Button variant="tonal" size="xs" onClick={() => setSaved(last ? { skip: true, passed: index } : { skip: false, passed: index + 1 })}>
                        {last ? "Done" : "Next"}
                    </Button>
                </div>
            </div>
        </>
    );
}

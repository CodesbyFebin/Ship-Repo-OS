"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../cn";

export type TabItem<T extends string> = {
    value: T;
    label: ReactNode;
    /** A count beside the label: 142 runs, 3 keys. */
    count?: number;
    disabled?: boolean;
};

export type TabsProps<T extends string> = {
    items: TabItem<T>[];
    value: T;
    onChange: (value: T) => void;
    /** Names the set for screen readers, e.g. "Agent sections". */
    label: string;
    className?: string;
    idPrefix?: string;
};

/**
 * Page-level sections. Keyboard behaviour is the ARIA pattern: ← → move and
 * activate, Home/End jump to the ends, and only the selected tab is in the
 * tab order, so Tab moves out of the set rather than through it.
 *
 * For two or three exclusive options inside a page, use SegmentedControl.
 */
export function Tabs<T extends string>({ items, value, onChange, label, className, idPrefix }: TabsProps<T>) {
    const generatedId = useId();
    const id = idPrefix ?? generatedId;
    const listRef = useRef<HTMLDivElement | null>(null);
    const [ink, setInk] = useState({ left: 0, width: 0 });

    const measure = useCallback(() => {
        const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
        if (!el) return;
        setInk({ left: el.offsetLeft, width: el.offsetWidth });
        // M3 scrollable tabs: the selected one is always visible. The row
        // scrolls sideways on a phone, so selecting with ← → or landing on a
        // page whose tab is the fifth of six would otherwise leave the
        // indicator somewhere off the edge of the screen. `nearest` means a
        // tab already in view is not moved.
        // 🔴 Only the row scrolls, never the page: `scrollIntoView` also scrolls
        // the window, so a page with tabs far down opened at the tabs, not the
        // hero (/svg-generator, 2026-10-03).
        const list = listRef.current!;
        if (el.offsetLeft < list.scrollLeft) list.scrollLeft = el.offsetLeft;
        else if (el.offsetLeft + el.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = el.offsetLeft + el.offsetWidth - list.clientWidth;
    }, []);

    useLayoutEffect(measure, [value, items, measure]);
    useEffect(() => {
        // Fonts land after first paint and shift the tabs under the indicator.
        document.fonts?.ready.then(measure).catch(() => {});
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [measure]);

    const move = (dir: 1 | -1 | "home" | "end") => {
        const usable = items.filter(i => !i.disabled);
        if (!usable.length) return;
        if (dir === "home") return onChange(usable[0].value);
        if (dir === "end") return onChange(usable[usable.length - 1].value);
        const at = usable.findIndex(i => i.value === value);
        onChange(usable[(at + dir + usable.length) % usable.length].value);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        const keys: Record<string, () => void> = {
            ArrowRight: () => move(1),
            ArrowLeft: () => move(-1),
            Home: () => move("home"),
            End: () => move("end"),
        };
        const run = keys[e.key];
        if (run) {
            e.preventDefault();
            run();
            requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
        }
    };

    return (
        <div
            ref={listRef}
            role="tablist"
            aria-label={label}
            onKeyDown={onKeyDown}
            className={cn("relative flex min-w-0 gap-1 overflow-x-auto", className)}
        >
            {items.map(item => {
                const selected = item.value === value;
                return (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        id={`${id}-${item.value}`}
                        aria-selected={selected}
                        aria-controls={`${id}-${item.value}-panel`}
                        tabIndex={selected ? 0 : -1}
                        disabled={item.disabled}
                        onClick={() => onChange(item.value)}
                        className={cn(
                            "flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-label-lg",
                            "m3-state transition-colors duration-short2 ease-standard",
                            "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                            selected ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface",
                            item.disabled && "pointer-events-none text-on-surface/[0.38]",
                        )}
                    >
                        {item.label}
                        {item.count !== undefined ? (
                            <span className={cn("rounded-extra-small px-1.5 text-label-sm tnum", selected ? "bg-surface-container-highest text-on-surface" : "bg-surface-container text-on-surface-variant")}>
                                {item.count.toLocaleString()}
                            </span>
                        ) : null}
                    </button>
                );
            })}
            {/* The underline slides between tabs instead of blinking to the next one. */}
            <span
                aria-hidden
                className="absolute bottom-0 h-0.5 rounded-full bg-on-surface transition-[translate,width] duration-spring-spatial ease-spring-spatial"
                style={{ width: ink.width, translate: `${ink.left}px 0` }}
            />
        </div>
    );
}

export type TabPanelProps = {
    children: ReactNode;
    id?: string;
    labelledBy?: string;
    /**
     * Render every panel and hide the inactive ones instead of rendering only
     * the selected one. For a page whose tab content has to be indexable: a
     * crawler runs no clicks, so a panel that only exists after one does not
     * exist at all. Costs the weight of all panels on first paint, so it is
     * opt-in and not the default.
     */
    hidden?: boolean;
    className?: string;
};

/** The content for the selected tab. Render only the selected one, unless `hidden` says otherwise. */
export function TabPanel({ children, hidden, className, id, labelledBy }: TabPanelProps) {
    return (
        // The `hidden` class too: a caller's `flex`/`grid` class would otherwise beat the attribute and show every panel.
        <div role="tabpanel" id={id} aria-labelledby={labelledBy} tabIndex={0} hidden={hidden} className={cn("focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", className, hidden && "hidden")}>
            {children}
        </div>
    );
}

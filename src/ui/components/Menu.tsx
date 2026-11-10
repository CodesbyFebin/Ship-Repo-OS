"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject } from "react";
import { Check, ChevronRight } from "../symbols";
import type { IconGlyph } from "../primitives/Icon";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { Kbd } from "../primitives/Skeleton";
import { place, useAnchoredPosition, type Placement } from "./position";
import { justClosed, useAwake, type PopoverTriggerProps } from "./Popover";
import { downloadHrefClick } from "./Download";

export type MenuProps = {
    trigger: (props: PopoverTriggerProps) => ReactNode;
    children: ReactNode;
    placement?: Placement;
    /** Names the menu for screen readers, e.g. "Account". */
    label: string;
    className?: string;
    /**
     * Right-click on this element opens the SAME menu at the pointer
     * (Shift+F10 / the Menu key too). One list of items, so the ⋮ menu and
     * the right-click menu can never differ. Text fields and links inside it
     * keep the browser's own menu. A touch long-press does not open it: on a
     * phone that gesture selects, and the ⋮ is always visible.
     */
    contextTarget?: RefObject<HTMLElement | null>;
    /** Leave the items out of the server HTML - see Popover's `clientOnly`. Never for navigation. */
    clientOnly?: boolean;
};

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"]),[role="menuitemradio"]:not([aria-disabled="true"]),[role="menuitemcheckbox"]:not([aria-disabled="true"])';

/**
 * 🔴 A menu inside a draggable tile (the studio grid: drag a picture into the
 * prompt bar) is part of that tile, and a native drag starts from any child:
 * a click on a row that moved a pixel dragged the whole picture and the row
 * never got its click. Switch the drag off until the press ends.
 */
export function holdStill(el: HTMLElement) {
    const tile = el.parentElement?.closest<HTMLElement>('[draggable="true"]');
    if (!tile) return;
    tile.draggable = false;
    const back = () => {
        tile.draggable = true;
        window.removeEventListener("pointerup", back, true);
        window.removeEventListener("pointercancel", back, true);
    };
    window.addEventListener("pointerup", back, true);
    window.addEventListener("pointercancel", back, true);
}

const ownItems = (menu: HTMLElement | null) =>
    Array.from(menu?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []).filter(el => el.closest("[popover]") === menu);

/**
 * A list of actions from a trigger.
 *
 * Keyboard, all from here because the browser does not do it for menus:
 * ↓/↑ move (wrapping), Home/End jump, letters jump to the next item starting
 * with them, Enter/Space run, Esc closes and returns focus to the trigger
 * (the popover API handles Esc and click-outside).
 */
export function Menu({ trigger, children, placement = "bottom-start", label, className, contextTarget, clientOnly }: MenuProps) {
    const awake = useAwake(clientOnly);
    const id = `menu-${useId()}`;
    const anchor = useRef<HTMLElement | null>(null);
    /** What the menu is placed against: the trigger, or the pointer after a right-click. */
    const at = useRef<HTMLElement | null>(null);
    const pop = useRef<HTMLDivElement | null>(null);
    const typed = useRef({ buffer: "", at: 0 });
    const [open, setOpen] = useState(false);
    /** When light dismiss last closed it - see justClosed(). */
    const closedAt = useRef(0);
    /** The close about to happen is a row being chosen, not a click outside. */
    const choosing = useRef(false);
    useAnchoredPosition(at as React.RefObject<HTMLElement>, pop as React.RefObject<HTMLElement>, open, placement);

    useEffect(() => {
        const target = contextTarget?.current;
        if (!target) return;
        const onContext = (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest("input,textarea,select,a[href],[contenteditable]")) return;
            e.preventDefault();
            // A finger's long-press selects (ImageTile); the ⋮ is always
            // shown on touch, so the menu is one tap away there.
            if ((e as PointerEvent).pointerType === "touch") return;
            // A keyboard-opened context menu reports 0,0: use the element itself.
            const r = e.clientX || e.clientY ? new DOMRect(e.clientX, e.clientY, 0, 0) : target.getBoundingClientRect();
            const show = () => {
                at.current = { getBoundingClientRect: () => r } as HTMLElement;
                pop.current?.showPopover();
                if (pop.current) place(at.current, pop.current, "bottom-start", 0);
            };
            // 🔴 macOS fires `contextmenu` on mouse DOWN. Opened there, the
            // mouse-up that follows is a pointerup outside the menu whose
            // pointerdown saw no popover - and the popover API light-dismisses
            // on exactly that, so the menu flashed and vanished. Wait for the
            // button to come up, then open. Windows fires it on mouse up
            // (buttons 0), and a keyboard-opened menu has no button at all.
            if (!e.buttons) { show(); return; }
            const up = () => {
                window.removeEventListener("pointerup", up, true);
                window.removeEventListener("pointercancel", up, true);
                setTimeout(show, 0);
            };
            window.addEventListener("pointerup", up, true);
            window.addEventListener("pointercancel", up, true);
        };
        target.addEventListener("contextmenu", onContext);
        return () => target.removeEventListener("contextmenu", onContext);
    }, [contextTarget]);

    /** This menu's own items - never the ones inside a submenu it holds. */
    const items = useCallback(() => ownItems(pop.current), []);

    const focusAt = useCallback(
        (index: number) => {
            const list = items();
            if (!list.length) return;
            const i = (index + list.length) % list.length;
            list[i].focus();
        },
        [items],
    );

    useEffect(() => {
        const el = pop.current;
        if (!el) return;
        const onToggle = (e: Event) => {
            const next = (e as ToggleEvent).newState === "open";
            setOpen(next);
            if (next) {
                if (!at.current) at.current = anchor.current;
                if (at.current) requestAnimationFrame(() => at.current && place(at.current, el, at.current === anchor.current ? placement : "bottom-start", at.current === anchor.current ? 6 : 0));
                // Focus the current item if there is one, else the first.
                requestAnimationFrame(() => {
                    const list = items();
                    const current = list.findIndex(i => i.getAttribute("aria-checked") === "true");
                    (list[current >= 0 ? current : 0])?.focus();
                });
            } else {
                at.current = null;
                anchor.current?.focus();
            }
        };
        const onBeforeToggle = (e: Event) => {
            if ((e as ToggleEvent).newState !== "closed") return;
            closedAt.current = performance.now();
            // A row was chosen: that click is the menu's own, and the next
            // click anywhere is a new one - never eat it.
            if (choosing.current) { choosing.current = false; return; }
            // 🔴 A click outside closes the menu on pointerup, then the click
            // itself still landed on whatever was under it - a grid tile, which
            // opened the editor (owner, 2026-09-30). Like a desktop menu: that
            // click only closes it.
            const swallow = (ev: MouseEvent) => {
                window.removeEventListener("click", swallow, true);
                if (el.contains(ev.target as Node)) return;
                ev.preventDefault();
                ev.stopPropagation();
            };
            window.addEventListener("click", swallow, true);
            setTimeout(() => window.removeEventListener("click", swallow, true), 300);
        };
        el.addEventListener("toggle", onToggle);
        el.addEventListener("beforetoggle", onBeforeToggle);
        return () => {
            el.removeEventListener("toggle", onToggle);
            el.removeEventListener("beforetoggle", onBeforeToggle);
        };
    }, [items, placement]);

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        // Keys in a menu are the menu's: Enter on a row must not also open the
        // tile or grid it sits in.
        e.stopPropagation();
        const list = items();
        const at = list.indexOf(document.activeElement as HTMLElement);
        if (e.key === "ArrowDown") { e.preventDefault(); focusAt(at + 1); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); focusAt(at - 1); return; }
        if (e.key === "Home") { e.preventDefault(); focusAt(0); return; }
        if (e.key === "End") { e.preventDefault(); focusAt(list.length - 1); return; }
        if (e.key === "Tab") { pop.current?.hidePopover(); return; }
        if (e.key.length === 1 && /\S/.test(e.key)) {
            const now = Date.now();
            typed.current.buffer = now - typed.current.at > 800 ? e.key : typed.current.buffer + e.key;
            typed.current.at = now;
            const q = typed.current.buffer.toLowerCase();
            const from = at + (typed.current.buffer.length > 1 ? 0 : 1);
            const found = list.findIndex((el, i) => i >= from && el.textContent?.trim().toLowerCase().startsWith(q));
            const wrapped = found >= 0 ? found : list.findIndex(el => el.textContent?.trim().toLowerCase().startsWith(q));
            if (wrapped >= 0) { e.preventDefault(); focusAt(wrapped); }
        }
    };

    return (
        <>
            {trigger({
                ref: node => {
                    anchor.current = node;
                },
                onClick: () => {
                    if (justClosed(closedAt.current)) return;
                    at.current = anchor.current;
                    pop.current?.togglePopover();
                },
                "aria-expanded": open,
                "aria-haspopup": "menu",
                "aria-controls": id,
            })}
            <div
                ref={pop}
                id={id}
                popover="auto"
                role="menu"
                aria-label={label}
                onKeyDown={onKeyDown}
                onClick={e => {
                    // 🔴 The popover is drawn INSIDE whatever holds its trigger - a
                    // grid tile, a card. Without this, choosing "Share to X" also
                    // clicked the tile under the menu and opened the picture
                    // editor (2026-09-29). Nothing chosen in a menu is a click
                    // on its host.
                    e.stopPropagation();
                    // Any item that did not stop the event closes the menu.
                    if ((e.target as HTMLElement).closest('[role^="menuitem"]')) { choosing.current = true; pop.current?.hidePopover(); choosing.current = false; }
                }}
                // Same reason: a press held on a row must not start the host
                // tile's long-press (which selects it) or its double-click.
                onPointerDown={e => { e.stopPropagation(); holdStill(e.currentTarget); }}
                onDoubleClick={e => e.stopPropagation()}
                className={cn(
                    // `pointer-events-auto`: the menu sits inside its trigger's
                    // box, and a tile hides that box from taps until hovered -
                    // the menu must never inherit that.
                    "m3-pop pointer-events-auto max-h-[min(26rem,80dvh)] min-w-[13rem] max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto",
                    /* M3 menu (material-web md-comp-menu): `surface-container`, elevation 2. */
                    "rounded-medium border-0 bg-surface-container-lowest py-1.5 px-1.5 text-on-surface shadow-level-3 dark:bg-surface-container-high",
                    className,
                )}
            >
                {awake && children}
            </div>
        </>
    );
}

export type MenuItemProps = {
    children: ReactNode;
    icon?: IconGlyph;
    /** A small picture in the icon's place (24 px): a live motion preview, a swatch. */
    visual?: ReactNode;
    /** Shown right-aligned: a shortcut, a value, a count. */
    hint?: ReactNode;
    shortcut?: string[];
    onSelect?: () => void;
    /**
     * A real link instead of a click handler — a page to open, a file to
     * download. Renders an `<a>` so middle-click, "open in new tab" and (with
     * `download`) the browser's own save-file flow keep working, which a
     * `router.push` in `onSelect` cannot give you.
     */
    href?: string;
    /** Anchor-only: forces a download instead of navigating. */
    download?: string | boolean;
    target?: string;
    disabled?: boolean;
    /** Marks the current choice. Makes this a radio item for screen readers. */
    checked?: boolean;
    /** An on/off row (a checkbox item) instead of a choice. Shows a check when on. */
    toggle?: boolean;
    /** A second line under the label: what this option is for. Makes the row two lines tall. */
    description?: ReactNode;
    destructive?: boolean;
    className?: string;
};

export function MenuItem({ children, icon, visual, hint, shortcut, onSelect, href, download, target, disabled, checked, toggle, description, destructive, className }: MenuItemProps) {
    const Tag = href ? "a" : "button";
    const on = toggle ? !!checked : checked;
    return (
        <Tag
            {...(href ? { href, download, target, rel: target === "_blank" ? "noopener noreferrer" : undefined } : { type: "button" })}
            role={toggle ? "menuitemcheckbox" : checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={toggle ? !!checked : checked}
            aria-disabled={disabled || undefined}
            tabIndex={-1}
            onClick={disabled ? (e: { preventDefault: () => void }) => e.preventDefault() : (e: ReactMouseEvent) => {
                // A file link comes through the download card, not the browser's bare save.
                if (href && download) downloadHrefClick(e, href, download);
                onSelect?.();
            }}
            className={cn(
                // 48dp rows under a finger (M3's touch floor), dense under a mouse.
                "flex w-full min-h-8 items-center gap-2.5 rounded-small px-2.5 text-left text-body-md touch:min-h-12",
                description && "min-h-14 py-2 touch:min-h-14",
                "transition-colors duration-short2 ease-standard",
                // `focus-visible`, not `focus`: the menu focuses its current
                // row when it opens, and after a TAP that left a grey block
                // on it that read as a second selection. Keys still show it.
                "focus:outline-none focus-visible:bg-on-surface/[0.12]",
                "[@media(hover:hover)]:hover:bg-on-surface/[0.08]",
                // The chosen row is M3's selected list item: the secondary
                // container, in both themes - never just a small check.
                on && !toggle && !destructive && "bg-secondary-container text-on-secondary-container [@media(hover:hover)]:hover:bg-secondary-container",
                destructive ? "text-error [@media(hover:hover)]:hover:bg-error-container focus-visible:bg-error-container" : !(on && !toggle) && "text-on-surface",
                disabled && "pointer-events-none text-on-surface/[0.38]",
                className,
            )}
        >
            {visual ? <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center">{visual}</span>
                : icon ? <Icon icon={icon} size="md" hoverFill={!destructive} className={destructive || (on && !toggle) ? undefined : "text-on-surface"} /> : null}
            {description ? (
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{children}</span>
                    <span className={cn("text-label-md", on && !toggle ? "text-on-secondary-container/80" : "text-on-surface-variant")}>{description}</span>
                </span>
            ) : <span className="min-w-0 flex-1 truncate">{children}</span>}
            {shortcut ? (
                <span className="flex gap-1">
                    {shortcut.map(k => (
                        <Kbd key={k}>{k}</Kbd>
                    ))}
                </span>
            ) : null}
            {hint ? <span className={cn("text-label-md", on && !toggle ? "text-on-secondary-container/80" : "text-on-surface-variant")}>{hint}</span> : null}
            {on ? <Icon icon={Check} size="sm" className={toggle ? "text-primary" : undefined} /> : null}
        </Tag>
    );
}

export function MenuSeparator() {
    // Law 11: a group break is space, not a rule. The role stays so a screen
    // reader still announces the grouping a sighted user reads from the gap.
    return <div className="my-2" role="separator" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
    return <p className="px-2.5 pb-1 pt-1.5 text-label-md text-on-surface-variant">{children}</p>;
}

/**
 * A row that opens a second menu beside it - "Download ▸" → PNG, SVG…
 *
 * Opens on hover (a short delay, so passing over it does nothing), on tap,
 * and on → / Enter / Space. ← or Esc closes it and goes back to the row.
 * The flyout sits to the right and drops below the row where there is no
 * room (a phone). It is a popover INSIDE the parent's, so opening it never
 * light-dismisses the parent, and choosing an item closes both.
 */
export function MenuSub({ label, icon, children, disabled }: { label: ReactNode; icon?: IconGlyph; children: ReactNode; disabled?: boolean }) {
    const id = `submenu-${useId()}`;
    const row = useRef<HTMLButtonElement | null>(null);
    const pop = useRef<HTMLDivElement | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [open, setOpen] = useState(false);

    const wait = (fn: () => void, ms: number) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(fn, ms);
    };
    const isOpen = () => !!pop.current?.matches(":popover-open");
    const show = (focusFirst = false) => {
        if (timer.current) clearTimeout(timer.current);
        const el = pop.current;
        if (!el || disabled) return;
        if (!isOpen()) el.showPopover();
        if (row.current) place(row.current, el, "right-start", 2);
        if (focusFirst) requestAnimationFrame(() => ownItems(el)[0]?.focus());
    };
    const hide = (backToRow = false) => {
        if (timer.current) clearTimeout(timer.current);
        if (isOpen()) pop.current?.hidePopover();
        if (backToRow) row.current?.focus();
    };

    useEffect(() => {
        const el = pop.current;
        if (!el) return;
        const onToggle = (e: Event) => setOpen((e as ToggleEvent).newState === "open");
        el.addEventListener("toggle", onToggle);
        return () => el.removeEventListener("toggle", onToggle);
    }, []);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const onSubKey = (e: KeyboardEvent<HTMLDivElement>) => {
        const list = ownItems(pop.current);
        const at = list.indexOf(document.activeElement as HTMLElement);
        const go = (i: number) => list[(i + list.length) % list.length]?.focus();
        if (e.key === "ArrowDown") go(at + 1);
        else if (e.key === "ArrowUp") go(at - 1);
        else if (e.key === "Home") go(0);
        else if (e.key === "End") go(list.length - 1);
        else if (e.key === "ArrowLeft" || e.key === "Escape") hide(true);
        else if (e.key === "Tab") { hide(); return; }
        else return;
        // The parent menu must not act on the same key.
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <>
            <button
                ref={row}
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={id}
                aria-disabled={disabled || undefined}
                tabIndex={-1}
                onPointerEnter={(e) => { if (e.pointerType === "mouse") wait(() => show(), 120); }}
                onPointerLeave={(e) => { if (e.pointerType === "mouse") wait(() => hide(), 250); }}
                // A tap or a click opens - never closes: hover has usually
                // opened it already, and closing it sent the next click onto the
                // picture under it (owner, 2026-09-30). It must not reach the
                // parent's "an item was chosen, close" handler.
                onClick={(e) => { e.stopPropagation(); show(e.detail === 0); }}
                onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); show(true); } }}
                className={cn(
                    "flex w-full min-h-8 items-center gap-2.5 rounded-small px-2.5 text-left text-body-md text-on-surface touch:min-h-11",
                    "transition-colors duration-short2 ease-standard",
                    "focus:outline-none focus:bg-on-surface/[0.08] hover:bg-on-surface/[0.08]",
                    open && "bg-on-surface/[0.08]",
                    disabled && "pointer-events-none text-on-surface/[0.38]",
                )}
            >
                {icon ? <Icon icon={icon} size="md" hoverFill className="text-on-surface" /> : null}
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <Icon icon={ChevronRight} size="sm" className="text-on-surface-variant" />
            </button>
            <div
                ref={pop}
                id={id}
                popover="auto"
                role="menu"
                onKeyDown={onSubKey}
                onPointerEnter={() => { if (timer.current) clearTimeout(timer.current); }}
                onPointerLeave={(e) => { if (e.pointerType === "mouse") wait(() => hide(), 250); }}
                className="m3-pop max-h-[min(26rem,80dvh)] min-w-[11rem] max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-medium border-0 bg-surface-container-lowest p-1.5 text-on-surface shadow-level-3 dark:bg-surface-container-high"
            >
                {children}
            </div>
        </>
    );
}

/**
 * One thing you can do to something, written once and handed to every way
 * of opening its menu
 */
export type MenuAction = {
    key: string;
    label: ReactNode;
    icon?: IconGlyph;
    onSelect?: () => void;
    href?: string;
    download?: string | boolean;
    disabled?: boolean;
    destructive?: boolean;
    checked?: boolean;
    shortcut?: string[];
    hint?: ReactNode;
    /** A second line under the label (MenuItem `description`). */
    description?: ReactNode;
    /** A small picture in the icon's place (MenuItem `visual`). */
    visual?: ReactNode;
    /** Starts a new group: a line above, and this label over it if given. */
    group?: string | true;
    /** A submenu: this row opens these actions beside it (MenuSub). */
    children?: MenuAction[];
};

/** Renders a list of `MenuAction`s as menu items. */
export function MenuActions({ actions }: { actions: MenuAction[] }) {
    return (
        <>
            {actions.map((a, i) => (
                <div key={a.key} role="none" className="contents">
                    {a.group && i > 0 ? <MenuSeparator /> : null}
                    {typeof a.group === "string" ? <MenuLabel>{a.group}</MenuLabel> : null}
                    {a.children ? (
                        <MenuSub label={a.label} icon={a.icon} disabled={a.disabled}>
                            <MenuActions actions={a.children} />
                        </MenuSub>
                    ) : <MenuItem
                        icon={a.icon}
                        visual={a.visual}
                        description={a.description}
                        onSelect={a.onSelect}
                        href={a.href}
                        download={a.download}
                        disabled={a.disabled}
                        destructive={a.destructive}
                        checked={a.checked}
                        shortcut={a.shortcut}
                        hint={a.hint}
                    >
                        {a.label}
                    </MenuItem>}
                </div>
            ))}
        </>
    );
}

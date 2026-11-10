"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../cn";
import { Icon, type IconGlyph } from "../primitives/Icon";
import { CountBadge } from "../primitives/Badge";
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, X } from "../symbols";
import { usePersistedState } from "../components/usePersistedState";
import { interactive } from "../state-layer";

export type ShellLink = { href: string; label: string; icon?: IconGlyph; count?: number; exact?: boolean };
export type ShellGroup = { label?: string; items: ShellLink[] };

const on = (pathname: string, l: ShellLink) => (l.exact || l.href === "/" ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`));

/* ── Sidebar shell ────────────────────────────────────────────────────── */

export type SidebarShellProps = {
    pathname: string;
    /** Logo / product name at the top. */
    brand: ReactNode;
    /** Under the brand: a team switcher, a search button. */
    top?: ReactNode;
    groups: ShellGroup[];
    /** Pinned to the bottom: the profile menu, a usage meter, "Upgrade". */
    footer?: ReactNode;
    /** Right side of the page's top bar: the bell, the ⌘K button, page actions. */
    actions?: ReactNode;
    /** The page title in the top bar. */
    title?: ReactNode;
    children: ReactNode;
    /** Remembers collapsed/open under this key. */
    storageKey?: string;
    /** The shell's own words, for a site in another language. */
    labels?: Partial<typeof SHELL_LABELS>;
};

export const SHELL_LABELS = { open: "Open menu", close: "Close menu", fold: "Fold the sidebar", unfold: "Open the sidebar", main: "Main" };

/**
 * The app frame most SaaS products use: a sidebar of sections on the left, a
 * slim bar above the page. Wide screens: the sidebar stays and folds down to
 * icons (remembered). Phones and tablets: the sidebar slides in from the left
 * over the page, and closes on a pick, Esc or a tap outside.
 *
 * Layout is CSS breakpoints, not JS, so the server sends the right shape and
 * nothing jumps when the page wakes up.
 */
export function SidebarShell({ pathname, brand, top, groups, footer, actions, title, children, storageKey = "shell-sidebar", labels }: SidebarShellProps) {
    const L = { ...SHELL_LABELS, ...labels };
    const [folded, setFolded] = usePersistedState<boolean>(storageKey, false, (v) => typeof v === "boolean");
    const [drawer, setDrawer] = useState(false);
    useEffect(() => setDrawer(false), [pathname]);
    useEffect(() => {
        if (!drawer) return;
        const esc = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    }, [drawer]);

    const nav = (mini: boolean) => (
        <nav aria-label={L.main} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
            {groups.map((g, gi) => (
                <div key={g.label ?? gi} className="flex flex-col gap-0.5">
                    {g.label && !mini ? <p className="px-3 pb-1 pt-2 text-label-sm uppercase tracking-[0.14em] text-on-surface-variant">{g.label}</p> : null}
                    {g.items.map((l) => {
                        const here = on(pathname, l);
                        return (
                            <Link
                                key={l.href}
                                href={l.href}
                                aria-current={here ? "page" : undefined}
                                title={mini ? l.label : undefined}
                                className={cn(
                                    "flex min-h-11 items-center gap-3 rounded-small px-3 text-label-lg",
                                    here ? "bg-inverse-surface text-inverse-on-surface" : cn("text-on-surface-variant hover:text-on-surface", interactive()),
                                    mini && "justify-center px-0",
                                )}
                            >
                                {l.icon ? <Icon icon={l.icon} filled={here} /> : null}
                                {!mini ? <span className="min-w-0 flex-1 truncate">{l.label}</span> : <span className="sr-only">{l.label}</span>}
                                {l.count && !mini ? <CountBadge count={l.count} label={`${l.count} new`} /> : null}
                            </Link>
                        );
                    })}
                </div>
            ))}
        </nav>
    );

    return (
        <div className="flex min-h-dvh bg-surface text-on-surface">
            {/* Wide: the standing sidebar. */}
            <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col bg-surface-container-low transition-[width] duration-medium2 ease-standard expanded:flex", folded ? "w-[4.5rem]" : "w-[17rem]")}>
                <div className={cn("flex h-16 items-center gap-2 px-4", folded && "justify-center px-0")}>
                    {!folded ? <div className="min-w-0 flex-1">{brand}</div> : null}
                    <button type="button" onClick={() => setFolded(!folded)} aria-label={folded ? L.unfold : L.fold} aria-expanded={!folded} className={cn("inline-flex h-10 w-10 items-center justify-center rounded-small text-on-surface-variant", interactive())}>
                        <Icon icon={folded ? PanelLeftOpen : PanelLeftClose} />
                    </button>
                </div>
                {top && !folded ? <div className="px-3 pb-2">{top}</div> : null}
                {nav(folded)}
                {footer ? <div className={cn("p-3", folded && "flex justify-center")}>{footer}</div> : null}
            </aside>

            {/* Phones and tablets: the same sidebar, sliding over the page. */}
            {drawer ? (
                <div className="fixed inset-0 z-50 expanded:hidden">
                    <button type="button" aria-label={L.close} onClick={() => setDrawer(false)} className="absolute inset-0 bg-[rgb(var(--md-sys-color-scrim-rgb)/0.32)]" />
                    <aside role="dialog" aria-modal aria-label={L.main} className="absolute animate-in slide-in-from-left duration-200 rtl:slide-in-from-right inset-y-0 start-0 flex w-[min(20rem,86vw)] flex-col bg-surface-container-low shadow-level-3">
                        <div className="flex h-16 items-center gap-2 px-4">
                            <div className="min-w-0 flex-1">{brand}</div>
                            <button type="button" onClick={() => setDrawer(false)} aria-label={L.close} className={cn("inline-flex h-10 w-10 items-center justify-center rounded-small", interactive())}>
                                <Icon icon={X} />
                            </button>
                        </div>
                        {top ? <div className="px-3 pb-2">{top}</div> : null}
                        {nav(false)}
                        {footer ? <div className="p-3">{footer}</div> : null}
                    </aside>
                </div>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-surface/90 px-gutter backdrop-blur">
                    <button type="button" onClick={() => setDrawer(true)} aria-label={L.open} className={cn("-ms-2 inline-flex h-10 w-10 items-center justify-center rounded-small expanded:hidden", interactive())}>
                        <Icon icon={MenuIcon} />
                    </button>
                    <div className="min-w-0 flex-1 truncate text-title-md">{title}</div>
                    {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
                </header>
                <main className="min-w-0 flex-1 px-gutter pb-12 pt-2">{children}</main>
            </div>
        </div>
    );
}

/* ── Top-bar shell ────────────────────────────────────────────────────── */

export type TopbarShellProps = {
    pathname: string;
    brand: ReactNode;
    links: ShellLink[];
    /** Right side: bell, profile menu. */
    actions?: ReactNode;
    children: ReactNode;
};

/**
 * For products with five or fewer sections: the sections as tabs under the
 * logo, the page full width below. On a phone the tabs scroll sideways in
 * their own row - never a hamburger for five links.
 */
export function TopbarShell({ pathname, brand, links, actions, children }: TopbarShellProps) {
    return (
        <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
            <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur">
                <div className="mx-auto flex h-16 w-full max-w-content items-center gap-3 px-gutter">
                    <div className="min-w-0 flex-1">{brand}</div>
                    {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
                </div>
                <nav aria-label="Main" className="mx-auto w-full max-w-content overflow-x-auto px-gutter [scrollbar-width:none]">
                    <ul className="flex gap-1">
                        {links.map((l) => {
                            const here = on(pathname, l);
                            return (
                                <li key={l.href}>
                                    <Link
                                        href={l.href}
                                        aria-current={here ? "page" : undefined}
                                        className={cn(
                                            "relative flex min-h-12 items-center gap-2 whitespace-nowrap rounded-t-small px-3 text-label-lg",
                                            here ? "text-on-surface after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-primary" : cn("text-on-surface-variant hover:text-on-surface", interactive()),
                                        )}
                                    >
                                        {l.icon ? <Icon icon={l.icon} size="sm" filled={here} /> : null}
                                        {l.label}
                                        {l.count ? <CountBadge count={l.count} label={`${l.count} new`} /> : null}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </header>
            <main className="mx-auto w-full min-w-0 max-w-content flex-1 px-gutter pb-12 pt-6">{children}</main>
        </div>
    );
}

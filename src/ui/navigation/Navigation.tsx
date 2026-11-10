"use client";

import Link from "next/link";
import { createContext, forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { IconGlyph } from "../primitives/Icon";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { CountBadge } from "../primitives/Badge";
import { interactive } from "../state-layer";

/**
 * M3 navigation — https://m3.material.io/components/navigation-bar
 *   · /navigation-rail · /navigation-drawer · /top-app-bar
 *
 * One set of destinations, four presentations, chosen by window size class
 * (§2.6) and never by hand:
 *
 *   compact            NavigationBar  (bottom, 3–5 destinations)
 *   medium, expanded   NavigationRail (left, 80dp)
 *   large, xlarge      NavigationDrawer (left, 360dp, labels always visible)
 *
 * A layout picks one. A page never does — it does not know how wide it is.
 */

/**
 * Opens the app's navigation drawer from anywhere inside the frame.
 *
 * The shell provides it. A page that owns its own top bar (every studio)
 * reads it to put the ☰ in ITS bar, so a phone gets one row of chrome
 * instead of the shell's brand bar stacked on the studio's bar.
 * `null` outside a shell: then there is no drawer to open and no ☰ to show.
 */
export const NavDrawerContext = createContext<(() => void) | null>(null);

export type NavItem = {
    href: string;
    label: string;
    icon: IconGlyph;
    /** The filled version, shown when this destination is the current one. */
    activeIcon?: IconGlyph;
    /** A number on the item: unread, pending, failed. */
    count?: number;
};

const isActive = (pathname: string, href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/* ── Navigation bar (compact) ─────────────────────────────────────────── */

export type NavigationBarProps = {
    items: NavItem[];
    /** The current path, from `usePathname()` in the layout. */
    pathname: string;
    className?: string;
};

/**
 * M3 navigation bar: 80dp tall, at the bottom, 3–5 destinations. The active
 * one gets a `secondary-container` pill behind its icon — that pill IS the
 * indicator, and it is the only thing that says which destination you are on
 * besides the label weight, so it is never removed to "clean it up".
 */
export function NavigationBar({ items, pathname, className }: NavigationBarProps) {
    return (
        <nav
            aria-label="Main"
            className={cn(
                "sticky bottom-0 z-nav flex h-20 w-full shrink-0 items-stretch justify-around gap-1",
                "bg-surface-container px-2 pb-[env(safe-area-inset-bottom)] shadow-level-up",
                className,
            )}
        >
            {items.map(item => {
                const on = isActive(pathname, item.href);
                const Glyph = on ? (item.activeIcon ?? item.icon) : item.icon;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={on ? "page" : undefined}
                        className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 pt-3 rounded-medium", interactive())}
                    >
                        <span
                            className={cn(
                                /* check-design-allow: the indicator pill. The 80dp bar row around it is the target. */
                                "relative flex h-8 w-14 items-center justify-center rounded-small",
                                "transition-[background-color] duration-short4 ease-standard",
                                on ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                            )}
                        >
                            <Icon icon={Glyph} size="md" filled={on} hoverFill />
                            {item.count ? (
                                <CountBadge count={item.count} label={item.label} className="absolute -right-1 top-0" />
                            ) : null}
                        </span>
                        <span className={cn("max-w-full truncate text-label-md", on ? "text-on-surface" : "text-on-surface-variant")}>
                            {item.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}

/* ── Navigation rail (medium / expanded) ──────────────────────────────── */

export type NavigationRailProps = {
    items: NavItem[];
    pathname: string;
    /** A FAB or menu button at the top of the rail. */
    leading?: ReactNode;
    className?: string;
};

/** M3 navigation rail: 80dp wide, on the left, icons with labels underneath. */
export function NavigationRail({ items, pathname, leading, className }: NavigationRailProps) {
    return (
        <nav
            aria-label="Main"
            className={cn(
                "sticky top-0 z-nav flex h-dvh w-20 shrink-0 flex-col items-center gap-3 overflow-y-auto bg-surface py-3",
                className,
            )}
        >
            {leading ? <div className="mb-2">{leading}</div> : null}
            {items.map(item => (
                <NavRailItem key={item.href} {...item} active={isActive(pathname, item.href)} />
            ))}
        </nav>
    );
}

/**
 * One rail destination: the icon in a 56x32 pill, the label underneath. The
 * whole row is the target; hovering shades the pill, tints the icon and fills
 * it. The current one is filled on a `secondary-container` pill.
 */
export function NavRailItem({
    href,
    label,
    icon,
    activeIcon,
    count,
    active,
    onClick,
}: NavItem & { active: boolean; onClick?: () => void }) {
    return (
        <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} className={RAIL_ITEM}>
            <RailFace label={label} icon={icon} activeIcon={activeIcon} count={count} active={active} />
        </Link>
    );
}

/**
 * The same rail item as a button - for a destination that opens a menu
 * (the shell's "New") instead of a page. Spread a Menu trigger's props on it.
 */
export const NavRailButton = forwardRef<
    HTMLButtonElement,
    Omit<NavItem, "href"> & { active?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">
>(function NavRailButton({ label, icon, activeIcon, count, active = false, className, ...rest }, ref) {
    return (
        <button ref={ref} type="button" {...rest} className={cn(RAIL_ITEM, className)}>
            <RailFace label={label} icon={icon} activeIcon={activeIcon} count={count} active={active} />
        </button>
    );
});

const RAIL_ITEM = "m3-rail m3-focus flex w-full flex-col items-center gap-1 rounded-medium py-1";

function RailFace({ label, icon, activeIcon, count, active }: Omit<NavItem, "href"> & { active: boolean }) {
    return (
        <>
            <span
                className={cn(
                    /* check-design-allow: the indicator pill. The rail row around it is the target. */
                    "m3-state m3-rail-pill relative flex h-8 w-12 items-center justify-center rounded-small",
                    "transition-[background-color] duration-short4 ease-standard",
                    active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                )}
            >
                <Icon icon={active ? (activeIcon ?? icon) : icon} size="md" filled={active} hoverFill />
                {count ? <CountBadge count={count} label={label} className="absolute -right-1 top-0" /> : null}
            </span>
            {/* No side padding: the 80dp rail has to fit "Collections" whole. */}
            <span className={cn("max-w-full truncate text-label-md tracking-normal", active ? "text-on-surface" : "text-on-surface-variant")}>
                {label}
            </span>
        </>
    );
}

/* ── Navigation drawer (large+) ───────────────────────────────────────── */

export type NavigationDrawerProps = {
    items: NavItem[];
    pathname: string;
    /** A product mark or a workspace switcher at the top. */
    header?: ReactNode;
    /** Account, settings, sign-out — pinned to the foot. */
    footer?: ReactNode;
    /** Grouped destinations get a heading; pass them as extra children. */
    children?: ReactNode;
    className?: string;
};

/**
 * M3 standard navigation drawer: 360dp, always visible on large windows.
 * Each destination is a 56dp `full`-cornered row — M3's anatomy, and the
 * reason a drawer row is not a list row.
 */
export function NavigationDrawer({ items, pathname, header, footer, children, className }: NavigationDrawerProps) {
    return (
        <nav
            aria-label="Main"
            className={cn("sticky top-0 z-nav flex h-dvh w-[360px] shrink-0 flex-col gap-1 overflow-y-auto bg-surface p-3", className)}
        >
            {header ? <div className="px-4 py-3">{header}</div> : null}
            {items.map(item => {
                const on = isActive(pathname, item.href);
                const Glyph = on ? (item.activeIcon ?? item.icon) : item.icon;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                            "flex h-10 shrink-0 items-center gap-3 rounded-small px-3",
                            "transition-[background-color] duration-short4 ease-standard",
                            on ? "bg-secondary-container text-on-surface" : "text-on-surface-variant",
                            interactive(),
                        )}
                    >
                        <Icon icon={Glyph} size="md" filled={on} hoverFill />
                        <span className="min-w-0 flex-1 truncate text-label-lg">{item.label}</span>
                        {item.count ? <CountBadge count={item.count} label={item.label} /> : null}
                    </Link>
                );
            })}
            {children}
            {footer ? <div className="mt-auto pt-3">{footer}</div> : null}
        </nav>
    );
}

/* ── Top app bar ──────────────────────────────────────────────────────── */

export type TopAppBarProps = {
    title: ReactNode;
    /** Back arrow, menu button or product mark. */
    leading?: ReactNode;
    /** Up to three icon buttons, plus an overflow menu. */
    actions?: ReactNode;
    /**
     * small   64dp, one line — the default.
     * medium  112dp, title on its own line under the actions.
     * large   152dp, display-sized title. For a landing or a detail hero.
     */
    size?: "small" | "medium" | "large";
    /** Raises the bar onto `surface-container` once the page has scrolled. */
    scrolled?: boolean;
    className?: string;
};

export function TopAppBar({ title, leading, actions, size = "small", scrolled, className }: TopAppBarProps) {
    return (
        <header
            className={cn(
                "sticky top-0 z-sticky w-full shrink-0 transition-[background-color] duration-medium2 ease-standard",
                scrolled ? "bg-surface-container" : "bg-surface",
                className,
            )}
        >
            <div className={cn("flex items-center gap-1 px-1", size === "small" ? "h-16" : "h-16")}>
                {leading}
                {size === "small" ? (
                    <h1 className="min-w-0 flex-1 truncate px-3 text-title-lg text-on-surface">{title}</h1>
                ) : (
                    <span className="flex-1" />
                )}
                {actions ? <div className="flex shrink-0 items-center gap-1 px-1">{actions}</div> : null}
            </div>
            {size !== "small" ? (
                <h1
                    className={cn(
                        "px-4 pb-6 text-on-surface",
                        size === "medium" ? "text-headline-sm" : "text-headline-md",
                    )}
                >
                    {title}
                </h1>
            ) : null}
        </header>
    );
}

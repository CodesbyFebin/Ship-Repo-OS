"use client";

import type { ReactNode } from "react";
import { cn } from "../cn";
import { NavigationBar, NavigationDrawer, NavigationRail, type NavItem } from "../navigation/Navigation";
import { useWindowClass } from "../components/position";
import { Card } from "../components/Card";
import { Sheet } from "../components/Sheet";

/**
 * The five layouts. A page picks one and composes inside it; it never builds
 * a shell of its own.
 *
 *   PublicLayout    marketing, docs, legal — a top bar and a footer, no nav.
 *   AppLayout       the signed-in product — destinations by window class.
 *   WorkspaceLayout the studio: a work canvas, an optional inspector, a
 *                   composer docked at the foot. The one arrangement kept
 *                   from the old UI (§1), redrawn entirely in M3.
 *   SettingsLayout  a list of sections beside one pane.
 *   DetailLayout    one thing: an agent, a run, a collection.
 *   AuthLayout      sign-in and approvals: the mark, one card, no navigation.
 *
 * Every one switches navigation on the M3 window size class (§2.6) and
 * reserves the space navigation takes, so nothing shifts when it appears.
 */

/* ── Public ───────────────────────────────────────────────────────────── */

export function PublicLayout({ header, footer, children, className }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={cn("flex min-h-dvh flex-col bg-surface text-on-surface", className)}>
            {header}
            <main className="flex-1">{children}</main>
            {footer}
        </div>
    );
}

/* ── Auth ─────────────────────────────────────────────────────────────── */

/**
 * Sign-in and approval screens (`/login`, `/authorize`). The mark, one card,
 * one line of small print - no navigation, because the page has one job and
 * a nav bar offers a way out of it. Vercel, Linear and Stripe all do this.
 *
 * `brand` sits in the same 64dp band, same corner, as on every other surface,
 * so arriving from the app doesn't make the logo jump. On a phone the card
 * starts near the top (the keyboard needs the bottom half); from `medium` up
 * it's centred.
 */
export function AuthLayout({ brand, footer, children, className }: { brand: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
            <header className="flex h-16 shrink-0 items-center px-6">{brand}</header>
            <main className="flex flex-1 justify-center px-4 pb-8 pt-2 sm:items-center sm:pt-0">
                <Card padding="lg" className={cn("h-fit w-full max-w-[26rem] sm:p-8", className)}>
                    {children}
                </Card>
            </main>
            {footer ? <footer className="px-4 pb-6 text-center text-body-sm text-on-surface-variant">{footer}</footer> : null}
        </div>
    );
}

/* ── App ──────────────────────────────────────────────────────────────── */

export type AppLayoutProps = {
    items: NavItem[];
    /**
     * What the phone's navigation bar shows. M3 allows three to five
     * destinations there, and a product with more than five has to choose —
     * so the choice is made by the app, in one place, not by squeezing the
     * full list into an 80dp bar. Defaults to the first five of `items`.
     */
    compactItems?: NavItem[];
    pathname: string;
    /** The top app bar, built by the page that knows its title. */
    appBar?: ReactNode;
    /** Product mark / workspace switcher, shown in the drawer on large windows. */
    drawerHeader?: ReactNode;
    drawerFooter?: ReactNode;
    /** A FAB or menu button at the top of the rail. */
    railLeading?: ReactNode;
    children: ReactNode;
    className?: string;
};

export function AppLayout({ items, compactItems, pathname, appBar, drawerHeader, drawerFooter, railLeading, children, className }: AppLayoutProps) {
    const w = useWindowClass();
    const drawer = w === "large" || w === "xlarge";
    const rail = w === "medium" || w === "expanded";
    const bar = w === "compact";

    return (
        <div className={cn("flex min-h-dvh bg-surface text-on-surface", className)}>
            {drawer ? <NavigationDrawer items={items} pathname={pathname} header={drawerHeader} footer={drawerFooter} /> : null}
            {rail ? <NavigationRail items={items} pathname={pathname} leading={railLeading} /> : null}
            <div className="flex min-w-0 flex-1 flex-col">
                {appBar}
                <main className="min-w-0 flex-1 px-gutter pb-8">{children}</main>
                {bar ? <NavigationBar items={compactItems ?? items.slice(0, 5)} pathname={pathname} /> : null}
            </div>
        </div>
    );
}

/* ── Workspace ────────────────────────────────────────────────────────── */

export type WorkspaceLayoutProps = {
    /** The tool rail or panel on the left. Hidden on compact, where it becomes a sheet. */
    sidebar?: ReactNode;
    /** The raised work panel — the canvas, the grid, the editor. */
    children: ReactNode;
    /** Slides in from the right when something is selected. */
    inspector?: ReactNode;
    /** Docked at the foot: the prompt bar, the run controls. */
    composer?: ReactNode;
    /** Shown above everything: a title bar with the project name and actions. */
    appBar?: ReactNode;
    className?: string;
};

/**
 * The studio frame. The *arrangement* is the one thing kept from the old UI
 * (plan §1) because it is how the tool works, not how it looked: a sidebar on
 * a canvas, a raised work panel, a detail panel that slides in, a composer at
 * the foot. Every pixel of it is M3 surfaces, spacing and shape.
 *
 * `100dvh` and not `100vh`: on iOS Safari `100vh` is taller than the visible
 * screen, which put the composer under the address bar.
 */
export function WorkspaceLayout({ sidebar, children, inspector, composer, appBar, className }: WorkspaceLayoutProps) {
    const w = useWindowClass();
    const wide = w !== "compact";
    return (
        <div className={cn("flex h-dvh flex-col overflow-hidden bg-surface-dim text-on-surface", className)}>
            {appBar}
            <div className="flex min-h-0 flex-1">
                {wide && sidebar ? <aside className="w-20 shrink-0 overflow-y-auto bg-surface">{sidebar}</aside> : null}
                <main className="min-w-0 flex-1 overflow-hidden p-2">
                    <div className="h-full min-h-0 overflow-auto rounded-large bg-surface-container-low shadow-level-1">{children}</div>
                </main>
                {wide && inspector ? (
                    <aside className="w-[400px] shrink-0 overflow-y-auto bg-surface-container-low">{inspector}</aside>
                ) : null}
            </div>
            {composer ? <div className="shrink-0 bg-surface-container-low px-gutter py-2 shadow-level-up">{composer}</div> : null}
        </div>
    );
}

/* ── Settings ─────────────────────────────────────────────────────────── */

export type SettingsLayoutProps = {
    /** The section list. A row of tabs on compact, a column on wider windows. */
    sections: ReactNode;
    title?: ReactNode;
    children: ReactNode;
    className?: string;
};

export function SettingsLayout({ sections, title, children, className }: SettingsLayoutProps) {
    return (
        <div className={cn("mx-auto w-full max-w-content px-gutter py-6", className)}>
            {title ? <h1 className="mb-6 text-headline-sm text-on-surface">{title}</h1> : null}
            <div className="flex flex-col gap-6 expanded:flex-row">
                <div className="shrink-0 expanded:w-64">{sections}</div>
                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </div>
    );
}

/* ── Detail ───────────────────────────────────────────────────────────── */

export type DetailLayoutProps = {
    /** The hero: name, price, state, the primary action. */
    header: ReactNode;
    children: ReactNode;
    /** Facts beside the content on wide windows, under it on a phone. */
    aside?: ReactNode;
    className?: string;
};

/**
 * One thing, in full. The aside comes *after* the main content in the DOM, so
 * a screen reader and a phone both get the thing itself before its metadata —
 * and CSS order puts it on the right when there is room.
 */
export function DetailLayout({ header, children, aside, className }: DetailLayoutProps) {
    return (
        <div className={cn("mx-auto w-full max-w-content px-gutter py-6", className)}>
            {header}
            <div className="mt-6 flex flex-col gap-6 expanded:flex-row">
                <div className="min-w-0 flex-1">{children}</div>
                {aside ? <div className="shrink-0 expanded:w-80">{aside}</div> : null}
            </div>
        </div>
    );
}

/* ── Canonical: list-detail ───────────────────────────────────────────── */

export type ListDetailProps = {
    /** The list. Always rendered — on a phone it IS the page. */
    list: ReactNode;
    /** The selected thing. `null` on a wide screen shows `empty` instead. */
    detail?: ReactNode;
    /** What the detail pane shows when nothing is selected. Never a blank half. */
    empty?: ReactNode;
    /** True when something is selected — on compact this is what swaps the panes. */
    selected?: boolean;
    /** Compact only: the back affordance above the detail. */
    onBack?: () => void;
    /** Width of the list pane from `medium` up. M3's own figure is 360dp. */
    listWidth?: string;
    className?: string;
};

/**
 * Android's **list-detail** canonical layout —
 * github.com/android/user-interface-samples/tree/main/CanonicalLayouts
 *
 * Compact: one pane. The list is the page; choosing something replaces it with
 * the detail, and back returns. Both panes stay MOUNTED — only one is shown —
 * so the list keeps its scroll position and its filters when you come back.
 * Unmounting it is the bug every hand-rolled version of this ships with.
 *
 * Medium and up: both panes at once, the list fixed and the detail filling.
 *
 * 🔴 Selection belongs in the URL, not in this component. The caller passes
 * `selected`, so a deep link opens the right pane and back/forward work — a
 * `useState` version breaks both.
 */
export function ListDetail({ list, detail, empty, selected, onBack, listWidth = "w-[360px]", className }: ListDetailProps) {
    const w = useWindowClass();
    const twoPane = w !== "compact";

    if (!twoPane) {
        return (
            <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
                {/* `hidden`, not unmounted: scroll position and filters survive. */}
                <div className={cn("min-h-0 flex-1", selected && "hidden")}>{list}</div>
                {selected ? (
                    <div className="flex min-h-0 flex-1 flex-col">
                        {onBack ? (
                            <div className="shrink-0 px-2 py-1">
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="m3-state m3-focus inline-flex min-h-touch items-center gap-1 rounded-full px-3 text-label-lg text-on-surface outline-none"
                                >
                                    ← Back
                                </button>
                            </div>
                        ) : null}
                        <div className="min-h-0 flex-1">{detail}</div>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div className={cn("flex min-h-0 flex-1", className)}>
            <div className={cn("min-h-0 shrink-0 overflow-y-auto", listWidth)}>{list}</div>
            {/* One container step apart — law 11 put the divider here. */}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-surface-container-low">
                {selected ? detail : empty}
            </div>
        </div>
    );
}

/* ── Canonical: supporting pane ───────────────────────────────────────── */

export type SupportingPaneProps = {
    /** The work itself. Owns the room on every size. */
    children: ReactNode;
    /** The help: an inspector, filters, details. Never required to use the page. */
    supporting: ReactNode;
    /** Compact only: is the bottom sheet open. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    /** The sheet's title on compact. */
    title?: ReactNode;
    className?: string;
};

/**
 * Android's **supporting pane** canonical layout.
 *
 * Expanded and up: a permanent 360dp pane beside the work.
 * Compact and medium: the same content in a bottom sheet at half height, with
 * a drag handle — because a phone has no room for two columns, and a side
 * sheet on a 360px screen is the whole screen with extra steps.
 *
 * The sheet is a native `<dialog>`, so the browser supplies the top layer, the
 * focus trap, Esc, and `inert` on the page behind it. `amnt-kb-lift` keeps it
 * above the on-screen keyboard.
 */
export function SupportingPane({ children, supporting, open, onOpenChange, title, className }: SupportingPaneProps) {
    const w = useWindowClass();
    const side = w === "expanded" || w === "large" || w === "xlarge";

    if (side) {
        return (
            <div className={cn("flex min-h-0 flex-1", className)}>
                <div className="min-h-0 min-w-0 flex-1">{children}</div>
                <aside className="min-h-0 w-[360px] shrink-0 overflow-y-auto bg-surface-container-low">{supporting}</aside>
            </div>
        );
    }

    return (
        <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
            <div className="min-h-0 flex-1">{children}</div>
            <Sheet
                open={Boolean(open)}
                onClose={() => onOpenChange?.(false)}
                placement="bottom"
                size="md"
                title={title ?? "Details"}
            >
                {supporting}
            </Sheet>
        </div>
    );
}

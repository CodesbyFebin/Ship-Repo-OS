import type { ReactNode } from "react";
import { cn } from "../cn";
import { lift } from "../state-layer";

export type CardProps = {
    /** Turns the whole card into one hit target. Use with an <a> inside for the real link. */
    interactive?: boolean;
    /**
     * Which step of the container ladder the card sits on. A card is told apart
     * from the page by its FILL, never by a border (law 11), so the step has to
     * clear the page by two — `surface` → `surface-container` is the default
     * pair. `high` is for a card on a page that is already a container;
     * `page` is the flat, unraised case (a card on the studio canvas).
     */
    surface?: "card" | "high" | "page";
    padding?: "none" | "sm" | "md" | "lg";
    className?: string;
    children: ReactNode;
};

const PAD = { none: "", sm: "p-3", md: "p-4", lg: "p-5" } as const;

/**
 * 🔴 Two steps, not one. In light mode `surface` is #FDF7FF and
 * `surface-container-low` is #F8F2FA — a borderless card drawn on that pair is
 * invisible. `surface-container` (#F2ECF4) is the first step that reads.
 */
const SURFACE = {
    card: "bg-surface-container",
    high: "bg-surface-container-high",
    page: "bg-surface",
} as const;

/**
 * A contained surface: one thing, its details, and at most one action.
 *
 * Not everything is a Card. Border, fill and shadow each say "separate
 * object" - spending them on every block flattens the page. A list of rows is
 * a List; a page section is a Section.
 */
export function Card({ interactive, surface = "card", padding = "md", className, children }: CardProps) {
    return (
        <div
            className={cn(
                // min-w-0: a grid/flex child defaults to min-width:auto, so one long
                // word inside (a URL, a wallet id) makes the card wider than the screen.
                "min-w-0 rounded-medium",
                SURFACE[surface],
                PAD[padding],
                // Hover is `lift`: a colour step, a shape morph and a rise -
                // never a border appearing. See state-layer.ts.
                interactive && lift,
                className,
            )}
        >
            {children}
        </div>
    );
}

export type PanelProps = { className?: string; children: ReactNode };

/**
 * The raised working surface an app screen sits on: the counterpart to the
 * canvas behind the sidebar. One per screen.
 */
export function Panel({ className, children }: PanelProps) {
    return <div className={cn("min-w-0 rounded-large bg-surface-container-low shadow-level-1", className)}>{children}</div>;
}

export type SectionProps = {
    title?: ReactNode;
    description?: ReactNode;
    /** Buttons or filters that belong to this section. */
    actions?: ReactNode;
    className?: string;
    children: ReactNode;
};

/** A titled block within a page. Spacing comes from the system, not the page. */
export function Section({ title, description, actions, className, children }: SectionProps) {
    return (
        <section className={cn("flex min-w-0 flex-col gap-4", className)}>
            {title || actions ? (
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                        {title ? <h2 className="text-headline-sm text-on-surface">{title}</h2> : null}
                        {description ? <p className="mt-1 max-w-measure text-body-md text-on-surface-variant">{description}</p> : null}
                    </div>
                    {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
                </div>
            ) : null}
            {children}
        </section>
    );
}

export type PageHeaderProps = {
    title: ReactNode;
    /** One line: what this page is for, or what state it is in. */
    description?: ReactNode;
    /** Where the user is. Keep it to two or three levels. */
    breadcrumb?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
    className?: string;
};

/** The top of a page: where am I, what is this, what can I do. */
export function PageHeader({ title, description, breadcrumb, meta, actions, className }: PageHeaderProps) {
    return (
        <header className={cn("flex min-w-0 flex-col gap-3", className)}>
            {breadcrumb}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-headline-lg text-on-surface">{title}</h1>
                    {description ? <p className="mt-1.5 max-w-measure text-body-md text-on-surface-variant">{description}</p> : null}
                    {meta ? <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-md text-on-surface-variant">{meta}</div> : null}
                </div>
                {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
            </div>
        </header>
    );
}

export type BreadcrumbProps = { items: Array<{ label: ReactNode; href?: string }>; className?: string };

/** Where you are, and the way back. Never more than three levels deep. */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
    return (
        <nav aria-label="Breadcrumb" className={cn("flex min-w-0 items-center gap-1 text-label-md text-on-surface-variant", className)}>
            {items.map((item, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1">
                    {i > 0 ? (
                        <span aria-hidden className="opacity-50">
                            /
                        </span>
                    ) : null}
                    {item.href ? (
                        <a
                            href={item.href}
                            className="truncate rounded-extra-small px-1 py-0.5 transition-colors duration-short2 ease-standard hover:bg-on-surface/[0.08] hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                        >
                            {item.label}
                        </a>
                    ) : (
                        <span aria-current="page" className="truncate px-1 py-0.5 text-on-surface">
                            {item.label}
                        </span>
                    )}
                </span>
            ))}
        </nav>
    );
}

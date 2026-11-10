import Link from "next/link";
import type { ReactNode } from "react";
import type { IconGlyph } from "../primitives/Icon";
import { Icon } from "../primitives/Icon";
import { cn } from "../cn";
import { interactive } from "../state-layer";

export type NavListItem = {
    key: string;
    label: string;
    icon: IconGlyph;
    /** A link row. Give `href` or `onSelect`, not both. */
    href?: string;
    /** A button row, for navigation that is not a URL (the settings popup). */
    onSelect?: () => void;
    /** This row is where you are: filled icon, secondary-container, `aria-current`. */
    current?: boolean;
    /** After the label: a count, or a › on a phone list. */
    trailing?: ReactNode;
};

export type NavListGroup = {
    key: string;
    /** Omit on the first group when the page title already names it. */
    label?: string;
    items: NavListItem[];
};

const ROW =
    /* A 40dp row with an 8px corner (2026-10-09): dense like a pro sidebar. */
    "flex h-12 w-full shrink-0 items-center gap-3 rounded-small px-3 text-left text-label-lg medium:h-10 " +
    "transition-[background-color] duration-short4 ease-standard";

/**
 * The section list of a page that has sections — M3's navigation drawer rows,
 * inside the page instead of at the window's edge. The settings popup and
 * My stuff both use it, so the two can never drift.
 *
 * No client JS of its own: link rows are plain links, and the caller works out
 * `current` (from the pathname, or from state).
 */
export function NavList({ label, groups, className }: { label: string; groups: NavListGroup[]; className?: string }) {
    return (
        <nav aria-label={label} className={cn("flex min-w-0 flex-col gap-2", className)}>
            {groups.map((g) => (
                <div key={g.key} className="flex flex-col">
                    {g.label ? <p className="px-3 pb-1 pt-3 text-label-md text-on-surface-variant">{g.label}</p> : null}
                    {g.items.map((it) => {
                        const cls = cn(ROW, it.current ? "bg-secondary-container text-on-surface" : "text-on-surface-variant", interactive());
                        const inner = (
                            <>
                                <Icon icon={it.icon} size="sm" filled={it.current} />
                                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                                {it.trailing}
                            </>
                        );
                        return it.href ? (
                            <Link key={it.key} href={it.href} aria-current={it.current ? "page" : undefined} className={cls}>
                                {inner}
                            </Link>
                        ) : (
                            <button key={it.key} type="button" onClick={it.onSelect} aria-current={it.current ? "page" : undefined} className={cls}>
                                {inner}
                            </button>
                        );
                    })}
                </div>
            ))}
        </nav>
    );
}

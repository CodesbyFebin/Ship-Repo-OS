import Link from "next/link";
import { ChevronDown } from "../symbols";
import type { IconGlyph } from "../primitives/Icon";
import { Icon } from "../primitives/Icon";
import { interactive } from "../state-layer";
import { cn } from "../cn";

export type NavMenuLink = { label: string; href: string; icon: IconGlyph; desc?: string };
export type NavMenuGroup = { title?: string; items: NavMenuLink[] };

const isExternal = (href: string) => href.startsWith("http");

/**
 * The site header's "Products ▾ / Resources ▾" panel.
 *
 * Not `Menu`: that is a list of ACTIONS (role=menuitem, arrow keys). This is a
 * list of LINKS, so it stays plain links in a <nav> and opens on hover or on
 * keyboard focus with CSS alone - server-rendered, zero client JS.
 *
 * ponytail: no Esc-to-close (focus leaving closes it). Add a client island if
 * that is ever reported.
 */
export function NavMenu({ label, groups }: { label: string; groups: NavMenuGroup[] }) {
    return (
        <div className="group/nav relative">
            <button
                type="button"
                className="flex min-h-touch items-center gap-1 whitespace-nowrap rounded-extra-small text-label-lg text-on-surface-variant transition-state duration-short4 ease-standard hover:text-on-surface group-focus-within/nav:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
                {label}
                <Icon icon={ChevronDown} className="h-4 w-4 transition-transform duration-short4 ease-standard group-hover/nav:rotate-180 group-focus-within/nav:rotate-180" />
            </button>
            {/* pt-2 is a hover bridge: the pointer crosses it without leaving the group. */}
            <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-[opacity,visibility] duration-short4 ease-standard group-hover/nav:visible group-hover/nav:opacity-100 group-focus-within/nav:visible group-focus-within/nav:opacity-100">
                <div className="flex gap-2 rounded-large bg-surface-container-lowest p-2 shadow-level-3 dark:bg-surface-container-high">
                    <NavMenuGroups groups={groups} className="flex-row" />
                </div>
            </div>
        </div>
    );
}

/** The groups on their own - the header panel lays them side by side, the
 *  phone menu stacks them. `compact` drops the one-line descriptions. */
export function NavMenuGroups({ groups, compact, className }: { groups: NavMenuGroup[]; compact?: boolean; className?: string }) {
    return (
        <div className={cn("flex flex-col gap-2", className)}>
            {groups.map((g, i) => (
                <div key={g.title ?? i} className={compact ? undefined : "w-64"}>
                    {g.title && <p className="px-3 pb-1 pt-2 text-label-sm uppercase tracking-wider text-on-surface-variant">{g.title}</p>}
                    <ul>
                        {g.items.map((item) => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    target={isExternal(item.href) ? "_blank" : undefined}
                                    rel={isExternal(item.href) ? "noopener noreferrer" : undefined}
                                    className={cn("group/item flex min-h-touch items-center gap-3 rounded-medium p-2 text-on-surface", interactive())}
                                >
                                    {/* One ink at rest, AMNT blue under the pointer (ui.css) - like every menu. */}
                                    <span className="flex aspect-square w-9 shrink-0 items-center justify-center rounded-medium bg-surface-container-high text-on-surface">
                                        <Icon icon={item.icon} className="h-5 w-5" hoverFill />
                                    </span>
                                    <span className="flex min-w-0 flex-col">
                                        <span className="text-label-lg text-on-surface">
                                            {item.label}
                                            {isExternal(item.href) && <span aria-hidden="true"> ↗</span>}
                                        </span>
                                        {!compact && item.desc && <span className="text-body-sm text-on-surface-variant">{item.desc}</span>}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

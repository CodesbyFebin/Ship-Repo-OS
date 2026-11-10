"use client";

import { useMemo, useState } from "react";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import * as all from "../primitives/symbols.generated";
import type { Glyph } from "../primitives/symbols.generated";
import { Popover } from "./Popover";
import { Search } from "./Input";
import { interactive } from "../state-layer";

/**
 * Every icon in the set, by its export name ("Calendar", "Rocket").
 * ⚠️ Importing this pulls in the whole set (~60 KB gzipped). Fine on a
 * settings page or the design-system page; never on the home page.
 */
let cache: Record<string, Glyph> | null = null;
/* A function, not a module-level constant: a constant built at import time
   would put all 339 icons in every page that imports anything from @/ui. */
export function allIcons(): Record<string, Glyph> {
    return (cache ??= Object.fromEntries(
        Object.entries(all).filter((e): e is [string, Glyph] => typeof e[1] === "object" && e[1] !== null && "d" in e[1]),
    ));
}

export type IconGridProps = {
    value?: string | null;
    onChange: (name: string) => void;
    /** Limit the choice; leave out for every icon. */
    icons?: Record<string, Glyph>;
    className?: string;
};

/** Search box + grid of icons. Finds by the export name and the Material name ("bar_chart"). */
export function IconGrid({ value, onChange, icons, className }: IconGridProps) {
    const [q, setQ] = useState("");
    const list = useMemo(() => {
        const needle = q.toLowerCase().replace(/[\s_-]/g, "");
        return Object.entries(icons ?? allIcons()).filter(([name, g]) => !needle || name.toLowerCase().includes(needle) || g.n.replace(/_/g, "").includes(needle));
    }, [icons, q]);
    return (
        <div className={cn("flex min-w-0 flex-col gap-3", className)}>
            <Search label="Search icons" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} />
            <p className="text-label-md text-on-surface-variant tnum" aria-live="polite">{list.length} icons</p>
            <div role="listbox" aria-label="Icons" className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1 overflow-y-auto">
                {list.map(([name, g]) => (
                    <button
                        key={name}
                        type="button"
                        role="option"
                        aria-selected={value === name}
                        title={name}
                        aria-label={name}
                        onClick={() => onChange(name)}
                        className={cn("flex h-12 items-center justify-center rounded-small", value === name ? "bg-primary text-on-primary" : cn("text-on-surface", interactive()))}
                    >
                        <Icon icon={g} />
                    </button>
                ))}
            </div>
        </div>
    );
}

/** A field that shows the picked icon and opens the grid. Stores the icon's name. */
export function IconPicker({ label, value, onChange, icons, className }: IconGridProps & { label: string }) {
    const [open, setOpen] = useState(false);
    const g = value ? (icons ?? allIcons())[value] : null;
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            label={label}
            className="w-[min(22rem,calc(100vw-1rem))] max-w-none p-3"
            trigger={(p) => (
                <button {...p} type="button" className={cn("flex h-14 min-w-0 items-center gap-3 rounded-small bg-surface-container px-4 text-left hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", className)}>
                    <span className="flex h-8 w-8 items-center justify-center bg-inverse-surface text-inverse-on-surface">{g ? <Icon icon={g} size="sm" /> : null}</span>
                    <span className="min-w-0">
                        <span className="block text-label-md text-on-surface-variant">{label}</span>
                        <span className="block truncate text-body-lg text-on-surface">{value ?? "None"}</span>
                    </span>
                </button>
            )}
        >
            <IconGrid value={value} icons={icons} onChange={(n) => { onChange(n); setOpen(false); }} />
        </Popover>
    );
}

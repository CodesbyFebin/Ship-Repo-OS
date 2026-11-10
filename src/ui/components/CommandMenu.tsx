"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "../cn";
import { Icon, type IconGlyph } from "../primitives/Icon";
import { Kbd } from "../primitives/Skeleton";
import { Search as SearchIcon } from "../symbols";

export type CommandItem = {
    id: string;
    label: string;
    /** The heading it sits under: "Pages", "Actions", "Account". */
    group?: string;
    icon?: IconGlyph;
    /** Other words that should find it: "billing" finds "Top up". */
    keywords?: string[];
    /** Shown on the right, e.g. ["G", "D"]. Display only. */
    shortcut?: string[];
    href?: string;
    onSelect?: () => void;
};

/** How well `q` matches `text`: letters in order, earlier and closer is better. 0 = no match. */
export function fuzzy(q: string, text: string): number {
    q = q.toLowerCase(); text = text.toLowerCase();
    if (!q) return 1;
    const at = text.indexOf(q);
    if (at >= 0) return 100 - at;
    let score = 0, last = -1;
    for (const ch of q) {
        const i = text.indexOf(ch, last + 1);
        if (i < 0) return 0;
        score += i === last + 1 ? 3 : 1;
        last = i;
    }
    return score;
}

/** ⌘K on a Mac, Ctrl+K elsewhere. Typing in a field doesn't trigger it. */
export function useCommandHotkey(open: () => void, key = "k") {
    useEffect(() => {
        const on = (e: globalThis.KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) { e.preventDefault(); open(); }
        };
        window.addEventListener("keydown", on);
        return () => window.removeEventListener("keydown", on);
    }, [open, key]);
}

export type CommandMenuProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: CommandItem[];
    placeholder?: string;
    /** What the list says when nothing matches. */
    empty?: string;
};

/**
 * The command menu: one box that finds any page or action. A native modal
 * <dialog>, so Esc, the focus trap and the dimmed page come from the browser.
 * The list is a real listbox; the field keeps focus and arrows move the pick.
 */
export function CommandMenu({ open, onOpenChange, items, placeholder = "Search pages and actions", empty = "Nothing found. Try another word." }: CommandMenuProps) {
    const router = useRouter();
    const dialog = useRef<HTMLDialogElement>(null);
    const field = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const uid = useId();
    const [q, setQ] = useState("");
    const [active, setActive] = useState(0);

    useEffect(() => {
        const d = dialog.current;
        if (!d) return;
        if (open && !d.open) { d.showModal(); setQ(""); setActive(0); requestAnimationFrame(() => field.current?.focus()); }
        if (!open && d.open) d.close();
    }, [open]);

    const shown = useMemo(() => {
        const scored = items
            .map((it) => ({ it, s: Math.max(fuzzy(q, it.label), ...(it.keywords ?? []).map((k) => fuzzy(q, k) * 0.8)) }))
            .filter((x) => x.s > 0);
        if (q) scored.sort((a, b) => b.s - a.s);
        return scored.map((x) => x.it);
    }, [items, q]);

    /* Group in the order groups first appear, so the best match's group leads. */
    const groups = useMemo(() => {
        const m = new Map<string, CommandItem[]>();
        for (const it of shown) m.set(it.group ?? "", [...(m.get(it.group ?? "") ?? []), it]);
        return [...m.entries()];
    }, [shown]);
    const flat = groups.flatMap(([, g]) => g);

    useEffect(() => { setActive(0); }, [q]);
    useEffect(() => {
        list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const run = (it: CommandItem | undefined) => {
        if (!it) return;
        onOpenChange(false);
        if (it.href) router.push(it.href);
        it.onSelect?.();
    };

    const onKey = (e: KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        if (e.key === "Home") { e.preventDefault(); setActive(0); }
        if (e.key === "End") { e.preventDefault(); setActive(flat.length - 1); }
        if (e.key === "Enter") { e.preventDefault(); run(flat[active]); }
    };

    let i = -1;
    return (
        <dialog
            ref={dialog}
            aria-label="Command menu"
            onClose={() => onOpenChange(false)}
            onClick={(e) => { if (e.target === dialog.current) onOpenChange(false); }}
            className="mx-auto mt-[12vh] animate-in fade-in zoom-in-95 duration-150 w-[min(36rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-large bg-surface-container-lowest p-0 text-on-surface shadow-level-3 backdrop:bg-[rgb(var(--md-sys-color-scrim-rgb)/0.25)]dark:bg-surface-container-high"
        >
            <div className="flex items-center gap-3 px-4">
                <Icon icon={SearchIcon} className="text-on-surface-variant" />
                <input
                    ref={field}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={onKey}
                    placeholder={placeholder}
                    role="combobox"
                    aria-expanded
                    aria-controls={`${uid}-list`}
                    aria-activedescendant={flat.length ? `${uid}-${active}` : undefined}
                    aria-autocomplete="list"
                    className="h-14 min-w-0 flex-1 bg-transparent text-body-lg text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                <Kbd>Esc</Kbd>
            </div>
            <ul ref={list} id={`${uid}-list`} role="listbox" aria-label="Results" className="max-h-[min(24rem,60dvh)] overflow-y-auto border-t border-outline-variant p-2">
                {!flat.length ? <li className="px-3 py-8 text-center text-body-md text-on-surface-variant">{empty}</li> : null}
                {groups.map(([g, its]) => (
                    <li key={g} role="presentation">
                        {g ? <p className="px-3 pb-1 pt-3 text-label-md uppercase tracking-[0.12em] text-on-surface-variant">{g}</p> : null}
                        <ul role="group" aria-label={g || undefined}>
                            {its.map((it) => {
                                i += 1;
                                const n = i;
                                return (
                                    <li
                                        key={it.id}
                                        id={`${uid}-${n}`}
                                        data-i={n}
                                        role="option"
                                        aria-selected={n === active}
                                        onMouseMove={() => setActive(n)}
                                        onClick={() => run(it)}
                                        className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-small px-3 text-body-md", n === active ? "bg-on-surface/[0.08]" : "")}
                                    >
                                        {it.icon ? <Icon icon={it.icon} className="text-on-surface-variant" /> : null}
                                        <span className="min-w-0 flex-1 truncate">{it.label}</span>
                                        {it.shortcut ? <span className="flex gap-1">{it.shortcut.map((k) => <Kbd key={k}>{k}</Kbd>)}</span> : null}
                                    </li>
                                );
                            })}
                        </ul>
                    </li>
                ))}
            </ul>
            <p className="flex gap-4 border-t border-outline-variant px-4 py-2 text-label-sm text-on-surface-variant">
                <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> move</span>
                <span><Kbd>Enter</Kbd> open</span>
            </p>
        </dialog>
    );
}

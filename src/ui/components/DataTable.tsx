"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { Skeleton } from "../primitives/Skeleton";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "../symbols";
import { interactive } from "../state-layer";
import { Search } from "./Input";

/* ── Pagination ───────────────────────────────────────────────────────── */

/** The table's own words, for a site in another language. "{n}" is a number. */
export const TABLE_LABELS = { of: "of", picked: "{n} picked", clear: "Clear", pickAll: "Pick every row on this page", pickRow: "Pick this row", prev: "Previous page", next: "Next page", pages: "Pages" };

export type PaginationProps = {
    /** 1-based. */
    page: number;
    pages: number;
    onChange: (page: number) => void;
    /** "41–60 of 213", shown on the left. */
    summary?: ReactNode;
    labels?: Partial<typeof TABLE_LABELS>;
    className?: string;
};

/** 1 … 4 5 6 … 20: the first, the last, and two either side of here. */
function pageList(page: number, pages: number): (number | "…")[] {
    const want = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
    const out: (number | "…")[] = [];
    [...want].sort((a, b) => a - b).forEach((p, i, a) => {
        if (i && p - a[i - 1] > 1) out.push("…");
        out.push(p);
    });
    return out;
}

export function Pagination({ page, pages, onChange, summary, labels, className }: PaginationProps) {
    const L = { ...TABLE_LABELS, ...labels };
    if (pages <= 1 && !summary) return null;
    const btn = cn("inline-flex h-10 min-w-10 items-center justify-center rounded-small px-2 text-label-lg tnum", interactive(), "disabled:pointer-events-none disabled:opacity-[0.38]");
    return (
        <nav aria-label={L.pages} className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
            <p className="text-body-sm text-on-surface-variant tnum">{summary}</p>
            {pages > 1 ? (
                <ul className="flex items-center gap-1">
                    <li><button type="button" className={btn} aria-label={L.prev} disabled={page <= 1} onClick={() => onChange(page - 1)}><Icon icon={ChevronLeft} className="rtl:rotate-180" /></button></li>
                    {pageList(page, pages).map((p, i) => (
                        <li key={i} className="hidden medium:block">
                            {p === "…" ? <span className="px-2 text-on-surface-variant">…</span> : (
                                <button type="button" className={cn(btn, p === page && "bg-primary text-on-primary")} aria-current={p === page ? "page" : undefined} onClick={() => onChange(p)}>{p}</button>
                            )}
                        </li>
                    ))}
                    <li className="px-2 text-label-lg tnum text-on-surface medium:hidden">{page} / {pages}</li>
                    <li><button type="button" className={btn} aria-label={L.next} disabled={page >= pages} onClick={() => onChange(page + 1)}><Icon icon={ChevronRight} className="rtl:rotate-180" /></button></li>
                </ul>
            ) : null}
        </nav>
    );
}

/* ── Data table ───────────────────────────────────────────────────────── */

export type DataColumn<Row> = {
    key: string;
    header: string;
    cell: (row: Row) => ReactNode;
    /** Makes the header a sort button. Return what to sort by. */
    sort?: (row: Row) => string | number;
    numeric?: boolean;
    hideOnPhone?: boolean;
    width?: string;
};

export type Sort = { key: string; dir: "asc" | "desc" } | null;

export type DataTableProps<Row> = {
    label: string;
    columns: DataColumn<Row>[];
    rows: Row[];
    rowKey: (row: Row) => string;
    /** The words a row is found by. Leave out to hide the search box. */
    searchText?: (row: Row) => string;
    searchLabel?: string;
    pageSize?: number;
    /** Checkboxes on each row; `bulk` gets the picked rows. */
    selectable?: boolean;
    bulk?: (picked: Row[], clear: () => void) => ReactNode;
    /** Filters or a button, beside the search box. */
    toolbar?: ReactNode;
    onRowClick?: (row: Row) => void;
    empty?: ReactNode;
    loading?: boolean;
    /**
     * Server mode: the server searched, sorted and paged already. Pass the
     * page's rows in `rows`, the full count in `total`, and handle the three
     * callbacks. Without it, all of that happens here.
     */
    labels?: Partial<typeof TABLE_LABELS>;
    server?: {
        total: number;
        page: number;
        onPage: (page: number) => void;
        sort: Sort;
        onSort: (sort: Sort) => void;
        query: string;
        onQuery: (q: string) => void;
    };
    className?: string;
};

/**
 * A table you can work in: search, sort by any column, page through, tick
 * rows and act on them together. Still a real <table>; on a phone it scrolls
 * inside its own box and `hideOnPhone` columns drop out first.
 */
export function DataTable<Row>({ label, columns, rows, rowKey, searchText, searchLabel = "Search", pageSize = 20, selectable, bulk, toolbar, onRowClick, empty, loading, server, labels, className }: DataTableProps<Row>) {
    const L = { ...TABLE_LABELS, ...labels };
    const [q, setQ] = useState("");
    const [sort, setSort] = useState<Sort>(null);
    const [page, setPage] = useState(1);
    const [picked, setPicked] = useState<Set<string>>(new Set());

    const query = server?.query ?? q;
    const activeSort = server ? server.sort : sort;

    const view = useMemo(() => {
        if (server) return rows;
        let out = rows;
        if (q && searchText) {
            const needle = q.toLowerCase();
            out = out.filter((r) => searchText(r).toLowerCase().includes(needle));
        }
        const col = sort && columns.find((c) => c.key === sort.key);
        if (col?.sort) {
            const by = col.sort;
            out = [...out].sort((a, b) => {
                const x = by(a), y = by(b);
                const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
                return sort!.dir === "asc" ? c : -c;
            });
        }
        return out;
    }, [rows, q, sort, columns, searchText, server]);

    const total = server?.total ?? view.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(server?.page ?? page, pages);
    const shown = server ? view : view.slice((current - 1) * pageSize, current * pageSize);

    const goto = (p: number) => (server ? server.onPage(p) : setPage(p));
    const onQuery = (v: string) => { if (server) server.onQuery(v); else { setQ(v); setPage(1); } };
    const toggleSort = (key: string) => {
        const next: Sort = activeSort?.key !== key ? { key, dir: "asc" } : activeSort.dir === "asc" ? { key, dir: "desc" } : null;
        if (server) server.onSort(next); else setSort(next);
    };

    const ids = shown.map(rowKey);
    const allOn = ids.length > 0 && ids.every((id) => picked.has(id));
    const someOn = ids.some((id) => picked.has(id));
    const flip = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const flipAll = () => setPicked((s) => { const n = new Set(s); ids.forEach((id) => (allOn ? n.delete(id) : n.add(id))); return n; });
    const pickedRows = rows.filter((r) => picked.has(rowKey(r)));

    const from = total ? (current - 1) * pageSize + 1 : 0;
    const to = Math.min(current * pageSize, total);

    return (
        <div className={cn("flex min-w-0 flex-col gap-3", className)}>
            {searchText || server || toolbar ? (
                <div className="flex flex-wrap items-center gap-2">
                    {searchText || server ? <Search label={searchLabel} value={query} onChange={(e) => onQuery(e.target.value)} onClear={() => onQuery("")} className="min-w-[12rem] flex-1 medium:max-w-sm" /> : null}
                    {toolbar}
                </div>
            ) : null}

            {selectable && pickedRows.length ? (
                <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-medium bg-inverse-surface px-4 py-2 text-inverse-on-surface">
                    <span className="text-label-lg tnum">{L.picked.replace("{n}", String(pickedRows.length))}</span>
                    <span className="kit-inverse ms-auto flex flex-wrap gap-2 bg-transparent">{bulk?.(pickedRows, () => setPicked(new Set()))}</span>
                    <button type="button" onClick={() => setPicked(new Set())} className="min-h-10 rounded-small px-3 text-label-lg underline underline-offset-4">{L.clear}</button>
                </div>
            ) : null}

            {!loading && !shown.length && empty ? (
                empty
            ) : (
                <div className="min-w-0 overflow-x-auto rounded-medium bg-surface-container">
                    <table className="w-full border-collapse text-body-sm">
                        <caption className="sr-only">{label}</caption>
                        <thead>
                            <tr>
                                {selectable ? (
                                    <th scope="col" className="w-12 bg-surface-container-high px-3">
                                        <input type="checkbox" aria-label={L.pickAll} checked={allOn} ref={(el) => { if (el) el.indeterminate = someOn && !allOn; }} onChange={flipAll} className="h-[18px] w-[18px] accent-[var(--md-sys-color-primary)]" />
                                    </th>
                                ) : null}
                                {columns.map((c) => {
                                    const on = activeSort?.key === c.key ? activeSort.dir : null;
                                    return (
                                        <th
                                            key={c.key}
                                            scope="col"
                                            aria-sort={on === "asc" ? "ascending" : on === "desc" ? "descending" : undefined}
                                            style={c.width ? { width: c.width } : undefined}
                                            className={cn("whitespace-nowrap bg-surface-container-high px-3 py-2.5 text-label-md text-on-surface-variant", c.numeric ? "text-right" : "text-left", c.hideOnPhone && "hidden medium:table-cell")}
                                        >
                                            {c.sort ? (
                                                <button type="button" onClick={() => toggleSort(c.key)} className={cn("-mx-2 inline-flex min-h-8 items-center gap-1 rounded-small px-2", c.numeric && "flex-row-reverse", interactive())}>
                                                    {c.header}
                                                    <Icon icon={on === "asc" ? ArrowUp : on === "desc" ? ArrowDown : ArrowUpDown} size="sm" className={on ? "text-on-surface" : "opacity-50"} />
                                                </button>
                                            ) : c.header}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {loading
                                ? Array.from({ length: Math.min(pageSize, 5) }, (_, i) => (
                                    <tr key={i}>
                                        {selectable ? <td className="px-3 py-3.5" /> : null}
                                        {columns.map((c) => <td key={c.key} className={cn("px-3 py-3.5", c.hideOnPhone && "hidden medium:table-cell")}><Skeleton className="h-4 w-3/4" /></td>)}
                                    </tr>
                                ))
                                : shown.map((row) => {
                                    const id = rowKey(row);
                                    return (
                                        <tr
                                            key={id}
                                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                                            className={cn(picked.has(id) && "bg-secondary-container", onRowClick && "cursor-pointer transition-colors duration-short2 ease-standard hover:bg-on-surface/[0.08]")}
                                        >
                                            {selectable ? (
                                                <td className="px-3" onClick={(e) => e.stopPropagation()}>
                                                    <input type="checkbox" aria-label={L.pickRow} checked={picked.has(id)} onChange={() => flip(id)} className="h-[18px] w-[18px] accent-[var(--md-sys-color-primary)]" />
                                                </td>
                                            ) : null}
                                            {columns.map((c) => (
                                                <td key={c.key} className={cn("px-3 py-3.5 text-on-surface", c.numeric ? "text-right tnum" : "text-left", c.hideOnPhone && "hidden medium:table-cell")}>{c.cell(row)}</td>
                                            ))}
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination page={current} pages={pages} onChange={goto} summary={total ? `${from}–${to} ${L.of} ${total}` : undefined} labels={labels} />
        </div>
    );
}

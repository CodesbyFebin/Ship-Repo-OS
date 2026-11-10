"use client";

import { useId, useMemo, useState, type PointerEvent } from "react";
import { cn } from "../cn";

/**
 * Charts in plain SVG: no chart library (they start at 100 KB). Every chart
 * draws in the look's own colours, follows light/dark, and carries a hidden
 * table of its numbers, so a screen reader gets the data, not "image".
 *
 * Series colours walk the colour roles, so a look with a pink `soft` and a
 * lime `pop` gets pink and lime lines, and Ink gets black and greys.
 */
const SERIES = [
    "var(--md-sys-color-primary)",
    "var(--md-sys-color-tertiary)",
    "var(--md-sys-color-secondary)",
    "var(--md-sys-color-outline)",
    "var(--md-sys-color-on-surface-variant)",
];
export const seriesColour = (i: number) => SERIES[i % SERIES.length];

export type Series = { name: string; values: number[] };
type Fmt = (n: number) => string;
const plain: Fmt = (n) => n.toLocaleString();

/** A round top for the axis: 0-87 → 0-100, so gridlines land on whole numbers. */
function niceMax(n: number): number {
    if (n <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(n));
    return ([1, 2, 2.5, 5, 10].find((m) => m * p >= n) ?? 10) * p;
}

function DataTable({ label, labels, series, format }: { label: string; labels: string[]; series: Series[]; format: Fmt }) {
    return (
        <table className="sr-only">
            <caption>{label}</caption>
            <thead><tr><th scope="col">Label</th>{series.map((s) => <th key={s.name} scope="col">{s.name}</th>)}</tr></thead>
            <tbody>{labels.map((l, i) => <tr key={l + i}><th scope="row">{l}</th>{series.map((s) => <td key={s.name}>{format(s.values[i] ?? 0)}</td>)}</tr>)}</tbody>
        </table>
    );
}

export function ChartLegend({ series, className }: { series: { name: string }[]; className?: string }) {
    if (series.length < 2) return null;
    return (
        <ul className={cn("flex flex-wrap gap-x-4 gap-y-1", className)}>
            {series.map((s, i) => (
                <li key={s.name} className="flex items-center gap-2 text-label-md text-on-surface-variant">
                    <span aria-hidden className="h-2.5 w-2.5" style={{ background: seriesColour(i) }} />
                    {s.name}
                </li>
            ))}
        </ul>
    );
}

/* ── Sparkline ────────────────────────────────────────────────────────── */

/** A trend in a line, no axes: inside a metric, a table cell. */
export function Sparkline({ values, label, className }: { values: number[]; label: string; className?: string }) {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 28 - 1}`).join(" ");
    return (
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label={label} className={cn("h-8 w-24 overflow-visible", className)}>
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
    );
}

/* ── Line / area ──────────────────────────────────────────────────────── */

export type LineChartProps = {
    /** What the chart shows, said once: "Money spent per day". */
    label: string;
    /** One per point on the x axis. */
    labels: string[];
    series: Series[];
    /** Fill under the first line. */
    area?: boolean;
    format?: Fmt;
    height?: number;
    className?: string;
};

/**
 * Lines over time. Hover or drag a finger across it: a rule follows and the
 * numbers for that point show above the chart, never covering the line.
 */
export function LineChart({ label, labels, series, area = true, format = plain, height = 220, className }: LineChartProps) {
    const id = useId().replace(/:/g, "");
    const [at, setAt] = useState<number | null>(null);
    const max = useMemo(() => niceMax(Math.max(0, ...series.flatMap((s) => s.values))), [series]);
    const n = Math.max(labels.length - 1, 1);
    const x = (i: number) => (i / n) * 100;
    const y = (v: number) => 100 - (v / max) * 100;
    const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");

    const onMove = (e: PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setAt(Math.round(((e.clientX - r.left) / r.width) * n));
    };
    const shown = at ?? labels.length - 1;

    return (
        <figure className={cn("flex min-w-0 flex-col gap-3", className)}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <figcaption className="text-label-lg text-on-surface-variant">
                    {labels[shown]}
                </figcaption>
                <p className="flex flex-wrap gap-x-4 text-title-md tnum text-on-surface" aria-live="polite">
                    {series.map((s, i) => (
                        <span key={s.name} className="flex items-center gap-1.5">
                            {series.length > 1 && <span aria-hidden className="h-2.5 w-2.5" style={{ background: seriesColour(i) }} />}
                            {format(s.values[shown] ?? 0)}
                        </span>
                    ))}
                </p>
            </div>
            <div className="flex gap-2">
                <div className="flex flex-col justify-between py-0 text-right text-label-sm tnum text-on-surface-variant" style={{ height }} aria-hidden>
                    <span>{format(max)}</span>
                    <span>{format(max / 2)}</span>
                    <span>0</span>
                </div>
                <div className="relative min-w-0 flex-1 touch-pan-y" style={{ height }} onPointerMove={onMove} onPointerLeave={() => setAt(null)} onPointerDown={onMove}>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label} className="absolute inset-0 h-full w-full overflow-visible">
                        <defs>
                            <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0" stopColor={seriesColour(0)} stopOpacity={0.18} />
                                <stop offset="1" stopColor={seriesColour(0)} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        {[0, 50, 100].map((g) => (
                            <line key={g} x1={0} x2={100} y1={g} y2={g} stroke="var(--md-sys-color-outline-variant)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                        ))}
                        {area && series[0] ? <path d={`${line(series[0].values)}L100,100L0,100Z`} fill={`url(#fill-${id})`} /> : null}
                        {series.map((s, i) => (
                            <path key={s.name} d={line(s.values)} fill="none" stroke={seriesColour(i)} strokeWidth={2} strokeDasharray={i ? "5 4" : undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                        ))}
                        {at !== null ? <line x1={x(at)} x2={x(at)} y1={0} y2={100} stroke="var(--md-sys-color-on-surface)" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
                    </svg>
                    {at !== null && series.map((s, i) => (
                        <span key={s.name} aria-hidden className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 ring-2 ring-surface" style={{ left: `${x(at)}%`, top: `${y(s.values[at] ?? 0)}%`, background: seriesColour(i) }} />
                    ))}
                </div>
            </div>
            <div className="flex justify-between pl-8 text-label-sm text-on-surface-variant" aria-hidden>
                <span>{labels[0]}</span>
                {labels.length > 2 && <span>{labels[Math.floor(labels.length / 2)]}</span>}
                <span>{labels[labels.length - 1]}</span>
            </div>
            <ChartLegend series={series} />
            <DataTable label={label} labels={labels} series={series} format={format} />
        </figure>
    );
}

/* ── Bars ─────────────────────────────────────────────────────────────── */

export type BarChartProps = {
    label: string;
    labels: string[];
    series: Series[];
    /** Stack the series in one bar instead of side by side. */
    stacked?: boolean;
    format?: Fmt;
    height?: number;
    className?: string;
};

/** Amounts side by side. Bars are HTML, so each one has a real tooltip and hover. */
export function BarChart({ label, labels, series, stacked, format = plain, height = 220, className }: BarChartProps) {
    const totals = labels.map((_, i) => series.reduce((t, s) => t + (s.values[i] ?? 0), 0));
    const max = niceMax(stacked ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((s) => s.values)));
    return (
        <figure className={cn("flex min-w-0 flex-col gap-3", className)}>
            <figcaption className="sr-only">{label}</figcaption>
            <div className="flex gap-2">
                <div className="flex flex-col justify-between text-right text-label-sm tnum text-on-surface-variant" style={{ height }} aria-hidden>
                    <span>{format(max)}</span>
                    <span>{format(max / 2)}</span>
                    <span>0</span>
                </div>
                <div aria-hidden className="relative flex min-w-0 flex-1 items-end gap-[4%] border-b border-outline-variant" style={{ height }}>
                    {labels.map((l, i) => (
                        <div key={l + i} title={`${l}: ${series.map((s) => `${series.length > 1 ? s.name + " " : ""}${format(s.values[i] ?? 0)}`).join(", ")}`} className={cn("group flex h-full min-w-0 flex-1 items-end", stacked ? "flex-col-reverse justify-start" : "gap-[6%]")}>
                            {series.map((s, k) => (
                                <span
                                    key={s.name}
                                    className="block w-full min-w-[3px] transition-opacity group-hover:opacity-80"
                                    style={{ height: `${((s.values[i] ?? 0) / max) * 100}%`, background: seriesColour(k) }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            <div aria-hidden className="flex gap-[4%] pl-8 text-label-sm text-on-surface-variant">
                {labels.map((l, i) => (
                    <span key={l + i} className={cn("min-w-0 flex-1 truncate text-center", labels.length > 8 && i % Math.ceil(labels.length / 6) !== 0 && "invisible")}>{l}</span>
                ))}
            </div>
            <ChartLegend series={series} />
            <DataTable label={label} labels={labels} series={series} format={format} />
        </figure>
    );
}

/* ── Donut ────────────────────────────────────────────────────────────── */

export type DonutChartProps = {
    label: string;
    parts: { label: string; value: number }[];
    /** The big word in the middle. Defaults to the total. */
    center?: string;
    format?: Fmt;
    className?: string;
};

/** Parts of a whole, at most five. More than five reads better as bars. */
export function DonutChart({ label, parts, center, format = plain, className }: DonutChartProps) {
    const total = parts.reduce((t, p) => t + p.value, 0) || 1;
    let run = 0;
    const C = 2 * Math.PI * 40;
    return (
        <figure className={cn("flex min-w-0 flex-wrap items-center gap-6", className)}>
            <div className="relative h-40 w-40 shrink-0">
                <svg viewBox="0 0 100 100" role="img" aria-label={label} className="h-full w-full -rotate-90">
                    <circle cx={50} cy={50} r={40} fill="none" stroke="var(--md-sys-color-surface-container-highest)" strokeWidth={14} />
                    {parts.map((p, i) => {
                        const len = (p.value / total) * C;
                        const el = <circle key={p.label} cx={50} cy={50} r={40} fill="none" stroke={seriesColour(i)} strokeWidth={14} strokeDasharray={`${Math.max(len - 1, 0)} ${C}`} strokeDashoffset={-run} />;
                        run += len;
                        return el;
                    })}
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-title-lg tnum text-on-surface">{center ?? format(total)}</span>
            </div>
            <figcaption className="flex min-w-0 flex-col gap-2">
                <span className="sr-only">{label}</span>
                {parts.map((p, i) => (
                    <span key={p.label} className="flex items-center gap-2 text-body-md text-on-surface">
                        <span aria-hidden className="h-2.5 w-2.5 shrink-0" style={{ background: seriesColour(i) }} />
                        <span className="min-w-0 flex-1 truncate">{p.label}</span>
                        <span className="tnum text-on-surface-variant">{format(p.value)} · {Math.round((p.value / total) * 100)}%</span>
                    </span>
                ))}
            </figcaption>
        </figure>
    );
}

"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { CalendarClock, ChevronLeft, ChevronRight } from "../symbols";
import { Popover } from "./Popover";
import { interactive } from "../state-layer";

/**
 * Dates are plain "YYYY-MM-DD" strings everywhere here. A `Date` carries a
 * time zone, and "the 3rd" picked in London turned into "the 2nd" on a server
 * in New York - the bug every date picker ships once. A string can't drift.
 */
export type Day = string;
export type DayRange = { from: Day | null; to: Day | null };

const pad = (n: number) => String(n).padStart(2, "0");
export const toDay = (d: Date): Day => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: Day) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s: Day, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return toDay(d); };
const addMonths = (s: Day, n: number) => { const d = parse(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return toDay(d); };
export const today = () => toDay(new Date());

/** "3 Oct 2026" in the visitor's own language. */
export function formatDay(s: Day | null | undefined, locale?: string): string {
    return s ? parse(s).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "";
}

/**
 * The language dates are written in. The server can't know the visitor's, so
 * the first render uses "en-US" on both sides (no hydration mismatch), then
 * switches to the browser's own. A `locale` prop skips that.
 */
function useDateLocale(locale?: string): string {
    const [browser, setBrowser] = useState<string | null>(null);
    useEffect(() => setBrowser(navigator.language), []);
    return locale ?? browser ?? "en-US";
}

/** Monday first, except where the visitor's locale says Sunday (US, Canada, Japan…). */
function firstWeekday(locale?: string): number {
    try {
        const info = (new Intl.Locale(locale ?? "en-GB") as Intl.Locale & { weekInfo?: { firstDay: number }; getWeekInfo?: () => { firstDay: number } });
        const f = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
        return f === 7 ? 0 : f ?? 1;
    } catch {
        return 1;
    }
}

export type CalendarProps = {
    /** One day, or the two ends of a range. */
    mode?: "single" | "range";
    value?: Day | null;
    range?: DayRange;
    onChange?: (day: Day) => void;
    onRangeChange?: (range: DayRange) => void;
    min?: Day;
    max?: Day;
    /** Days that can't be picked: booked, closed. */
    disabled?: (day: Day) => boolean;
    locale?: string;
    className?: string;
};

/**
 * A month you can pick from. A real grid for screen readers; arrows move a
 * day, up/down a week, Page Up/Down a month, Home/End the week, Enter picks.
 */
export function Calendar({ mode = "single", value, range, onChange, onRangeChange, min, max, disabled, locale: wanted, className }: CalendarProps) {
    const locale = useDateLocale(wanted);
    const start = (mode === "range" ? range?.from : value) ?? today();
    const [focus, setFocus] = useState<Day>(start);
    const [hover, setHover] = useState<Day | null>(null);
    const grid = useRef<HTMLTableElement>(null);
    const moved = useRef(false);

    useEffect(() => {
        if (moved.current) grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
    }, [focus]);

    const first = firstWeekday(locale);
    const month = focus.slice(0, 7);
    const weeks = useMemo(() => {
        const d1 = parse(`${month}-01`);
        const lead = (d1.getDay() - first + 7) % 7;
        let cursor = addDays(`${month}-01`, -lead);
        const rows: Day[][] = [];
        for (let w = 0; w < 6; w++) {
            const row: Day[] = [];
            for (let i = 0; i < 7; i++) { row.push(cursor); cursor = addDays(cursor, 1); }
            rows.push(row);
            if (!cursor.startsWith(month)) break;
        }
        return rows;
    }, [month, first]);

    const names = useMemo(() => weeks[0].map((d) => parse(d).toLocaleDateString(locale, { weekday: "narrow" })), [weeks, locale]);
    const longNames = useMemo(() => weeks[0].map((d) => parse(d).toLocaleDateString(locale, { weekday: "long" })), [weeks, locale]);
    const title = parse(`${month}-01`).toLocaleDateString(locale, { month: "long", year: "numeric" });

    const off = (d: Day) => (min && d < min) || (max && d > max) || Boolean(disabled?.(d));
    const move = (d: Day) => { moved.current = true; setFocus(d); };

    const pick = (d: Day) => {
        if (off(d)) return;
        if (mode === "single") return onChange?.(d);
        const r = range ?? { from: null, to: null };
        if (!r.from || r.to || d < r.from) onRangeChange?.({ from: d, to: null });
        else onRangeChange?.({ from: r.from, to: d });
    };

    const onKey = (e: KeyboardEvent) => {
        const step: Record<string, () => Day> = {
            ArrowLeft: () => addDays(focus, -1), ArrowRight: () => addDays(focus, 1),
            ArrowUp: () => addDays(focus, -7), ArrowDown: () => addDays(focus, 7),
            PageUp: () => addMonths(focus, -1), PageDown: () => addMonths(focus, 1),
            Home: () => addDays(focus, -((parse(focus).getDay() - first + 7) % 7)),
            End: () => addDays(focus, 6 - ((parse(focus).getDay() - first + 7) % 7)),
        };
        if (step[e.key]) { e.preventDefault(); move(step[e.key]()); }
    };

    const end = mode === "range" ? (range?.to ?? (range?.from && hover && hover > range.from ? hover : null)) : null;
    const inRange = (d: Day) => mode === "range" && range?.from && end && d > range.from && d < end;
    const isPicked = (d: Day) => (mode === "single" ? d === value : d === range?.from || d === end);
    const now = today();

    return (
        <div className={cn("flex w-[18.5rem] max-w-full flex-col gap-2 p-1", className)}>
            <div className="flex items-center justify-between">
                <NavButton label="Previous month" icon={ChevronLeft} onClick={() => setFocus(addMonths(focus, -1))} />
                <p className="text-title-sm text-on-surface" aria-live="polite">{title}</p>
                <NavButton label="Next month" icon={ChevronRight} onClick={() => setFocus(addMonths(focus, 1))} />
            </div>
            <table ref={grid} role="grid" aria-label={title} className="w-full border-collapse" onKeyDown={onKey}>
                <thead>
                    <tr>
                        {names.map((n, i) => (
                            <th key={i} scope="col" abbr={longNames[i]} className="h-8 text-center text-label-sm font-normal text-on-surface-variant">{n}</th>
                        ))}
                    </tr>
                </thead>
                <tbody onMouseLeave={() => setHover(null)}>
                    {weeks.map((w) => (
                        <tr key={w[0]}>
                            {w.map((d) => {
                                const out = !d.startsWith(month);
                                const picked = isPicked(d);
                                return (
                                    <td key={d} className={cn("p-0 text-center", inRange(d) && "bg-secondary-container")}>
                                        <button
                                            type="button"
                                            data-day={d}
                                            tabIndex={d === focus ? 0 : -1}
                                            disabled={off(d)}
                                            aria-pressed={picked}
                                            aria-current={d === now ? "date" : undefined}
                                            aria-label={parse(d).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                                            onClick={() => { setFocus(d); pick(d); }}
                                            onMouseEnter={() => setHover(d)}
                                            className={cn(
                                                "relative mx-auto flex h-10 w-10 items-center justify-center rounded-small text-body-md tnum outline-none",
                                                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                                                picked ? "bg-primary text-on-primary" : cn(interactive(), out ? "text-on-surface-variant/60" : "text-on-surface"),
                                                d === now && !picked && "font-bold underline underline-offset-4",
                                                "disabled:pointer-events-none disabled:text-on-surface/[0.3] disabled:line-through",
                                            )}
                                        >
                                            {parse(d).getDate()}
                                        </button>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function NavButton({ label, icon, onClick }: { label: string; icon: typeof ChevronLeft; onClick: () => void }) {
    return (
        <button type="button" aria-label={label} onClick={onClick} className={cn("inline-flex h-10 w-10 items-center justify-center rounded-small text-on-surface-variant", interactive())}>
            <Icon icon={icon} />
        </button>
    );
}

/** The field look shared by both pickers: a label on top, the value, a calendar icon. */
function FieldButton({ label, text, empty, ...rest }: { label: string; text: string; empty: string } & Record<string, unknown>) {
    return (
        <button
            type="button"
            {...rest}
            className={cn(
                "flex h-14 w-full min-w-0 items-center gap-3 rounded-small bg-surface-container px-4 text-left",
                "hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
            )}
        >
            <span className="min-w-0 flex-1">
                <span className="block text-label-md text-on-surface-variant">{label}</span>
                <span className={cn("block truncate text-body-lg", text ? "text-on-surface" : "text-on-surface-variant")}>{text || empty}</span>
            </span>
            <Icon icon={CalendarClock} className="text-on-surface-variant" />
        </button>
    );
}

export type DatePickerProps = Omit<CalendarProps, "mode" | "range" | "onRangeChange" | "className"> & {
    label: string;
    /** What the field says when nothing is picked. */
    empty?: string;
    /** A form field name: the value is sent as YYYY-MM-DD. */
    name?: string;
    className?: string;
};

/** One date, picked from a calendar that drops under the field. */
export function DatePicker({ label, empty = "Pick a date", name, value, onChange, locale: wanted, className, ...cal }: DatePickerProps) {
    const locale = useDateLocale(wanted);
    const [open, setOpen] = useState(false);
    return (
        <div className={cn("min-w-0", className)}>
            <Popover
                open={open}
                onOpenChange={setOpen}
                label={label}
                className="max-w-none"
                clientOnly
                trigger={(p) => <FieldButton {...p} label={label} text={formatDay(value, locale)} empty={empty} />}
            >
                <Calendar {...cal} locale={locale} value={value} onChange={(d) => { onChange?.(d); setOpen(false); }} />
            </Popover>
            {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
        </div>
    );
}

export type DateRangePickerProps = Omit<CalendarProps, "mode" | "value" | "onChange" | "className"> & {
    label: string;
    empty?: string;
    /** Quick picks above the calendar. Leave out for the usual four. */
    presets?: { label: string; range: () => DayRange }[];
    className?: string;
};

export const RANGE_PRESETS: { label: string; range: () => DayRange }[] = [
    { label: "Last 7 days", range: () => ({ from: addDays(today(), -6), to: today() }) },
    { label: "Last 30 days", range: () => ({ from: addDays(today(), -29), to: today() }) },
    { label: "This month", range: () => ({ from: `${today().slice(0, 7)}-01`, to: today() }) },
    { label: "Last 12 months", range: () => ({ from: addMonths(today(), -12), to: today() }) },
];

/** A from-to pair: a report's dates, a booking. Quick picks first, then any two days. */
export function DateRangePicker({ label, empty = "Pick dates", range, onRangeChange, presets = RANGE_PRESETS, locale: wanted, className, ...cal }: DateRangePickerProps) {
    const locale = useDateLocale(wanted);
    const [open, setOpen] = useState(false);
    const text = range?.from ? `${formatDay(range.from, locale)} – ${range.to ? formatDay(range.to, locale) : "…"}` : "";
    return (
        <div className={cn("min-w-0", className)}>
            <Popover open={open} onOpenChange={setOpen} label={label} className="max-w-none" clientOnly trigger={(p) => <FieldButton {...p} label={label} text={text} empty={empty} />}>
                <div className="flex flex-col gap-2 medium:flex-row">
                    <ul className="flex flex-wrap gap-1 medium:w-36 medium:flex-col">
                        {presets.map((p) => (
                            <li key={p.label}>
                                <button type="button" onClick={() => { onRangeChange?.(p.range()); setOpen(false); }} className={cn("flex min-h-10 w-full items-center rounded-small px-3 text-left text-label-lg text-on-surface", interactive())}>
                                    {p.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <Calendar
                        {...cal}
                        mode="range"
                        locale={locale}
                        range={range}
                        onRangeChange={(r) => { onRangeChange?.(r); if (r.to) setOpen(false); }}
                    />
                </div>
            </Popover>
        </div>
    );
}

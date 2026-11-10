"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import palettes from "./palettes.json";
import { cn } from "../cn";
import { IconButton } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { Check, Pipette } from "../symbols";
import { focusRing, touchTarget } from "../state-layer";
import { SegmentedButton, Slider } from "./Choice";
import { Popover, type PopoverTriggerProps } from "./Popover";
import type { Placement } from "./position";

/**
 * The one colour picker (owner, 2026-10-04: "ours, native, super easy, like
 * the big apps - unified everywhere").
 *
 *   ┌────────────────────┐
 *   │  saturation/light  │  drag anywhere, arrow keys too
 *   ├────────────────────┤
 *   │  hue ▬▬▬▬▬▬▬▬▬▬▬▬  │
 *   │  💧  HEX  R  G  B  │  eyedropper (where the browser has one), type a value
 *   │ Colours·Palettes·… │  in use · recent · every hue · 19 palettes · gradients
 *   └────────────────────┘
 *
 * 🔴 Why not the browser's `<input type="color">`: its popup is a separate OS
 * window. A sheet or popover around it saw a tap on the picker's slider as a
 * tap OUTSIDE and closed, and an editor that re-rendered on every drag step
 * unmounted the input and killed the picker mid-drag. This picker is plain DOM
 * inside ours: a drag is captured by the square (`setPointerCapture`), so
 * leaving the panel while dragging never closes it.
 *
 * The colours are the person's artwork, not UI colours, so they are data here
 * (inline style), like Swatches.tsx. This folder is the one place hex lives.
 */

/* ── colour maths ─────────────────────────────────────────────────────── */

type Hsv = { h: number; s: number; v: number };
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** `#abc`, `abc`, `#aabbcc` → `#aabbcc`, or null. */
export function parseHex(raw: string): string | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
    if (!m) return null;
    const h = m[1].toLowerCase();
    return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h}`;
}

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, "0")).join("")}`;

function hexToRgb(hex: string): [number, number, number] {
    const h = parseHex(hex) ?? "#000000";
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function hsvToRgb({ h, s, v }: Hsv): [number, number, number] {
    const f = (n: number) => {
        const k = (n + h / 60) % 6;
        return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
    };
    return [f(5), f(3), f(1)];
}

const hsvToHex = (c: Hsv) => toHex(...hsvToRgb(c));

function hexToHsv(hex: string): Hsv {
    const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
    const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    let h = 0;
    if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s: max ? d / max : 0, v: max };
}

function hslToHex(h: number, s: number, l: number) {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
    };
    return toHex(f(0), f(8), f(4));
}

/** The colour is light enough that a dark tick reads on it. */
export function isLight(hex: string) {
    const [r, g, b] = hexToRgb(hex);
    return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

/* ── the data the panel offers ────────────────────────────────────────── */

/** Every hue in six steps, light to dark; then a grey ramp. Rows are steps, so a column is one colour. */
const HUES = [0, 20, 40, 55, 90, 140, 170, 200, 225, 255, 285, 320];
const STEPS = [0.88, 0.76, 0.64, 0.52, 0.4, 0.28];
const GREYS = ["#ffffff", "#f0f0f0", "#dcdcdc", "#c4c4c4", "#aaaaaa", "#909090", "#767676", "#5c5c5c", "#444444", "#2e2e2e", "#171717", "#000000"];
const GRID = [...STEPS.map((l) => HUES.map((h) => hslToHex(h, 0.78, l))), GREYS];

/** White and black: the two a background most often wants. */
export const BASIC_COLOURS = ["#ffffff", "#000000"];

export type Gradient = { from: string; to: string; /** CSS degrees: 180 = top to bottom. */ angle: number };

const GRADIENTS: [string, string][] = [
    ["#ff9a9e", "#fad0c4"], ["#f6d365", "#fda085"], ["#84fab0", "#8fd3f4"], ["#a18cd1", "#fbc2eb"], ["#fdcbf1", "#e6dee9"], ["#4facfe", "#00f2fe"],
    ["#43e97b", "#38f9d7"], ["#fa709a", "#fee140"], ["#667eea", "#764ba2"], ["#0f2027", "#2c5364"], ["#232526", "#414345"], ["#c33764", "#1d2671"],
    ["#f83600", "#f9d423"], ["#00c6fb", "#005bea"], ["#b721ff", "#21d4fd"], ["#ff0844", "#ffb199"], ["#ffffff", "#c9d6ff"], ["#134e5e", "#71b280"],
];

/** A gradient as CSS, for a swatch. */
export const gradientCss = (g: Gradient) => `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`;

const RECENT_KEY = "ship-recent-colours";
const readRecent = (): string[] => {
    try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 12) : []; } catch { return []; }
};
const writeRecent = (hex: string) => {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([hex, ...readRecent().filter((x) => x !== hex)].slice(0, 12))); } catch { /* private window: no recents */ }
};

/* ── drag surface ─────────────────────────────────────────────────────── */

/**
 * One pointer drag over a box, reported as 0..1 in x and y. The box captures
 * the pointer, so the drag goes on outside the panel and a popover's light
 * dismiss never sees it.
 */
function dragProps(onMove: (x: number, y: number) => void, onEnd: () => void) {
    const at = (e: PointerEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        onMove(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
    };
    return {
        onPointerDown: (e: PointerEvent<HTMLElement>) => {
            e.preventDefault();
            e.currentTarget.focus();
            e.currentTarget.setPointerCapture(e.pointerId);
            at(e);
        },
        onPointerMove: (e: PointerEvent<HTMLElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e); },
        onPointerUp: (e: PointerEvent<HTMLElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { e.currentTarget.releasePointerCapture(e.pointerId); onEnd(); } },
        onPointerCancel: onEnd,
    };
}

const SURFACE = "relative touch-none select-none rounded-medium";
const THUMB = "pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full";
const THUMB_RING: CSSProperties = { boxShadow: "0 0 0 2px #fff, 0 1px 5px 1px rgba(0,0,0,.55)" };

/* ── small controls ───────────────────────────────────────────────────── */

/** A text box for one value. Keeps what is being typed until it is a real value. */
function ValueBox({ label, value, onValid, parse, width, mono = true }: { label: string; value: string; onValid: (v: string) => void; parse: (raw: string) => string | null; width: string; mono?: boolean }) {
    const [typed, setTyped] = useState<string | null>(null);
    return (
        <label className={cn("flex min-w-0 flex-col gap-0.5", width)}>
            <input
                aria-label={label}
                value={typed ?? value}
                spellCheck={false}
                autoComplete="off"
                inputMode={label === "Hex" ? "text" : "numeric"}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                    setTyped(e.target.value);
                    const ok = parse(e.target.value);
                    if (ok) onValid(ok);
                }}
                onBlur={() => setTyped(null)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                className={cn("h-10 w-full min-w-0 rounded-small bg-surface-container-highest px-2 text-center text-body-md text-on-surface outline-none transition-shadow duration-short4 ease-standard focus:shadow-[inset_0_0_0_2px_var(--md-sys-color-primary)]", mono && "font-mono uppercase")}
            />
            <span className="text-center text-label-sm text-on-surface-variant">{label}</span>
        </label>
    );
}

/** One colour as a circle. The ring says it is the picked one. */
function Dot({ hex, on, onPick, size = "h-6 w-6", label }: { hex: string; on: boolean; onPick: () => void; size?: string; label?: string }) {
    return (
        <button
            type="button"
            aria-label={label ?? hex.toUpperCase()}
            title={label ?? hex.toUpperCase()}
            aria-pressed={on}
            onClick={onPick}
            style={{ backgroundColor: hex, color: isLight(hex) ? "#000" : "#fff" }}
            className={cn("grid shrink-0 place-items-center rounded-full ring-1 ring-outline-variant transition-transform duration-short4 ease-standard motion-safe:hover:scale-110", size, focusRing, on && "ring-2 ring-primary ring-offset-2 ring-offset-surface-container")}
        >
            {on ? <Icon icon={Check} size="sm" className="h-3.5 w-3.5" /> : null}
        </button>
    );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-label-md text-on-surface-variant">{title}</p>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
    );
}

/* ── the picker ───────────────────────────────────────────────────────── */

export type ColorPickerProps = {
    /** `#rrggbb`. */
    value: string;
    /** Fires on every step of a drag, lower-case `#rrggbb`. */
    onChange: (hex: string) => void;
    /** The colours already in use, shown first. */
    swatches?: string[];
    /** Adds a Gradients tab. Called with a ready gradient on every change. */
    onGradient?: (g: Gradient) => void;
    /** The gradient in use now, if the thing being coloured has one. */
    gradient?: Gradient | null;
    className?: string;
};

type Tab = "colours" | "palettes" | "gradients";

export function ColorPicker({ value, onChange, swatches, onGradient, gradient, className }: ColorPickerProps) {
    const hex = parseHex(value) ?? "#000000";
    const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(hex));
    /** The last colour this panel produced or was given: tells a parent's change from our own. */
    const last = useRef(hex);
    useEffect(() => {
        if (hex !== last.current) { last.current = hex; setHsv(hexToHsv(hex)); }
    }, [hex]);

    const [tab, setTab] = useState<Tab>("colours");
    const [recent, setRecent] = useState<string[]>([]);
    useEffect(() => setRecent(readRecent()), []);
    const [dropper, setDropper] = useState(false);
    useEffect(() => setDropper(typeof window !== "undefined" && "EyeDropper" in window), []);

    const push = (next: Hsv) => {
        const out = hsvToHex(next);
        setHsv(next);
        last.current = out;
        onChange(out);
    };
    /** A whole colour picked from a list (not a drag): it becomes a recent one. */
    const pick = (raw: string) => {
        const h = parseHex(raw);
        if (!h) return;
        last.current = h;
        setHsv(hexToHsv(h));
        onChange(h);
        remember(h);
    };
    const remember = (h: string) => { writeRecent(h); setRecent(readRecent()); };
    const done = () => remember(last.current);

    const eyedrop = async () => {
        try {
            const r = await new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper().open();
            pick(r.sRGBHex);
        } catch { /* cancelled with Esc */ }
    };

    const [r, g, b] = hexToRgb(hex);
    const setChannel = (i: 0 | 1 | 2) => (raw: string) => {
        const n = clamp(Number(raw), 0, 255);
        const rgb: [number, number, number] = [r, g, b];
        rgb[i] = n;
        const h = toHex(...rgb);
        last.current = h;
        setHsv(hexToHsv(h));
        onChange(h);
    };
    const parseChannel = (raw: string) => (/^\d{1,3}$/.test(raw.trim()) && Number(raw) <= 255 ? raw.trim() : null);

    const key = (apply: (dx: number, dy: number) => void) => (e: KeyboardEvent) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const m = d[e.key];
        if (!m) return;
        e.preventDefault();
        apply(...m);
    };

    const own = useMemo(() => [...new Set((swatches ?? []).map((c) => parseHex(c)).filter((c): c is string => !!c))].slice(0, 12), [swatches]);
    const tabs = [{ value: "colours" as const, label: "Colours" }, { value: "palettes" as const, label: "Palettes" }, ...(onGradient ? [{ value: "gradients" as const, label: "Gradients" }] : [])];
    const angle = gradient?.angle ?? 180;
    const from = gradient?.from ?? hex;

    return (
        <div className={cn("flex w-full flex-col gap-3", className)}>
            {/* saturation (across) and brightness (down) */}
            <div
                role="slider"
                tabIndex={0}
                aria-label="Saturation and brightness"
                aria-valuetext={`Saturation ${Math.round(hsv.s * 100)} percent, brightness ${Math.round(hsv.v * 100)} percent`}
                aria-valuenow={Math.round(hsv.s * 100)}
                className={cn(SURFACE, "h-40 w-full", focusRing)}
                style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }), backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)" }}
                {...dragProps((x, y) => push({ ...hsv, s: x, v: 1 - y }), done)}
                onKeyDown={key((dx, dy) => push({ ...hsv, s: clamp(hsv.s + dx), v: clamp(hsv.v - dy) }))}
                onKeyUp={done}
            >
                <span className={THUMB} style={{ ...THUMB_RING, left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }} />
            </div>

            {/* hue */}
            <div
                role="slider"
                tabIndex={0}
                aria-label="Hue"
                aria-valuemin={0}
                aria-valuemax={360}
                aria-valuenow={Math.round(hsv.h)}
                className={cn(SURFACE, "h-6 w-full rounded-full", focusRing)}
                style={{ backgroundImage: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
                {...dragProps((x) => push({ ...hsv, h: x * 360 }), done)}
                onKeyDown={key((dx) => push({ ...hsv, h: (hsv.h + dx * 360 + 360) % 360 }))}
                onKeyUp={done}
            >
                <span className={cn(THUMB, "top-1/2")} style={{ ...THUMB_RING, left: `${(hsv.h / 360) * 100}%`, backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }} />
            </div>

            {/* the value, typed or dropped */}
            <div className="flex items-start gap-2">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center">
                    {dropper ? (
                        <IconButton icon={Pipette} label="Pick a colour from the screen" size="sm" onClick={() => void eyedrop()} />
                    ) : (
                        <span aria-hidden className="h-8 w-8 rounded-full ring-1 ring-outline-variant" style={{ backgroundColor: hex }} />
                    )}
                </span>
                <ValueBox label="Hex" value={hex.slice(1)} width="flex-[2.2]" parse={(raw) => parseHex(raw)} onValid={(h) => pick(h)} />
                <ValueBox label="R" value={String(r)} width="flex-1" parse={parseChannel} onValid={setChannel(0)} />
                <ValueBox label="G" value={String(g)} width="flex-1" parse={parseChannel} onValid={setChannel(1)} />
                <ValueBox label="B" value={String(b)} width="flex-1" parse={parseChannel} onValid={setChannel(2)} />
            </div>

            {tabs.length > 1 ? (
                <SegmentedButton label="Colour source" value={tab} onChange={setTab} options={tabs} fullWidth />
            ) : null}

            {/* one fixed height, so the panel never grows under the finger */}
            <div className="h-44 overflow-y-auto overflow-x-hidden pr-1">
                {tab === "colours" ? (
                    <div className="flex flex-col gap-3">
                        {own.length ? <Row title="In use">{own.map((c) => <Dot key={c} hex={c} on={c === hex} onPick={() => pick(c)} />)}</Row> : null}
                        {recent.length ? <Row title="Recent">{recent.map((c) => <Dot key={c} hex={c} on={c === hex} onPick={() => pick(c)} />)}</Row> : null}
                        <div className="flex flex-col gap-1.5">
                            <p className="text-label-md text-on-surface-variant">Every colour</p>
                            <div className="flex flex-col gap-1">
                                {GRID.map((row, i) => (
                                    <div key={i} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${HUES.length}, minmax(0, 1fr))` }}>
                                        {row.map((c) => <Dot key={c} hex={c} on={c === hex} onPick={() => pick(c)} size="aspect-square w-full" />)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : tab === "palettes" ? (
                    <div className="flex flex-col gap-3">
                        {palettes.map((p) => (
                            <Row key={p.id} title={p.name}>{p.colors.map((c) => { const h = parseHex(c) ?? c; return <Dot key={c} hex={h} on={h === hex} onPick={() => pick(h)} size="h-8 w-8" />; })}</Row>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <Slider
                            label="Direction"
                            valueLabel={`${angle}°`}
                            min={0}
                            max={345}
                            step={15}
                            disabled={!gradient}
                            value={angle}
                            onChange={(e) => onGradient?.({ from: gradient?.from ?? from, to: gradient?.to ?? hex, angle: Number(e.target.value) })}
                        />
                        <div className="grid grid-cols-3 gap-2">
                            {GRADIENTS.map(([a, z]) => {
                                const on = gradient?.from === a && gradient?.to === z;
                                return (
                                    <button
                                        key={a + z}
                                        type="button"
                                        aria-label={`Gradient ${a} to ${z}`}
                                        aria-pressed={on}
                                        onClick={() => onGradient?.({ from: a, to: z, angle })}
                                        className={cn("h-12 rounded-medium ring-1 ring-outline-variant", focusRing, on && "ring-2 ring-primary ring-offset-2 ring-offset-surface-container")}
                                        style={{ backgroundImage: gradientCss({ from: a, to: z, angle }) }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── the picker in a popover ──────────────────────────────────────────── */

/** The panel's box: a fixed width so a phone gets all of it and a desktop gets a tidy card. */
const PANEL = "w-[19rem] max-h-[min(34rem,calc(100dvh-1rem))] max-w-[calc(100vw-1rem)] p-3";

export type ColorPopoverProps = Omit<ColorPickerProps, "className"> & {
    /** What the colour is for, e.g. "Background colour". Names the panel and the default button. */
    label: string;
    /** The control that opens it. Default: the colour as a circle. */
    trigger?: (props: PopoverTriggerProps & { value: string }) => ReactNode;
    placement?: Placement;
    /** Once, when the panel closes on a different colour than it opened with. */
    onCommit?: (hex: string) => void;
    /** Told when the panel opens and closes (to open and close an undo step). */
    onOpenChange?: (open: boolean) => void;
    triggerClassName?: string;
};

/**
 * Click the colour, get the picker. Drawn only while open (a screen with
 * twenty of these does not hold twenty panels).
 */
export function ColorPopover({ label, value, trigger, placement = "bottom-start", onCommit, onOpenChange, triggerClassName, ...picker }: ColorPopoverProps) {
    const [open, setOpen] = useState(false);
    const start = useRef(value);
    const now = useRef(value);
    now.current = value;
    return (
        <Popover
            label={label}
            placement={placement}
            className={PANEL}
            onOpenChange={(o) => {
                setOpen(o);
                if (o) start.current = now.current;
                else if (parseHex(now.current) !== parseHex(start.current)) onCommit?.(now.current);
                onOpenChange?.(o);
            }}
            trigger={(p) =>
                trigger ? trigger({ ...p, value }) : (
                    <button
                        type="button"
                        {...p}
                        aria-label={`${label}: ${value.toUpperCase()}`}
                        title={label}
                        style={{ backgroundColor: value }}
                        className={cn("h-10 w-10 shrink-0 rounded-full ring-1 ring-outline-variant", touchTarget, focusRing, triggerClassName)}
                    />
                )
            }
        >
            {open ? <ColorPicker value={value} {...picker} /> : null}
        </Popover>
    );
}

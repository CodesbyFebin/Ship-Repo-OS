"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { Check, Plus } from "../symbols";
import { focusRing, touchTarget } from "../state-layer";
import { CHECKER_STYLE } from "../checker";
import { ColorPopover, gradientCss, type Gradient } from "./ColorPicker";

/**
 * Colour picking you can see (owner, 2026-09-27: "make it easy to choose").
 * A `ColorField` hides the system picker behind one small dot; these put the
 * choices on the page as circles and palette strips, one tap each.
 *
 *   ColorSwatches   ◯ ● ● ● ● ⊕      as drawn · a few colours · any colour
 *   PaletteGrid     ▰▰▰▰ ▰▰▰▰ ▰▰▰▰    whole palettes, one tap each
 *
 * The colours are the user's artwork data (never UI colours), so they come
 * in as props and are drawn with inline style, like ColorField's dot.
 */

const DOT = "grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-level-1 transition-transform duration-short4 ease-standard motion-safe:hover:scale-110";
const ON = "ring-2 ring-primary ring-offset-2 ring-offset-surface-container";

/** Light or dark tick, whichever reads on this colour. */
function tickOn(hex: string): CSSProperties {
    const h = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1];
    if (!h) return {};
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return { color: r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "black" : "white" };
}

export type ColorSwatchesProps = {
    label: string;
    colors: string[];
    /** The picked colour, or null for "as drawn". */
    value: string | null;
    onChange: (hex: string | null) => void;
    /** A first circle that clears the colour, named this ("As drawn", "None"). */
    noneLabel?: string;
    /** A last circle that opens the colour picker for any colour. */
    custom?: boolean;
    /** Adds a Gradients tab to the picker; `gradient` is the one in use. */
    gradient?: Gradient | null;
    onGradient?: (g: Gradient) => void;
    /** Told when the picker opens and closes (to open and close an undo step). */
    onPickerOpen?: (open: boolean) => void;
    className?: string;
};

export function ColorSwatches({ label, colors, value, onChange, noneLabel, custom = true, gradient, onGradient, onPickerOpen, className }: ColorSwatchesProps) {
    const uid = useId();
    const v = value?.toLowerCase() ?? null;
    const own = v && !colors.some((c) => c.toLowerCase() === v) ? v : null;
    const grad = !v && gradient ? gradient : null;
    return (
        <div role="radiogroup" aria-labelledby={`${uid}-l`} className={cn("flex flex-col gap-2", className)}>
            <span id={`${uid}-l`} className="text-label-lg text-on-surface">{label}</span>
            <div className="flex flex-wrap gap-2">
                {noneLabel ? (
                    <button type="button" role="radio" aria-checked={!v && !grad} aria-label={noneLabel} title={noneLabel} onClick={() => onChange(null)} className={cn(DOT, touchTarget, focusRing, !v && !grad && ON)} style={CHECKER_STYLE} />
                ) : null}
                {colors.map((c) => {
                    const on = v === c.toLowerCase();
                    return (
                        <button key={c} type="button" role="radio" aria-checked={on} aria-label={c.toUpperCase()} title={c.toUpperCase()} onClick={() => onChange(c.toLowerCase())} className={cn(DOT, touchTarget, focusRing, on && ON)} style={{ backgroundColor: c, ...tickOn(c) }}>
                            {on ? <Icon icon={Check} size="sm" /> : null}
                        </button>
                    );
                })}
                {custom ? (
                    <ColorPopover
                        label={`${label}: any colour`}
                        value={own ?? v ?? colors[0] ?? "#808080"}
                        onChange={(hex) => onChange(hex.toLowerCase())}
                        swatches={colors}
                        gradient={grad}
                        onGradient={onGradient}
                        onOpenChange={onPickerOpen}
                        placement="bottom-start"
                        trigger={(p) => (
                            <button {...p} type="button" aria-label="Any colour" title="Any colour" className={cn(DOT, touchTarget, focusRing, "overflow-hidden bg-surface-container-highest text-on-surface-variant", (own || grad) && ON)} style={grad ? { backgroundImage: gradientCss(grad) } : own ? { backgroundColor: own, ...tickOn(own) } : undefined}>
                                <Icon icon={own || grad ? Check : Plus} size="sm" />
                            </button>
                        )}
                    />
                ) : null}
            </div>
        </div>
    );
}

export type PaletteGridProps = {
    label: string;
    palettes: { id: string; name: string; colors: string[] }[];
    /** The picked palette's id, or null for the picture's own colours. */
    value: string | null;
    onChange: (id: string | null) => void;
    /** A first strip that goes back to the picture's own colours. */
    noneLabel?: string;
    className?: string;
};

export function PaletteGrid({ label, palettes, value, onChange, noneLabel, className }: PaletteGridProps) {
    const uid = useId();
    const strip = (on: boolean) => cn("flex h-10 overflow-hidden rounded-small shadow-level-1 transition-transform duration-short4 ease-standard motion-safe:group-hover:scale-[1.03]", on && ON);
    return (
        <div role="radiogroup" aria-labelledby={`${uid}-l`} className={cn("flex flex-col gap-2", className)}>
            <span id={`${uid}-l`} className="text-label-lg text-on-surface">{label}</span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {noneLabel ? (
                    <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(null)} className={cn("group flex min-h-touch flex-col justify-center gap-1 rounded-medium text-left", focusRing)}>
                        <span className={strip(!value)} style={CHECKER_STYLE} />
                        <span className="truncate px-1 text-label-sm text-on-surface-variant">{noneLabel}</span>
                    </button>
                ) : null}
                {palettes.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={value === p.id} onClick={() => onChange(p.id)} className={cn("group flex min-h-touch flex-col justify-center gap-1 rounded-medium text-left", focusRing)}>
                        <span className={strip(value === p.id)}>
                            {p.colors.map((c, i) => <span key={`${c}-${i}`} className="h-full flex-1" style={{ backgroundColor: c }} />)}
                        </span>
                        <span className="truncate px-1 text-label-sm text-on-surface-variant">{p.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

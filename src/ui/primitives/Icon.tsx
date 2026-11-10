import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../cn";
import { SYMBOL_VIEWBOX, type Glyph } from "./symbols.generated";

export type { Glyph };

/**
 * What any component means by "an icon": a Material Symbol from `@/ui/symbols`.
 *
 * It is an alias rather than a re-export of `Glyph` so the hundreds of
 * `icon?: IconGlyph` props read as intent ("something Icon can draw") instead
 * of as an implementation detail.
 */
export type IconGlyph = Glyph;

/**
 * M3 icon sizes. 24dp is the spec default and what almost everything uses;
 * 18 is for dense rows and chips, 32/40 for FABs and empty states.
 */
const SIZE = { sm: 18, md: 24, lg: 32, xl: 40 } as const;
export type IconSize = keyof typeof SIZE;

export type IconProps = Omit<ComponentPropsWithoutRef<"svg">, "role" | "children" | "ref"> & {
    /** A Material Symbol from `@/ui/symbols` — `import { Search } from "../symbols"`. */
    icon: IconGlyph;
    size?: IconSize;
    /**
     * M3's fill axis. An unselected destination is outlined, a selected one is
     * filled — that is how a nav bar shows where you are without spending a
     * colour on it. Ignored for a symbol whose fill is identical.
     */
    filled?: boolean;
    /**
     * Fills and tints on hover of the link, button or menu row around it
     * (owner, 2026-09-27: every menu icon answers the pointer). CSS only -
     * `.m3-icon-hover` in ui.css - so it costs no state and no JS.
     */
    hoverFill?: boolean;
    /** Only when the icon carries meaning on its own. Decorative icons stay hidden. */
    label?: string;
    className?: string;
};

/**
 * The only way an icon enters the UI.
 *
 * Material Symbols Rounded, weight 400, optical 24 — owner, 2026-09-23. They
 * arrive as path data generated at build time (scripts/icons-build.ts), not as
 * the variable webfont: the font is megabytes and every icon would be an empty
 * box until it landed.
 *
 * An icon with no `label` is `aria-hidden`: it is decoration next to a word,
 * and a screen reader announcing it twice is noise. An icon that IS the whole
 * control takes a `label`.
 */
export function Icon({ icon, size = "md", filled, hoverFill, label, className, width, height, ...rest }: IconProps) {
    const px = SIZE[size];
    // `strokeWidth` was lucide's. A Material Symbol is a filled path with no
    // stroke, so it is dropped here rather than forwarded onto an <svg> that
    // would ignore it and warn in dev - 200-odd call sites still pass it.
    const { strokeWidth: _stroke, ...svgProps } = rest as Record<string, unknown>;
    void _stroke;
    const a11y = {
        "aria-hidden": label ? undefined : true,
        "aria-label": label,
        role: label ? ("img" as const) : undefined,
        focusable: false,
    };

    return (
        <svg
            {...(svgProps as ComponentPropsWithoutRef<"svg">)}
            width={width ?? px}
            height={height ?? px}
            viewBox={SYMBOL_VIEWBOX}
            fill="currentColor"
            {...a11y}
            className={cn("shrink-0", hoverFill && "m3-icon-hover", className)}
        >
            {hoverFill && !filled && icon.f ? (
                <>
                    <path className="m3-icon-o" d={icon.d} />
                    <path className="m3-icon-f" d={icon.f} />
                </>
            ) : (
                <path d={filled && icon.f ? icon.f : icon.d} />
            )}
        </svg>
    );
}

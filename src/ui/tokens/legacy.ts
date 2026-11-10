/**
 * ⚠️ LEGACY — the pre-M3 token set, FROZEN on 2026-09-20.
 *
 * It is not the design system any more; `tokens.ts` is (Material 3). This file
 * exists only so the 86 pages that have not been migrated yet keep rendering
 * while they are rebuilt one at a time. Nothing new may read from it, and no
 * value in it may be changed.
 *
 * Its generated CSS is the frozen snapshot `legacy.css` — also not regenerated.
 * Both files are deleted whole in S11, when the last page stops importing them.
 *
 */
export type ThemePair = { light: string; dark: string };
/** A value that points at another colour token instead of repeating it. */
export type Ref = { ref: string };
export type ColorValue = ThemePair | Ref;

export const color: Record<string, ColorValue> = {
    /* ── Backgrounds ─────────────────────────────────────────────────── */
    "bg.canvas": { light: "#F4F4F5", dark: "#09090B" }, // app ground behind panels and sidebar
    "bg.page": { light: "#FFFFFF", dark: "#111113" }, // the main content surface
    "bg.card": { light: "#FAFAFA", dark: "#18181B" }, // a contained surface sitting on the page
    "bg.muted": { light: "#F4F4F5", dark: "#1F1F23" }, // quiet fills: chips, hover rows, wells
    "bg.emphasis": { light: "#E4E4E7", dark: "#2A2A30" }, // stronger fills: pressed, selected
    "bg.overlay": { light: "#FFFFFF", dark: "#1C1C20" }, // menus, popovers, dialogs, toasts
    "bg.inverse": { light: "#09090B", dark: "#EDEDEF" }, // selection bars, tooltips

    /* ── Borders ─────────────────────────────────────────────────────── */
    "border.subtle": { light: "#F0F0F2", dark: "#1D1D21" }, // dividers inside a card
    "border.default": { light: "#E4E4E7", dark: "#27272C" }, // cards, inputs, tables
    "border.strong": { light: "#D4D4D8", dark: "#3A3A41" }, // hover, emphasis

    /* ── Text ────────────────────────────────────────────────────────── */
    "text.primary": { light: "#09090B", dark: "#EDEDEF" },
    "text.secondary": { light: "#52525B", dark: "#A1A1AA" },
    "text.muted": { light: "#71717A", dark: "#85858F" },
    "text.disabled": { light: "#A1A1AA", dark: "#52525B" },
    "text.inverse": { light: "#FAFAFA", dark: "#09090B" },
    "text.on-action": { light: "#FFFFFF", dark: "#FFFFFF" },
    "text.accent": { light: "#5850EC", dark: "#A5A0FF" }, // links and accent text, AA on page

    /* ── Action ──────────────────────────────────────────────────────────
     * Blurple means "do it": run, pay, publish. It is never decoration.
     * The fill is the same in both themes so white text always clears AA. */
    "action.primary": { light: "#635BFF", dark: "#635BFF" },
    "action.primary-hover": { light: "#5850EC", dark: "#5850EC" },
    "action.primary-pressed": { light: "#4C44DB", dark: "#4C44DB" },
    "action.destructive": { light: "#CE2C31", dark: "#CE2C31" },
    "action.destructive-hover": { light: "#B42329", dark: "#B42329" },
    "focus.ring": { light: "#635BFF", dark: "#8B85FF" },

    /* ── Status ──────────────────────────────────────────────────────── */
    "status.success": { light: "#067A52", dark: "#3ECF8E" },
    "status.warning": { light: "#B45309", dark: "#F5A524" },
    "status.danger": { light: "#CE2C31", dark: "#FF6369" },
    "status.info": { light: "#0068D6", dark: "#5EA8FF" },

    /* ── Money: green means money came in, nothing else ───────────────── */
    "money.positive": { ref: "status.success" },

    /* ── Agent lifecycle ─────────────────────────────────────────────── */
    "agent.live": { ref: "status.success" },
    "agent.running": { ref: "text.accent" },
    "agent.paused": { ref: "status.warning" },
    "agent.failed": { ref: "status.danger" },
    "agent.draft": { ref: "text.muted" },

    /* ── Ranking metals (leaderboards only) ──────────────────────────── */
    "rank.gold": { light: "#A67C00", dark: "#D8B45C" },
    "rank.silver": { light: "#6B7280", dark: "#C2C6CB" },
    "rank.bronze": { light: "#9A5B2C", dark: "#B08155" },
};

/** Colours that carry alpha and are never used with an opacity modifier. */
export const colorAlpha: Record<string, ThemePair> = {
    "overlay.scrim": { light: "rgba(9, 9, 11, 0.40)", dark: "rgba(0, 0, 0, 0.62)" },
    "overlay.hover": { light: "rgba(9, 9, 11, 0.045)", dark: "rgba(255, 255, 255, 0.05)" },
    "overlay.press": { light: "rgba(9, 9, 11, 0.08)", dark: "rgba(255, 255, 255, 0.08)" },
};

/** Soft tints are derived, not hand-picked: the colour mixed into bg.page. */
export const softTint = { light: 0.1, dark: 0.16 };
export const softTintOf = ["status.success", "status.warning", "status.danger", "status.info", "action.primary"] as const;

/**
 * Contrast pairs checked by `tokens:build`. The build fails if any pair drops
 * below its minimum in either theme.
 */
export const contrastPairs: Array<[fg: string, bg: string, min: number]> = [
    ["text.primary", "bg.page", 7],
    ["text.primary", "bg.card", 7],
    ["text.secondary", "bg.page", 4.5],
    ["text.secondary", "bg.card", 4.5],
    ["text.muted", "bg.page", 4.5],
    ["text.muted", "bg.card", 4.5],
    ["text.accent", "bg.page", 4.5],
    ["text.on-action", "action.primary", 4.5],
    ["text.on-action", "action.primary-hover", 4.5],
    ["text.on-action", "action.destructive", 4.5],
    ["status.success", "bg.page", 4.5],
    ["status.warning", "bg.page", 4.5],
    ["status.danger", "bg.page", 4.5],
    ["status.info", "bg.page", 4.5],
    ["text.inverse", "bg.inverse", 7],
    ["text.primary", "bg.overlay", 7],
];

/* ── Typography ───────────────────────────────────────────────────────── */

export const font = {
    sans: 'var(--font-brand), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
};

export type TextStyle = {
    size: string;
    line: string;
    weight: number;
    tracking: string;
    /** Size/line from 1024px up, when it differs (body text gets denser). */
    desktop?: { size: string; line: string };
    family?: "sans" | "mono";
};

/**
 * 12 steps, one family. Display and h1 are fluid between 375 and 1280.
 * Body is 15px on phones (readable at arm's length) and 14px from 1024px.
 */
export const text: Record<string, TextStyle> = {
    display: { size: "clamp(2rem, 1.45rem + 2.35vw, 3rem)", line: "1.08", weight: 650, tracking: "-0.035em" },
    h1: { size: "clamp(1.625rem, 1.4rem + 0.95vw, 2rem)", line: "1.2", weight: 640, tracking: "-0.028em" },
    h2: { size: "1.25rem", line: "1.75rem", weight: 620, tracking: "-0.02em" },
    h3: { size: "1rem", line: "1.5rem", weight: 600, tracking: "-0.012em" },
    h4: { size: "0.875rem", line: "1.25rem", weight: 600, tracking: "-0.006em" },
    "body-lg": { size: "1.0625rem", line: "1.75rem", weight: 400, tracking: "-0.011em" },
    body: { size: "0.9375rem", line: "1.5rem", weight: 400, tracking: "-0.009em", desktop: { size: "0.875rem", line: "1.375rem" } },
    "body-sm": { size: "0.8125rem", line: "1.25rem", weight: 400, tracking: "-0.004em" },
    label: { size: "0.8125rem", line: "1rem", weight: 550, tracking: "-0.004em" },
    caption: { size: "0.75rem", line: "1rem", weight: 500, tracking: "0em" },
    micro: { size: "0.6875rem", line: "0.875rem", weight: 550, tracking: "0.01em" },
    code: { size: "0.8125rem", line: "1.25rem", weight: 450, tracking: "0em", family: "mono" },
};

/** Readable line lengths. Running text never exceeds `measure.body`. */
export const measure = { body: "66ch", narrow: "48ch" };

/* ── Space, geometry, elevation ───────────────────────────────────────── */

export const space: Record<string, string> = {
    "0": "0px", "0.5": "2px", "1": "4px", "1.5": "6px", "2": "8px", "3": "12px", "4": "16px",
    "5": "20px", "6": "24px", "8": "32px", "10": "40px", "12": "48px", "16": "64px", "20": "80px", "24": "96px",
};

/** Layout spacing that changes with the screen. phone → tablet (768) → desktop (1024). */
export const spaceResponsive = {
    "page-x": ["16px", "24px", "32px"],
    section: ["64px", "80px", "96px"],
} as const;

export const radius = { xs: "4px", sm: "6px", md: "8px", lg: "12px", xl: "16px", "2xl": "24px", full: "9999px" };

export const shadow: Record<string, ThemePair> = {
    "1": {
        light: "0 0 0 1px rgba(9,9,11,.06), 0 1px 2px rgba(9,9,11,.05)",
        dark: "0 0 0 1px rgba(255,255,255,.06), 0 1px 2px rgba(0,0,0,.4)",
    },
    "2": {
        light: "0 0 0 1px rgba(9,9,11,.07), 0 2px 4px -1px rgba(9,9,11,.06), 0 6px 14px -6px rgba(9,9,11,.10)",
        dark: "0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.04), 0 6px 14px -6px rgba(0,0,0,.55)",
    },
    "3": {
        light: "0 0 0 1px rgba(9,9,11,.07), 0 4px 8px -4px rgba(9,9,11,.08), 0 16px 36px -12px rgba(9,9,11,.20)",
        dark: "0 0 0 1px rgba(255,255,255,.09), inset 0 1px 0 rgba(255,255,255,.05), 0 16px 36px -12px rgba(0,0,0,.75)",
    },
    "4": {
        light: "0 0 0 1px rgba(9,9,11,.08), 0 8px 16px -8px rgba(9,9,11,.10), 0 32px 64px -16px rgba(9,9,11,.28)",
        dark: "0 0 0 1px rgba(255,255,255,.10), inset 0 1px 0 rgba(255,255,255,.06), 0 32px 64px -16px rgba(0,0,0,.85)",
    },
};

/** The light edge on top of filled buttons. */
export const highlight = { light: "inset 0 1px 0 rgba(255,255,255,.20)", dark: "inset 0 1px 0 rgba(255,255,255,.18)" };

/* ── Motion ───────────────────────────────────────────────────────────── */

export const duration = { instant: "100ms", fast: "160ms", base: "240ms", slow: "360ms" };
export const easing = {
    standard: "cubic-bezier(.2, .8, .2, 1)", // most state changes
    out: "cubic-bezier(.16, 1, .3, 1)", // things moving into place
    in: "cubic-bezier(.4, 0, 1, 1)", // things leaving
    spring: "cubic-bezier(.34, 1.45, .64, 1)", // only for things that appear
};

/* ── Sizes, layers, breakpoints, layout ───────────────────────────────── */

export const size = {
    "control-sm": "28px", "control-md": "32px", "control-lg": "40px", "control-xl": "44px",
    tap: "44px",
    "icon-xs": "12px", "icon-sm": "14px", "icon-md": "16px", "icon-lg": "20px", "icon-xl": "24px",
};

export const z = { base: 0, raised: 10, sticky: 20, nav: 30, dropdown: 40, overlay: 50, modal: 60, toast: 70, tooltip: 80 };

export const breakpoint = { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1440px", "3xl": "1920px" };

export const layout = {
    sidebar: "256px", topbar: "56px", inspector: "360px",
    reading: "640px", form: "720px", content: "1200px", wide: "1440px",
};

export const tokens = { color, colorAlpha, font, text, measure, space, spaceResponsive, radius, shadow, highlight, duration, easing, size, z, breakpoint, layout };
export default tokens;

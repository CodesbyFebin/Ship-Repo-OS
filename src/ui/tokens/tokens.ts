/**
 * AMNT design tokens — Material Design 3.
 *
 * This file holds the *rules*: the seed colour, the role list, the type scale,
 * shape, elevation, motion and the window size classes. It deliberately holds
 * almost no colour values, because AMNT does not pick colours — Google's own
 * `@material/material-color-utilities` generates both schemes from the seed at
 * build time. `npm run tokens:build` writes `tokens.css` and
 * `tokens.generated.json`; `tailwind.config.ts` reads this file directly.
 *
 * Nothing here is hand-tuned by eye. If a colour looks wrong, the seed or the
 * variant is wrong — never a single hex.
 *
 * Spec: https://m3.material.io/
 */

/* ── The scheme ───────────────────────────────────────────────────────────
 * Pinned so a library update can never silently repaint the product. M3
 * shipped a new colour spec in 2025; the 2021 baseline put `#6750A4` itself
 * in the `primary` slot, the 2025 one resolves it to `#65558F`. We follow the
 * spec M3 ships today, and we say which one in writing.
 */
export const scheme = {
    /** Ink (owner, 2026-10-21): black and white; the art is the only colour.
        The seed only feeds the generator; every role is set in `overrides`. */
    seed: "#000000",
    /** `SchemeTonalSpot` — the M3 default. */
    variant: "tonal-spot",
    /** The colour spec version. 2025 is what M3 ships today. */
    spec: 2025,
    /** 0 = standard. Higher values are the user-facing contrast preference. */
    contrast: 0,
} as const;

/**
 * The system colour roles AMNT uses, as the CSS custom property suffix →
 * the library's `MaterialDynamicColors` key. Pages and components only ever
 * touch these; the reference tonal palettes underneath are never exposed.
 *
 * The `*Fixed` family is deliberately left out: it exists for layouts that
 * keep one colour across light and dark, which nothing here does. Add it when
 * a screen actually needs it.
 */
export const colorRoles: Record<string, string> = {
    primary: "primary",
    "on-primary": "onPrimary",
    "primary-container": "primaryContainer",
    "on-primary-container": "onPrimaryContainer",

    secondary: "secondary",
    "on-secondary": "onSecondary",
    "secondary-container": "secondaryContainer",
    "on-secondary-container": "onSecondaryContainer",

    tertiary: "tertiary",
    "on-tertiary": "onTertiary",
    "tertiary-container": "tertiaryContainer",
    "on-tertiary-container": "onTertiaryContainer",

    error: "error",
    "on-error": "onError",
    "error-container": "errorContainer",
    "on-error-container": "onErrorContainer",

    surface: "surface",
    "on-surface": "onSurface",
    "surface-variant": "surfaceVariant",
    "on-surface-variant": "onSurfaceVariant",
    "surface-dim": "surfaceDim",
    "surface-bright": "surfaceBright",
    "surface-container-lowest": "surfaceContainerLowest",
    "surface-container-low": "surfaceContainerLow",
    "surface-container": "surfaceContainer",
    "surface-container-high": "surfaceContainerHigh",
    "surface-container-highest": "surfaceContainerHighest",
    "surface-tint": "surfaceTint",

    background: "background",
    "on-background": "onBackground",

    outline: "outline",
    "outline-variant": "outlineVariant",

    "inverse-surface": "inverseSurface",
    "inverse-on-surface": "inverseOnSurface",
    "inverse-primary": "inversePrimary",

    scrim: "scrim",
    shadow: "shadow",
};

/**
 * M3 custom colours (m3.material.io/styles/color/advanced/define-new-colors):
 * a colour the baseline has no role for, given the same four roles
 * (`x`, `on-x`, `x-container`, `on-x-container`) from its own tonal palette,
 * in both schemes. Not a hex in a page: a role, like every other colour.
 *
 * `premium` is the gold on Pro items (owner, 2026-09-27). Not blended toward
 * the seed: blending turns gold orange.
 *
 * `positive` is the green on Save (owner, 2026-09-27: "Save as an icon, in a
 * nice green"). One button, never a status colour: a word or an icon still
 * says what it means. Not blended: blending turns green grey-teal.
 *
 * `rare` is the cyan of the Rare tier (owner, 2026-10-01): every rarity tier
 * has its own colour, the same everywhere. Not blended, or it turns violet.
 */
export const customColors: Record<string, { value: string; blend: boolean }> = {
    premium: { value: "#D4A020", blend: false },
    positive: { value: "#2E9E5B", blend: false },
    rare: { value: "#00A3C4", blend: false },
};
export const customRoleNames = (name: string) => [name, `on-${name}`, `${name}-container`, `on-${name}-container`];

/**
 * Contrast pairs the build enforces, in both schemes. M3's baseline is meant
 * to pass these, so a failure means the seed, the variant or the spec version
 * moved — which is exactly what we want the build to catch.
 *
 * 4.5:1 is the WCAG AA text floor, 3:1 the non-text floor, 7:1 AAA for body
 * text on its own surface.
 */
export const contrastPairs: Array<[fg: string, bg: string, min: number]> = [
    ["on-surface", "surface", 7],
    ["on-surface", "surface-container-lowest", 4.5],
    ["on-surface", "surface-container-low", 4.5],
    ["on-surface", "surface-container", 4.5],
    ["on-surface", "surface-container-high", 4.5],
    ["on-surface", "surface-container-highest", 4.5],
    ["on-surface-variant", "surface", 4.5],
    ["on-surface-variant", "surface-container", 4.5],
    ["on-background", "background", 7],
    ["on-primary", "primary", 4.5],
    ["on-primary-container", "primary-container", 4.5],
    ["on-secondary", "secondary", 4.5],
    ["on-secondary-container", "secondary-container", 4.5],
    ["on-tertiary", "tertiary", 4.5],
    ["on-tertiary-container", "tertiary-container", 4.5],
    ["on-error", "error", 4.5],
    ["on-error-container", "error-container", 4.5],
    ["on-premium", "premium", 4.5],
    ["on-premium-container", "premium-container", 4.5],
    ["on-positive", "positive", 4.5],
    ["on-positive-container", "positive-container", 4.5],
    ["inverse-on-surface", "inverse-surface", 4.5],
    /* Used as accent text and as icon/border colour on the page surface.
       4.2, not 4.5 (2026-10-09): one blue can't carry white button text at
       4.5 AND sit on a near-black page at 4.5. The button wins; dark-mode
       links are 4.27:1 and always medium weight or underlined. */
    ["primary", "surface", 4.2],
    ["error", "surface", 4.5],
    /* Non-text: borders, dividers, unselected control outlines. */
    ["outline", "surface", 3],
    ["outline", "surface-container", 3],
    ["outline", "surface-container-highest", 3],
];

/**
 * State layers — M3's one mechanism for hover/focus/pressed. The *content*
 * colour is laid over the component at these opacities. There is exactly one
 * implementation, in `src/ui/state-layer.ts`; nothing else may invent a
 * hover colour.
 */
export const stateLayer = { hover: 0.08, focus: 0.1, pressed: 0.1, dragged: 0.16 } as const;

/** Opacities M3 uses for disabled content and its container. */
export const disabled = { content: 0.38, container: 0.12 } as const;

/* ── Typography ───────────────────────────────────────────────────────── */

export const font = {
    /**
     * Figtree (2026-10-03; was Roboto Flex, before that Inter). The closest
     * free face to Google Sans, M3's brand font. One family, variable.
     *
     * ⚠️ The `var()` carries its own fallback on purpose. A custom property
     * whose value contains an UNRESOLVABLE `var()` is invalid at computed-value
     * time — it does not fall back to the rest of the list, it computes to
     * nothing and inherits as nothing, and every page silently renders in
     * Times. That shipped once, on 2026-09-20, because `--font-brand` was on
     * <body> while this token is declared on `:root`. The class now lives on
     * <html>; this fallback is the second lock, so the same mistake degrades to
     * the system sans instead of to a serif.
     */
    sans: 'var(--font-brand, ui-sans-serif), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    /** Martian Mono (Ink, 2026-10-21): the same face as `sans`. */
    mono: 'var(--font-brand-mono, ui-monospace), ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    /** AMNT Pixel (Ink, 2026-10-21): our own caps-only face, the Display roles
        only. Built by scripts/amnt-pixel-font.py; a missing glyph falls back to the mono. */
    display: 'var(--font-display, ui-monospace), var(--font-brand-mono, ui-monospace), ui-monospace, monospace',
};

export type TypeStyle = {
    size: string;
    line: string;
    weight: number;
    tracking: string;
};

/**
 * The M3 type scale, all fifteen roles. Sizes are the spec's, in rem at a
 * 16px root.
 *
 * AMNT difference (recorded per law 2): the three Display sizes are fluid
 * between 360px and 1280px. 57px display type on a 360px phone is unusable,
 * and M3's own adaptive guidance is to step type down on compact windows — a
 * clamp is that, expressed once instead of at three breakpoints.
 *
 * AMNT addition (2026-10-03): `display-xl`, the page hero's h1 only - bigger
 * and bold, M3 Expressive's "emphasized" display (owner: the hero title must
 * be bold, with a nice shape). 44px on a phone, 76px on a desktop.
 *
 * AMNT difference (2026-10-04): weight and tracking are not M3's.
 *
 *   M3 sets every Display, Headline and Title role at weight 400. That is
 *   right for an Android system UI, where a heading is usually alone on a
 *   row and size alone carries the hierarchy. It is wrong here: at 24px a
 *   400 headline is indistinguishable from body text, so a dense page has no
 *   visible hierarchy at all. Headings are 600.
 *
 *   One rule, no optical compensation. Big apps (Vercel, Linear, Stripe)
 *   run a uniform 600 across their display/headline range rather than
 *   stepping weight down as size grows; stepping it down reads inconsistent
 *   rather than refined (a 500 display-lg next to a 600 display-sm makes
 *   the larger size look lighter than the smaller). `display-xl` is 800 -
 *   the page hero only, owner's pick - heavier than the rest on purpose.
 *
 *   Tracking is the spec's px value converted to em, except that headings
 *   get NEGATIVE tracking and body loses most of its positive tracking.
 *   M3's body-large is +0.031em, which is a lot on Figtree: Figtree is a
 *   wide geometric face, so the spec's letterspacing opens it further and
 *   running text reads airy instead of solid. Headings tighten as they grow
 *   (bigger type needs less air), body sits near zero, and labels keep M3's
 *   positive tracking because small caps-like text genuinely needs it.
 *
 *   This also fixes an outright inversion in the spec's scale: M3 has
 *   `title-lg` (22px) at 400 and `title-md` (16px) at 500, so the LARGER
 *   title rendered LIGHTER than the smaller one. Both are 600 now.
 */
export const typescale: Record<string, TypeStyle> = {
    /* 2026-10-21, Ink: Display is AMNT Pixel (its letter gap is drawn into
       the font, so tracking 0); everything else is Martian Mono, a monospace,
       which wants almost no tracking. Headings 600, body 400. */
    "display-xl": { size: "clamp(2.5rem, 1.45rem + 4.6vw, 4.5rem)", line: "1.05", weight: 700, tracking: "0em" },
    "display-lg": { size: "clamp(2.5rem, 1.9rem + 2.7vw, 3.5rem)", line: "1.1", weight: 700, tracking: "0em" },
    "display-md": { size: "clamp(2rem, 1.62rem + 1.7vw, 2.75rem)", line: "1.12", weight: 700, tracking: "0em" },
    "display-sm": { size: "clamp(1.75rem, 1.52rem + 1vw, 2.25rem)", line: "1.15", weight: 700, tracking: "0em" },

    "headline-lg": { size: "1.875rem", line: "2.375rem", weight: 600, tracking: "-0.02em" },
    "headline-md": { size: "1.5rem", line: "2rem", weight: 600, tracking: "-0.02em" },
    "headline-sm": { size: "1.25rem", line: "1.75rem", weight: 600, tracking: "-0.015em" },

    "title-lg": { size: "1.0625rem", line: "1.625rem", weight: 600, tracking: "-0.01em" },
    "title-md": { size: "0.9375rem", line: "1.5rem", weight: 600, tracking: "-0.01em" },
    "title-sm": { size: "0.8125rem", line: "1.25rem", weight: 600, tracking: "0em" },

    "body-lg": { size: "0.9375rem", line: "1.625rem", weight: 400, tracking: "-0.01em" },
    "body-md": { size: "0.8125rem", line: "1.375rem", weight: 400, tracking: "-0.01em" },
    "body-sm": { size: "0.75rem", line: "1.125rem", weight: 400, tracking: "0em" },

    "label-lg": { size: "0.8125rem", line: "1.25rem", weight: 500, tracking: "-0.01em" },
    "label-md": { size: "0.75rem", line: "1rem", weight: 500, tracking: "0em" },
    "label-sm": { size: "0.6875rem", line: "1rem", weight: 500, tracking: "0em" },
};

/** Readable line lengths. Running text never exceeds `measure.body`. */
export const measure = { body: "66ch", narrow: "48ch" };

/* ── Shape ────────────────────────────────────────────────────────────── */

/**
 * The M3 shape scale. Component mappings live in each component's doc block,
 * not here: chips/badges `small`, buttons `full`, dense data actions `small`,
 * cards `medium`, dialogs and sheets `extra-large`.
 */
export const shape = {
    /* Ink (owner, 2026-10-21): square. Every control, card and sheet has a
       0 corner; only `full` stays round (avatars, swatches, switches, dots). */
    none: "0px",
    "extra-small": "0px",
    small: "0px",
    medium: "0px",
    large: "0px",
    "extra-large": "0px",
    full: "9999px",
} as const;

/* ── Elevation ────────────────────────────────────────────────────────── */

/**
 * M3's six levels, as published. In light mode a level is this shadow plus a
 * surface tint; in dark mode elevation is expressed by moving *up* the
 * `surface-container` ladder instead — dark surfaces do not gain shadow.
 *
 * 0 flat · 1 card · 2 hover/raised · 3 menu, dialog, snackbar ·
 * 4–5 reserved (pressed FAB, modal nav drawer).
 */
export const elevation: Record<string, string> = {
    /* 2026-10-09: soft and short, with a hairline ring from level 2 up, so a
       menu or dialog has an edge in light mode without a drawn border. M3's
       30% shadows read heavy and dated. */
    "0": "none",
    "1": "0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.04)",
    "2": "0 0 0 1px rgb(0 0 0 / 0.04), 0 2px 4px -1px rgb(0 0 0 / 0.06), 0 6px 16px -4px rgb(0 0 0 / 0.08)",
    "3": "0 0 0 1px rgb(0 0 0 / 0.05), 0 4px 8px -2px rgb(0 0 0 / 0.06), 0 16px 32px -8px rgb(0 0 0 / 0.16)",
    "4": "0 0 0 1px rgb(0 0 0 / 0.05), 0 8px 16px -4px rgb(0 0 0 / 0.08), 0 24px 48px -12px rgb(0 0 0 / 0.20)",
    "5": "0 0 0 1px rgb(0 0 0 / 0.06), 0 12px 24px -6px rgb(0 0 0 / 0.10), 0 32px 64px -16px rgb(0 0 0 / 0.24)",
};

/** The `surface-container` step each elevation level maps to in dark mode. */
export const elevationSurface: Record<string, string> = {
    "0": "surface",
    "1": "surface-container-low",
    "2": "surface-container",
    "3": "surface-container-high",
    "4": "surface-container-high",
    "5": "surface-container-highest",
};

/* ── Motion ───────────────────────────────────────────────────────────── */

export const easing = {
    emphasized: "cubic-bezier(0.2, 0, 0, 1)",
    "emphasized-decelerate": "cubic-bezier(0.05, 0.7, 0.1, 1)",
    "emphasized-accelerate": "cubic-bezier(0.3, 0, 0.8, 0.15)",
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    "standard-decelerate": "cubic-bezier(0, 0, 0, 1)",
    "standard-accelerate": "cubic-bezier(0.3, 0, 1, 1)",
    linear: "linear",
} as const;

export const duration = {
    short1: "50ms", short2: "100ms", short3: "150ms", short4: "200ms",
    medium1: "250ms", medium2: "300ms", medium3: "350ms", medium4: "400ms",
    long1: "450ms", long2: "500ms", long3: "550ms", long4: "600ms",
    "extra-long1": "700ms", "extra-long2": "800ms", "extra-long3": "900ms", "extra-long4": "1000ms",
} as const;

/**
 * M3 Expressive springs — the 2025 motion scheme Android ships.
 *
 * Numbers are Google's own: androidx `ExpressiveMotionTokens.kt` (damping
 * ratio, stiffness, mass 1). `tokens-build` turns each into a CSS `linear()`
 * curve plus the time it takes to settle, emitted as
 * `--md-sys-motion-spring-<name>` and `--md-sys-motion-spring-<name>-duration`.
 *
 *   spatial  something MOVES or GROWS (menu, sheet, press, a tile landing).
 *            Under-damped: it overshoots a hair and settles — the "alive" feel.
 *   effects  colour or opacity changes. Critically damped: no overshoot,
 *            because a colour that overshoots is a flicker.
 *
 * fast = small things (a button, a chip) · default = a menu, a card ·
 * slow = something that crosses the screen (a sheet, a page).
 */
export const spring = {
    "fast-spatial": { damping: 0.6, stiffness: 800 },
    "default-spatial": { damping: 0.8, stiffness: 380 },
    "slow-spatial": { damping: 0.8, stiffness: 200 },
    "fast-effects": { damping: 1, stiffness: 3800 },
    "default-effects": { damping: 1, stiffness: 1600 },
    "slow-effects": { damping: 1, stiffness: 800 },
} as const;

/* ── Adaptive layout ──────────────────────────────────────────────────── */

/**
 * M3 window size classes — the *only* breakpoints. Each one also fixes the
 * page gutter and the navigation component, so a layout can never disagree
 * with itself about which class it is in.
 */
/* Ink (owner, 2026-10-21: "relaxing, perfect spacing from the sides"): one
   step roomier than M3's 16/24/24/32 at every size. */
export const windowClass = {
    compact: { min: "0px", gutter: "20px", nav: "bar" },
    medium: { min: "600px", gutter: "32px", nav: "rail" },
    expanded: { min: "840px", gutter: "40px", nav: "rail" },
    large: { min: "1200px", gutter: "48px", nav: "drawer" },
    xlarge: { min: "1600px", gutter: "48px", nav: "drawer" },
} as const;

/** Tailwind `screens`, derived so the two can never drift apart. */
export const breakpoint = Object.fromEntries(
    Object.entries(windowClass).filter(([, w]) => w.min !== "0px").map(([k, w]) => [k, w.min]),
) as Record<Exclude<keyof typeof windowClass, "compact">, string>;

/* ── Size, space, layers ──────────────────────────────────────────────── */

/** M3's 4dp grid. */
export const space: Record<string, string> = {
    "0": "0px", "1": "4px", "2": "8px", "3": "12px", "4": "16px", "5": "20px",
    "6": "24px", "7": "28px", "8": "32px", "10": "40px", "12": "48px",
    "14": "56px", "16": "64px", "20": "80px", "24": "96px",
};

export const size = {
    /** M3's minimum touch target. Never smaller, whatever the visual box. */
    touch: "48px",
    /** Component heights from the M3 component specs. */
    "button-xs": "32px", "button-sm": "40px", "button-md": "40px", "button-lg": "56px",
    "icon-button": "40px",
    "field": "56px", "field-dense": "48px",
    "app-bar": "64px", "app-bar-compact": "56px",
    "nav-bar": "80px", "nav-rail": "80px", "nav-drawer": "360px",
    "icon-sm": "18px", "icon-md": "24px", "icon-lg": "32px", "icon-xl": "40px",
};

export const z = { base: 0, raised: 10, sticky: 20, nav: 30, dropdown: 40, overlay: 50, modal: 60, snackbar: 70, tooltip: 80 };

export const layout = {
    reading: "640px", form: "720px", content: "1200px", wide: "1440px",
    "nav-rail": "80px", "nav-drawer": "360px", "side-sheet": "400px",
};

/* ── AMNT extensions ──────────────────────────────────────────────────────
 * Not new colours — a map from a product state to the M3 role that shows it.
 * §2.1 of the plan forbids inventing semantic colours, and it is a law, so
 * money, agent lifecycle and payment state are drawn with M3 roles plus an
 * icon and a word. Colour alone never carries the meaning.
 */
export const semantic = {
    /** Money that arrived. Shown with `primary` + an arrow + the word "earned". */
    "money-in": "primary",
    "money-out": "on-surface-variant",
    "agent-live": "positive",
    "agent-running": "primary",
    "agent-paused": "on-surface-variant",
    "agent-failed": "error",
    "agent-draft": "outline",
    "pay-settled": "primary",
    "pay-pending": "tertiary",
    "pay-failed": "error",
} as const;

/** Numbers never jitter: every price, count, balance and id is tabular. */
export const numeric = { fontFeatureSettings: '"tnum", "kern"' };

/** The one accent: every accent role points at primary. */
const foldToPrimary = {
    premium: "primary",
    "on-premium": "on-primary",
    "premium-container": "primary-container",
    "on-premium-container": "on-primary-container",
    positive: "primary",
    "on-positive": "on-primary",
    "positive-container": "primary-container",
    "on-positive-container": "on-primary-container",
    rare: "primary",
    "on-rare": "on-primary",
    "rare-container": "primary-container",
    "on-rare-container": "on-primary-container",
};

/**
 * Ink (owner, 2026-10-21: picked direction 4 of 4).
 *
 * Black and white. The ART is the only colour on the page. The accent is the
 * ink itself: black in light, white in dark, on the things you act on (main
 * button, link, selected, focus). Greys are pure neutral, no tint.
 *
 * Colours that mean something stay, used for meaning only and always next to
 * a word or an icon: error red, the green Save, the cyan Rare tier.
 * `premium` is ink, like the rest.
 *
 * Hand-picked, so the build's contrast gate is what keeps them honest.
 */
export const overrides: Record<"light" | "dark", Record<string, string>> = {
    light: {
        background: "#FFFFFF",
        "on-background": "#000000",
        surface: "#FFFFFF",
        "on-surface": "#000000",
        "surface-variant": "#F2F2F2",
        "on-surface-variant": "#5C5C5C",
        "surface-dim": "#EBEBEB",
        "surface-bright": "#FFFFFF",
        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#F7F7F7",
        "surface-container": "#F2F2F2",
        "surface-container-high": "#EBEBEB",
        "surface-container-highest": "#E3E3E3",
        "surface-tint": "#000000",
        outline: "#737373",
        "outline-variant": "#E3E3E3",

        primary: "#000000",
        "on-primary": "#FFFFFF",
        "primary-container": "#EBEBEB",
        "on-primary-container": "#000000",
        "inverse-primary": "#FFFFFF",

        /* `secondary` is read as an accent by ~150 older classes (links,
           dots, "bg-secondary/10" tints), so it IS the ink. */
        secondary: "#000000",
        "on-secondary": "#FFFFFF",
        "secondary-container": "#EBEBEB",
        "on-secondary-container": "#000000",
        tertiary: "#5C5C5C",
        "on-tertiary": "#FFFFFF",
        "tertiary-container": "#EBEBEB",
        "on-tertiary-container": "#000000",

        error: "#D42A1F",
        "on-error": "#FFFFFF",
        "error-container": "#FEEDEB",
        "on-error-container": "#7A1C14",

        premium: "#000000",
        "on-premium": "#FFFFFF",
        "premium-container": "#EBEBEB",
        "on-premium-container": "#000000",
        positive: "#137A3E",
        "on-positive": "#FFFFFF",
        "positive-container": "#E6F6EC",
        "on-positive-container": "#0B4A25",
        rare: "#0B7285",
        "on-rare": "#FFFFFF",
        "rare-container": "#E3F6F9",
        "on-rare-container": "#08414C",

        "inverse-surface": "#000000",
        "inverse-on-surface": "#FFFFFF",
        scrim: "#000000",
        shadow: "#000000",
    },
    dark: {
        background: "#000000",
        "on-background": "#FFFFFF",
        surface: "#000000",
        "on-surface": "#FFFFFF",
        "surface-variant": "#1A1A1A",
        "on-surface-variant": "#A3A3A3",
        "surface-dim": "#000000",
        "surface-bright": "#2B2B2B",
        "surface-container-lowest": "#000000",
        "surface-container-low": "#0A0A0A",
        "surface-container": "#121212",
        "surface-container-high": "#1A1A1A",
        "surface-container-highest": "#242424",
        "surface-tint": "#FFFFFF",
        outline: "#7C7C7C",
        "outline-variant": "#262626",

        primary: "#FFFFFF",
        "on-primary": "#000000",
        "primary-container": "#262626",
        "on-primary-container": "#FFFFFF",
        "inverse-primary": "#000000",

        secondary: "#FFFFFF",
        "on-secondary": "#000000",
        "secondary-container": "#242424",
        "on-secondary-container": "#FFFFFF",
        tertiary: "#A3A3A3",
        "on-tertiary": "#000000",
        "tertiary-container": "#242424",
        "on-tertiary-container": "#FFFFFF",

        error: "#FF6B61",
        "on-error": "#2A0805",
        "error-container": "#3A1310",
        "on-error-container": "#FFCBC6",

        premium: "#FFFFFF",
        "on-premium": "#000000",
        "premium-container": "#262626",
        "on-premium-container": "#FFFFFF",
        positive: "#4ADE80",
        "on-positive": "#052E16",
        "positive-container": "#0D2A19",
        "on-positive-container": "#BBF7D0",
        rare: "#3CCFE6",
        "on-rare": "#04313A",
        "rare-container": "#0A2A31",
        "on-rare-container": "#B5F1FA",

        "inverse-surface": "#FFFFFF",
        "inverse-on-surface": "#000000",
        scrim: "#000000",
        shadow: "#000000",
    },
};

export const tokens = {
    scheme, colorRoles, customColors, contrastPairs, stateLayer, disabled,
    font, typescale, measure, shape, elevation, elevationSurface,
    easing, duration, spring, windowClass, breakpoint, space, size, z, layout, semantic, numeric,
    overrides, foldToPrimary,
};
export default tokens;

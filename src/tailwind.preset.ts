import type { Config } from "tailwindcss";
import * as m3 from "./ui/tokens/tokens.ts";
import * as legacy from "./ui/tokens/legacy.ts";

/**
 * Two worlds, on purpose — plans/DESIGN-SYSTEM.md §1.
 *
 * **M3** is the design system: every utility below built from `m3.*` is the
 * real one, and it is what a page composed from `@/ui` uses.
 *
 * **legacy** is the frozen pre-M3 set, kept only so the pages that have not
 * been rebuilt yet keep rendering. Every legacy key is marked. They are all
 * deleted in S11, together with `src/ui/tokens/legacy.ts` and `legacy.css`.
 *
 * The two never meet inside one page. Where a name collided, the LEGACY one
 * was renamed and its call sites swept (`text-primary` → `text-ink`,
 * `bg-primary` → `bg-ink`, `text-body-lg` → `text-legacy-lg`), because the
 * M3 role names are the ones that survive.
 */

/** An M3 colour role that still accepts Tailwind's `/NN` opacity modifier. */
const md = (role: string) => `rgb(var(--md-sys-color-${role}-rgb) / <alpha-value>)`;
/** The same, for a legacy token. */
const old = (name: string) => `rgb(var(--amnt-color-${name.replace(/\./g, "-")}-rgb) / <alpha-value>)`;

/** One M3 type role: size, line, tracking and weight always travel together. */
const typeStep = (n: string): [string, { lineHeight: string; letterSpacing: string; fontWeight: string }] => [
  `var(--md-sys-typescale-${n}-size)`,
  {
    lineHeight: `var(--md-sys-typescale-${n}-line-height)`,
    letterSpacing: `var(--md-sys-typescale-${n}-tracking)`,
    fontWeight: `var(--md-sys-typescale-${n}-weight)`,
  },
];
/** One legacy type step. Deleted in S11. */
const oldStep = (n: string): [string, { lineHeight: string; letterSpacing: string; fontWeight: string }] => [
  `var(--amnt-text-${n}-size)`,
  { lineHeight: `var(--amnt-text-${n}-line)`, letterSpacing: `var(--amnt-text-${n}-tracking)`, fontWeight: `var(--amnt-text-${n}-weight)` },
];

/**
 * The M3 system colour roles, as `bg-*` / `text-*` / `border-*` / `fill-*`.
 * `background` and `on-background` are deliberately absent: M3 2025 resolves
 * them to the same values as `surface` / `on-surface`, and `bg-background`
 * already means the legacy HSL colour on 51 not-yet-migrated call sites.
 */
const M3_COLORS = Object.fromEntries(
  [...Object.keys(m3.colorRoles).filter(r => r !== "background" && r !== "on-background"), ...Object.keys(m3.customColors).flatMap(m3.customRoleNames)].map(r => [r, md(r)]),
);

/**
 * AMNT UI's Tailwind preset: the Ink colour roles, type scale, shapes,
 * motion and breakpoints (medium 600, expanded 840, large 1200, xlarge 1600).
 *
 *   // tailwind.config.ts
 *   import ink from "./tailwind.preset";
 *   export default { presets: [ink], content: ["./src/<every folder>/<every .tsx file>"] };
 */
const config = {
  darkMode: "class",
  // `hover:` only where a real pointer exists. On a phone a tap left every
  // button's hover fill stuck on (the pale circle behind the menu icon).
  future: { hoverOnlyWhenSupported: true },
  prefix: "",
  theme: {
    /**
     * M3 window size classes (§2.6) are the real breakpoints: `medium:` 600,
     * `expanded:` 840, `large:` 1200, `xlarge:` 1600. Compact is the unprefixed
     * base — phone first means no prefix is the phone.
     *
     * The legacy `sm/md/lg/xl/2xl/3xl` screens are still here because several
     * thousand class names use them; they go in S11.
     */
    screens: { ...legacy.breakpoint, ...m3.breakpoint },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /**
       * Viewport units and the touch floor.
       *
       * ⚠️ This project is on Tailwind **3.3.2**. `h-dvh`, `min-h-dvh`, `h-svh`
       * and `size-*` were added in 3.4, so on this version they compile to
       * NOTHING - silently, the same way a misspelled token does. `h-screen`
       * is 100vh, and 100vh on iOS Safari is taller than the visible screen,
       * so the foot of every centred page sat under the address bar. These
       * five keys are the whole fix; there is no plugin and nothing to upgrade.
       */
      height: {
        dvh: "100dvh",
        svh: "100svh",
        lvh: "100lvh",
        touch: m3.size.touch,
      },
      minHeight: {
        // Without this the whole spacing scale is missing from min-h-*, and
        // `min-h-8` compiles to nothing at all - silently, like any typo.
        ...legacy.space,
        dvh: "100dvh",
        svh: "100svh",
        lvh: "100lvh",
        // M3's minimum touch target, §2.7. `min-h-touch` is what a control
        // uses when its visual box is 40px but its hit area has to be 48px.
        touch: m3.size.touch,
        // legacy: the old 44px Apple floor. Deleted in S11.
        tap: "44px",
      },
      minWidth: {
        touch: m3.size.touch,
        tap: "44px", // legacy
      },
      maxHeight: {
        dvh: "100dvh",
        svh: "100svh",
        lvh: "100lvh",
      },

      /**
       * The M3 type scale (§2.2) — fifteen roles, one family. Each class sets
       * size, line height, tracking and weight together, so a heading can never
       * get the right size with the wrong leading. Display steps are fluid
       * between 360px and 1280px.
       *
       * Everything below the M3 block is legacy and goes in S11.
       */
      fontSize: {
        ...Object.fromEntries(Object.keys(m3.typescale).map(n => [n, typeStep(n)])),

        /* legacy — deleted in S11 */
        ...Object.fromEntries(Object.keys(legacy.text).filter(n => !(n in m3.typescale)).map(n => [n, oldStep(n)])),
        "legacy-lg": oldStep("body-lg"),
        d1: oldStep("display"),
        d2: oldStep("h1"),
        d3: oldStep("h2"),
        d4: oldStep("h3"),
        "body-xs": oldStep("body-sm"),
        "body-2xs": oldStep("caption"),
        "body-3xs": oldStep("micro"),
      },

      /**
       * One family: Figtree, variable (layout.tsx) — standing in for M3's Google Sans.
       * Plus the system mono for code. Every legacy alias resolves to the same
       * token so nothing breaks while pages migrate.
       */
      fontFamily: {
        sans: ["var(--md-sys-typescale-font)"],
        mono: ["var(--md-sys-typescale-font-mono)"],
        /* legacy aliases — deleted in S11 */
        body: ["var(--md-sys-typescale-font)"],
        heading: ["var(--md-sys-typescale-font)"],
        display: ["var(--md-sys-typescale-font)"],
        serif: ["var(--md-sys-typescale-font)"],
        "mint-display": ["var(--md-sys-typescale-font)"],
        "mint-body": ["var(--md-sys-typescale-font)"],
        // Data typography: prices, ids, timestamps. Tabular digits so a column
        // of numbers lines up and a ticking value never jitters.
        "mint-mono": [["var(--md-sys-typescale-font)"], m3.numeric],
        num: [["var(--md-sys-typescale-font)"], m3.numeric],
      },

      /**
       * M3 system colour roles, plus the legacy semantic names underneath.
       * `colors` feeds every colour family at once (bg-, text-, border-, fill-,
       * stroke-, divide-, ring-, from-/via-/to-), which is what M3 wants: the
       * role is the same colour whatever it is painting.
       */
      colors: {
        ...M3_COLORS,

        /* ── legacy — all of this is deleted in S11 ─────────────────────── */
        // Amnt brand palette ("the Mint"). Every entry reads its `-rgb` triple
        // through `rgb(... / <alpha-value>)` instead of a bare `var(--color-x)`.
        // A bare var() can't be decomposed at build time, so Tailwind silently
        // drops any `/NN` opacity modifier on it.
        mint: {
          bg: "rgb(var(--color-mint-bg-rgb) / <alpha-value>)",
          surface: "rgb(var(--color-mint-surface-rgb) / <alpha-value>)",
          raised: "rgb(var(--color-mint-raised-rgb) / <alpha-value>)",
          border: "rgb(var(--color-mint-border-rgb) / <alpha-value>)",
          "border-warm": "rgb(var(--color-mint-border-rgb) / <alpha-value>)",
          "hot-1": "rgb(var(--color-mint-ember-rgb) / <alpha-value>)",
          "hot-2": "rgb(var(--color-mint-text-2-rgb) / <alpha-value>)",
          text: "rgb(var(--color-mint-text-rgb) / <alpha-value>)",
          "text-2": "rgb(var(--color-mint-text-2-rgb) / <alpha-value>)",
          "text-3": "rgb(var(--color-mint-text-3-rgb) / <alpha-value>)",
          ember: "rgb(var(--color-mint-ember-rgb) / <alpha-value>)",
          "ember-text": "rgb(var(--color-mint-bg-rgb) / <alpha-value>)",
          background: "rgb(var(--color-mint-bg-rgb) / <alpha-value>)",
          gold: "rgb(var(--color-mint-ember-rgb) / <alpha-value>)",
          foil: "rgb(var(--color-mint-text-3-rgb) / <alpha-value>)",
          danger: "rgb(var(--color-mint-danger-rgb) / <alpha-value>)",
          success: "rgb(var(--color-mint-success-rgb) / <alpha-value>)",
          info: "rgb(var(--color-mint-info-rgb) / <alpha-value>)",
          elevated: "rgb(var(--color-mint-elevated-rgb) / <alpha-value>)",
          "surface-2": "rgb(var(--color-mint-raised-rgb) / <alpha-value>)",
          "surface-3": "rgb(var(--color-mint-elevated-rgb) / <alpha-value>)",
          "text-4": "rgb(var(--color-mint-text-3-rgb) / <alpha-value>)",
          "medal-gold":   "rgb(var(--color-mint-medal-gold-rgb) / <alpha-value>)",
          "medal-silver": "rgb(var(--color-mint-medal-silver-rgb) / <alpha-value>)",
          "medal-bronze": "rgb(var(--color-mint-medal-bronze-rgb) / <alpha-value>)",
        },
        // The legacy HSL layer. `primary` and `secondary` are gone from here —
        // those names now belong to M3, and their old call sites were swept to
        // `ink` / `ink-2`.
        ink:        { DEFAULT: "hsl(var(--primary))", 2: "hsl(var(--secondary))" },
        "on-ink":   "hsl(var(--primary-foreground))",
        "on-ink-2": "hsl(var(--secondary-foreground))",
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover:     { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card:        { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },

      /* ── legacy semantic names, per family. Deleted in S11. ─────────────
       * These override `colors` for their own utility family, which is how
       * `bg-page` and `text-muted` keep working on un-migrated pages without
       * shadowing an M3 role of the same name. */
      backgroundColor: {
        canvas: old("bg.canvas"),
        subtle: old("border.subtle"),
        page: old("bg.page"),
        card: { DEFAULT: old("bg.card"), foreground: "hsl(var(--card-foreground))" },
        muted: { DEFAULT: old("bg.muted"), foreground: "hsl(var(--muted-foreground))" },
        emphasis: old("bg.emphasis"),
        overlay: old("bg.overlay"),
        inverse: old("bg.inverse"),
        ink: { DEFAULT: "hsl(var(--primary))", 2: "hsl(var(--secondary))" },
        action: { DEFAULT: old("action.primary"), hover: old("action.primary-hover"), pressed: old("action.primary-pressed"), soft: old("action.primary-soft") },
        "destructive-action": { DEFAULT: old("action.destructive"), hover: old("action.destructive-hover") },
        success: { DEFAULT: old("status.success"), soft: old("status.success-soft") },
        warning: { DEFAULT: old("status.warning"), soft: old("status.warning-soft") },
        danger: { DEFAULT: old("status.danger"), soft: old("status.danger-soft") },
        info: { DEFAULT: old("status.info"), soft: old("status.info-soft") },
        scrim: "var(--amnt-color-overlay-scrim)",
        hover: "var(--amnt-color-overlay-hover)",
        press: "var(--amnt-color-overlay-press)",
      },
      textColor: {
        ink: { DEFAULT: old("text.primary"), 2: old("text.secondary") },
        "on-ink": "hsl(var(--primary-foreground))",
        "on-ink-2": "hsl(var(--secondary-foreground))",
        muted: { DEFAULT: old("text.muted"), foreground: "hsl(var(--muted-foreground))" },
        disabled: old("text.disabled"),
        inverse: old("text.inverse"),
        "on-action": old("text.on-action"),
        accent: { DEFAULT: old("text.accent"), foreground: "hsl(var(--accent-foreground))" },
        success: old("status.success"),
        warning: old("status.warning"),
        danger: old("status.danger"),
        info: old("status.info"),
        money: old("money.positive"),
      },
      borderColor: {
        DEFAULT: old("border.default"),
        subtle: old("border.subtle"),
        default: old("border.default"),
        strong: old("border.strong"),
        focus: old("focus.ring"),
        ink: { DEFAULT: "hsl(var(--primary))", 2: "hsl(var(--secondary))" },
        success: old("status.success"),
        warning: old("status.warning"),
        danger: old("status.danger"),
        info: old("status.info"),
      },
      ringColor: { DEFAULT: old("focus.ring"), focus: old("focus.ring"), danger: old("status.danger") },
      outlineColor: { focus: old("focus.ring") },
      ringOffsetColor: { page: old("bg.page"), surface: md("surface") },

      spacing: {
        /** The window-size-class page gutter (§2.6): 20 → 32 → 40 → 48 (Ink, 2026-10-21). */
        gutter: "var(--md-sys-gutter)",
        /* legacy */
        "page-x": "var(--amnt-space-page-x)",
        section: "var(--amnt-space-section)",
      },
      maxWidth: {
        reading: m3.layout.reading,
        form: m3.layout.form,
        content: m3.layout.content,
        wide: m3.layout.wide,
        measure: m3.measure.body,
        narrow: m3.measure.narrow,
      },
      zIndex: Object.fromEntries(Object.entries(m3.z).map(([k, v]) => [k, String(v)])),

      /**
       * The M3 shape scale (§2.3), spelled out so it can never be confused
       * with the legacy `rounded-sm/md/lg/xl` steps, which are different
       * numbers and are deleted in S11.
       */
      borderRadius: {
        ...Object.fromEntries(Object.entries(m3.shape).map(([k, v]) => [k, v])),
        /* legacy */
        ...legacy.radius,
        DEFAULT: legacy.radius.md,
        "3xl": legacy.radius["2xl"],
        mint: legacy.radius.md,
        "mint-md": legacy.radius.lg,
        "mint-lg": legacy.radius.lg,
        "mint-xl": legacy.radius.xl,
        "mint-2xl": legacy.radius["2xl"],
        "mint-pill": legacy.radius.full,
      },

      /**
       * M3 elevation (§2.4), levels 0–5. In dark mode the shadow resolves to
       * `none` and elevation is expressed by the `surface-container` ladder
       * instead — that is handled in tokens.css, not here.
       */
      boxShadow: {
        ...Object.fromEntries(Object.keys(m3.elevation).map(l => [`level-${l}`, `var(--md-sys-elevation-${l})`])),
        /* Elevation pointing UP, for a bar docked at the foot of the frame or a
           composer over a scrolling canvas. Law 11 removed the 1dp rule those
           used; this is what M3 separates two scroll regions with instead. */
        "level-up": "0 -1px 3px 0 rgb(0 0 0 / 0.10), 0 -1px 2px 0 rgb(0 0 0 / 0.06)",
        /* legacy */
        "elevation-1": "var(--amnt-shadow-1)",
        "elevation-2": "var(--amnt-shadow-2)",
        "elevation-3": "var(--amnt-shadow-3)",
        "elevation-4": "var(--amnt-shadow-4)",
        highlight: "var(--amnt-shadow-highlight)",
        sm: "var(--amnt-shadow-1)",
        DEFAULT: "var(--amnt-shadow-1)",
        md: "var(--amnt-shadow-2)",
        lg: "var(--amnt-shadow-3)",
        xl: "var(--amnt-shadow-3)",
        "2xl": "var(--amnt-shadow-4)",
        card: "var(--amnt-shadow-1)",
        premium: "var(--amnt-shadow-3)",
        inner: "inset 0 1px 2px rgba(0,0,0,0.06)",
        none: "none",
      },

      /** M3 motion (§2.5). Legacy names sit underneath until S11. */
      transitionDuration: {
        ...m3.duration,
        /* M3 Expressive springs: pair `ease-spring-X` with `duration-spring-X`
           (the time that spring takes to settle). tokens.ts `spring`. */
        ...Object.fromEntries(Object.keys(m3.spring).map(k => [`spring-${k.replace("default-", "")}`, `var(--md-sys-motion-spring-${k}-duration)`])),
        instant: legacy.duration.instant,
        fast: legacy.duration.fast,
        base: legacy.duration.base,
        slow: legacy.duration.slow,
      },
      transitionTimingFunction: {
        ...m3.easing,
        ...Object.fromEntries(Object.keys(m3.spring).map(k => [`spring-${k.replace("default-", "")}`, `var(--md-sys-motion-spring-${k})`])),
        /* legacy */
        out: legacy.easing.out,
        in: legacy.easing.in,
        spring: legacy.easing.spring,
        "out-quint": "cubic-bezier(0.23, 1, 0.32, 1)",
      },

      /* tailwindcss-animate (`animate-in fade-in slide-in-from-*`, ~99 uses
         in older pages) defaults to 150ms `ease`. Point its defaults at M3 so
         every one of them arrives like the rest of the system. */
      animationDuration: { DEFAULT: "var(--md-sys-motion-duration-medium1)" },
      /* Its easing has no theme default - that one is in globals.css. */

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "spin-around": {
          from: { transform: "translateZ(0) rotate(0)" },
          to:   { transform: "translateZ(0) rotate(360deg)" },
        },
        title: {
          "0%, 100%": { "background-size": "200% 200%", "background-position": "left center" },
          "50%":      { "background-size": "200% 200%", "background-position": "right center" },
        },
        slide: {
          to: { transform: "translate(calc(100cqw - 100%), 0)" },
        },
        meteor: {
          "0%":   { transform: "rotate(215deg) translateX(0)", opacity: "1" },
          "70%":  { opacity: "1" },
          "100%": { transform: "rotate(215deg) translateX(-500px)", opacity: "0" },
        },
        "border-beam": {
          "100%": { "offset-distance": "100%" },
        },
        rainbow: {
          "0%":   { "background-position": "0%" },
          "100%": { "background-position": "200%" },
        },
        "text-shimmer": {
          "0%, 100%": { "background-size": "200% auto", "background-position": "0 center" },
          "50%":      { "background-size": "200% auto", "background-position": "100% center" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to:   { transform: "translateX(calc(-100% - var(--gap)))" },
        },
        "marquee-reverse": {
          from: { transform: "translateX(calc(-100% - var(--gap)))" },
          to:   { transform: "translateX(0)" },
        },
        "marquee-vertical": {
          from: { transform: "translateY(0)" },
          to:   { transform: "translateY(calc(-100% - var(--gap)))" },
        },
        "slow-pan": {
          "0%":   { objectPosition: "top" },
          "50%":  { objectPosition: "bottom" },
          "100%": { objectPosition: "top" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-up-image": {
          "0%": { transform: "translateY(40px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "dot-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.5)", opacity: "0.5" },
        },
        /* A moving trait in the studio grid: the tile bobs like its NFTs (GPU only; an SVG doing it froze 75 tiles). */
        "tile-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(1.9%)" },
        },
        /* A base's second position fading in and out (SecondPoseSheet preview), two soft taps. */
        "pose-tap": {
          "0%, 100%": { opacity: "0" },
          "50%": { opacity: "1" },
        },
        /* M3: an indeterminate linear progress indicator. */
        "m3-progress": {
          "0%":   { transform: "translateX(-100%) scaleX(0.4)" },
          "50%":  { transform: "translateX(20%) scaleX(0.7)" },
          "100%": { transform: "translateX(100%) scaleX(0.4)" },
        },
      },
      animation: {
        "accordion-down":    "accordion-down 0.2s ease-out",
        "accordion-up":      "accordion-up 0.2s ease-out",
        "spin-around":       "spin-around calc(var(--speed) * 2) infinite linear",
        slide:               "slide var(--speed) ease-in-out infinite alternate",
        meteor:              "meteor 5s linear infinite",
        "border-beam":       "border-beam calc(var(--duration)*1s) infinite linear",
        title:               "title 2s ease-out infinite",
        rainbow:             "rainbow var(--speed, 2s) infinite linear",
        "text-shimmer":      "text-shimmer 6s linear infinite",
        marquee:             "marquee var(--duration) linear infinite",
        "marquee-reverse":   "marquee-reverse var(--duration) linear infinite",
        "marquee-vertical":  "marquee-vertical var(--duration) linear infinite",
        "slow-pan":          "slow-pan 60s ease-in-out infinite",
        "slide-up":          "slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up-image":    "slide-up-image 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in":           "fade-in 0.5s ease-out forwards",
        "dot-pulse":         "dot-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "m3-progress":       "m3-progress 1.8s var(--md-sys-motion-easing-standard) infinite",
        "tile-bob":          "tile-bob 2s ease-in-out infinite",
        "pose-tap":          "pose-tap 0.9s ease-in-out infinite",
      },

      /**
       * The one transition the app is allowed to use on hover and press.
       *
       * `transition-all` was on 246 elements. It animates *every* animatable
       * property, so a card whose hover state changes padding or width made the
       * browser redo layout on every frame for the whole duration - while the
       * cursor was still moving across the grid. Nothing in this list can
       * trigger layout: the compositor handles transform/opacity/filter, and the
       * colour and shadow properties only repaint.
       *
       * Adding width/height/padding/margin/inset/font-size here would undo the
       * whole point. If an element genuinely needs to animate its size, give it
       * `transition-[width]` explicitly so the cost is visible at the call site.
       */
      transitionProperty: {
        state: [
          "transform",
          /* Tailwind 3 and ui.css also move the individual transform
             properties (`scale` on press, `translate` on lift). */
          "scale",
          "translate",
          "rotate",
          "opacity",
          "color",
          "background-color",
          "border-color",
          "text-decoration-color",
          "fill",
          "stroke",
          "box-shadow",
          "filter",
          "backdrop-filter",
          // No border-radius: a corner animating from 9999px glitches instead
          // of morphing (owner, 2026-09-28). Shapes stay put on hover/press.
        ].join(", "),
        /* legacy alias for the same list */
        mint: [
          "transform", "scale", "translate", "rotate", "opacity", "color", "background-color", "border-color",
          "text-decoration-color", "fill", "stroke", "box-shadow", "filter", "backdrop-filter",
        ].join(", "),
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    /**
     * Skips layout and paint for grid/list items scrolled out of view. A 200
     * card grid otherwise lays out and paints all 200 before the first frame.
     * `contain-intrinsic-size` is what stops it costing a scrollbar jump - it
     * is the placeholder height an unrendered item claims, so the page keeps a
     * stable scroll length instead of growing as you scroll into it.
     */
    ({ addUtilities }: { addUtilities: (u: Record<string, unknown>) => void }) => {
      addUtilities({
        ".cv-auto": { "content-visibility": "auto" },
        ".cv-card": { "content-visibility": "auto", "contain-intrinsic-size": "auto 320px" },
        ".cv-row": { "content-visibility": "auto", "contain-intrinsic-size": "auto 64px" },
        /**
         * A control's transitions, with the M3 Expressive press: colour, fill
         * and shadow on the standard short curve; `scale` (the press dip,
         * globals.css `:active`) on the fast spatial spring, so it springs
         * back with a hair of overshoot instead of easing back.
         */
        ".transition-press": {
          transition: [
            "scale var(--md-sys-motion-spring-fast-spatial-duration) var(--md-sys-motion-spring-fast-spatial)",
            ...["transform", "color", "background-color", "border-color", "box-shadow", "opacity", "filter"]
              .map(p => `${p} var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard)`),
          ].join(", "),
        },
        /** Every number in the product: prices, runs, balances, ids (§2.2). */
        ".tnum": { "font-variant-numeric": "tabular-nums", "font-feature-settings": '"tnum", "kern"' },
      });
    },
    /**
     * `touch:` - a finger, not a mouse. Controls grow to the 48dp M3 floor and
     * inputs to 16px text (below that, iOS zooms the page on focus). Keyed on
     * the pointer, not the width: a small desktop window keeps dense controls.
     */
    ({ addVariant }: { addVariant: (name: string, def: string) => void }) => {
      addVariant("touch", "@media (pointer: coarse)");
    },
  ],
} satisfies Partial<Config>;

export default config;

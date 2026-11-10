/**
 * The M3 state layer and focus ring — the one implementation for the system.
 *
 * M3 has no hover colours. It has one mechanism: the component's own content
 * colour laid over it at a fixed opacity (8% hover, 10% focus, 10% pressed,
 * 16% dragged). The CSS is in `src/ui/ui.css`; this file is only the names, so
 * a component never types a class string by hand and a grep finds every user.
 *
 * ⚠️ Nothing outside `src/ui` may write a hover colour. If a surface needs a
 * hover it does not have, give it `interactive()` — do not invent a `hover:bg-…`.
 */

/** Container + state layer + focus ring. What every clickable thing gets. */
export const interactive = (opts?: { inverse?: boolean }) =>
    `m3-state ${opts?.inverse ? "m3-focus-inverse" : "m3-focus"} outline-none`;

/** The state layer alone — for a row that draws its own focus treatment. */
export const stateLayer = "m3-state";

/** The focus ring alone — for something that must not tint on hover. */
export const focusRing = "m3-focus";

/** M3 disabled: content at 38%, no pointer events. */
export const disabledStyles = "disabled:opacity-[0.38] disabled:pointer-events-none aria-disabled:opacity-[0.38] aria-disabled:pointer-events-none";

/**
 * The M3 48dp touch target, kept off the visual box.
 *
 * A 40dp icon button still has to be 48dp to the finger. Padding would grow
 * the button and break the layout, so the hit area is a transparent
 * pseudo-element centred on it instead.
 */
export const touchTarget = "relative before:absolute before:left-1/2 before:top-1/2 before:h-touch before:w-touch before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

/**
 * Lift — the hover an ELEVATED thing gets: it rises 2px, gains one shadow
 * step, and its container steps to `surface-container-high` under the M3
 * state layer. A static grid of cards becomes one that answers the pointer
 * (owner, 2026-09-26: "when you hover, the colour changes and you feel it is
 * alive").
 *
 * 2026-09-28: the corner no longer morphs and the card no longer flashes
 * `primary-container`. A radius animating out of 9999px/12px glitches, and a
 * grid of cards turning purple one by one under the cursor fought every
 * other colour on the page (owner: "effects ... all need to be in harmony").
 * The step is a neutral surface one; the accent stays with the actions.
 *
 * Only transform, shadow and background move - no reflow - and it all stops
 * under `prefers-reduced-motion`. Use on a card or a tile that opens
 * something. A row inside a list uses `interactive()` alone.
 * Children can answer too: it is `group/card`, so an icon plate inside can
 * `group-hover/card:bg-primary-container`.
 */
export const lift =
    "group/card m3-state m3-focus outline-none cursor-pointer " +
    /* `transform`, not `translate`: Tailwind 3.3's `-translate-y-*` writes
       `transform`, so the old list never animated the rise - it snapped
       (found 2026-09-29). The rise rides M3's default spatial spring. */
    "transition-[box-shadow,transform,background-color] duration-spring-spatial ease-spring-spatial " +
    "hover:-translate-y-0.5 hover:bg-surface-container-high hover:shadow-level-2 " +
    "focus-within:bg-surface-container-high focus-within:shadow-level-2 " +
    "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/**
 * Reveal — the hover a picture gets: the image scales inside its own frame
 * while the frame stays put. Put this on the WRAPPER around the <img>, not on
 * the card: transforming the card moves its badges and labels with it.
 *
 * The parent needs `group` and `overflow-hidden`.
 */
export const reveal =
    "transition-transform duration-medium1 ease-emphasized-decelerate " +
    "group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none";

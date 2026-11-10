import type { CSSProperties } from "react";

/**
 * Transparent pictures sit on a checkerboard, so a baked-in background shows
 * as a block. Every picture grid uses this one. A plain module (no "use
 * client"), so server pages get the value, not a client reference.
 */
export const CHECKER_STYLE: CSSProperties = {
    background: "repeating-conic-gradient(rgb(var(--md-sys-color-surface-container-rgb)) 0 25%, rgb(var(--md-sys-color-surface-container-lowest-rgb)) 0 50%) 50% / 16px 16px",
};

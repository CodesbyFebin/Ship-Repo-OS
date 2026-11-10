/**
 * The HTML popover API (Baseline 2024: Chrome 114, Safari 17, Firefox 125).
 * TypeScript 5.1 predates it, so the few members @/ui uses are declared here.
 * Delete this file when the repo moves to TypeScript 5.3+.
 */
import "react";

declare global {
    interface HTMLElement {
        showPopover(): void;
        hidePopover(): void;
        togglePopover(force?: boolean): boolean;
        popover: string | null;
    }
    interface ToggleEvent extends Event {
        readonly newState: "open" | "closed";
        readonly oldState: "open" | "closed";
    }
}

declare module "react" {
    interface HTMLAttributes<T> {
        popover?: "auto" | "manual" | "";
    }
}

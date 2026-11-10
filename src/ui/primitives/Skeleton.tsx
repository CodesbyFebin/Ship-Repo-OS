import type { ReactNode } from "react";
import { cn } from "../cn";

export type SkeletonProps = {
    /** Match the shape of the real content: a row of text, a tile, an avatar. */
    shape?: "text" | "block" | "circle";
    className?: string;
};

/**
 * A placeholder with the shape of what is coming, so nothing jumps when the
 * real content lands (§6.3, CLS < 0.05).
 *
 * Not for anything under ~300ms — a flash reads as a glitch. It is the one
 * placeholder (`.m3-wash`, ui.css), the same as a picture's: a flat tint
 * of the theme's text colour with a soft light passing over it.
 */
export function Skeleton({ shape = "block", className }: SkeletonProps) {
    return (
        <span
            aria-hidden
            className={cn(
                "m3-wash block",
                shape === "text" && "h-4 rounded-extra-small",
                shape === "block" && "rounded-medium",
                shape === "circle" && "rounded-full",
                className,
            )}
        />
    );
}

export type KbdProps = { children: ReactNode; className?: string };

/** A key on the keyboard: ⌘K, esc, ↵. Always the real key, never a picture of one. */
export function Kbd({ children, className }: KbdProps) {
    return (
        <kbd
            className={cn(
                "inline-flex h-5 min-w-[20px] items-center justify-center rounded-extra-small",
                "bg-surface-container-highest px-1.5 text-label-sm text-on-surface-variant",
                className,
            )}
        >
            {children}
        </kbd>
    );
}

/** Text for screen readers only. Visible on focus when it wraps a focusable. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
    return <span className="sr-only">{children}</span>;
}

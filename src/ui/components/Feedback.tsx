import type { ReactNode } from "react";
import type { IconGlyph } from "../primitives/Icon";
import { AlertTriangle, Info, XCircle, CheckCircle2 } from "../symbols";
import { cn } from "../cn";
import { Icon } from "../primitives/Icon";
import { highlight, type CodeLang } from "../highlight";

const ALERT_TONE = {
    /* Every container with its own `on-` pair (M3): `on-surface` text on a
       dark `error-container` was a colour picked by eye, and its hint text
       fell under 4.5:1. Title and body inherit the pair. */
    info: { icon: Info, wrap: "bg-secondary-container text-on-secondary-container", mark: "text-on-secondary-container" },
    success: { icon: CheckCircle2, wrap: "bg-primary-container text-on-primary-container", mark: "text-on-primary-container" },
    warning: { icon: AlertTriangle, wrap: "bg-tertiary-container text-on-tertiary-container", mark: "text-on-tertiary-container" },
    danger: { icon: XCircle, wrap: "bg-error-container text-on-error-container", mark: "text-on-error-container" },
} as const;

export type AlertProps = {
    tone?: keyof typeof ALERT_TONE;
    title?: ReactNode;
    /** What happened and what to do next. Never an apology. */
    children: ReactNode;
    action?: ReactNode;
    className?: string;
};

/**
 * A message that stays on the page, tied to what it is about. Use a Toast for
 * something that just happened, and an Alert for a condition that persists:
 * an expired key, a missing wallet, a paused agent.
 */
export function Alert({ tone = "info", title, children, action, className }: AlertProps) {
    const t = ALERT_TONE[tone];
    return (
        <div role={tone === "danger" ? "alert" : "status"} className={cn("flex min-w-0 gap-3 rounded-medium p-3.5", t.wrap, className)}>
            <Icon icon={t.icon} size="md" className={cn("mt-px shrink-0", t.mark)} />
            {/* The action goes UNDER the words on a phone. Beside them it took
                the width and squeezed the message into one word per line. */}
            <div className="flex min-w-0 flex-1 flex-col gap-2 medium:flex-row medium:items-start medium:gap-3">
                <div className="min-w-0 flex-1">
                    {title ? <p className="text-label-lg">{title}</p> : null}
                    <div className={cn("text-body-sm", title && "mt-0.5 opacity-[0.86]")}>{children}</div>
                </div>
                {action ? <div className="-ml-3 shrink-0 medium:ml-0">{action}</div> : null}
            </div>
        </div>
    );
}

export type EmptyStateProps = {
    icon?: IconGlyph;
    /**
     * Generated art, passed in by the caller — never imported here. `src/ui`
     * must not depend on `src/components/marketing`, so the caller supplies
     * `<ArtMark id="empty-collections" />` and this stays a pure slot.
     *
     * When `art` is given the icon box is replaced, not joined: a picture and
     * a glyph competing in the same empty state is noise.
     */
    art?: ReactNode;
    title: ReactNode;
    /** Say what goes here and how to make the first one. */
    description?: ReactNode;
    action?: ReactNode;
    /** `inline` sits inside a card or a table; `page` owns the screen. */
    size?: "inline" | "page";
    className?: string;
};

/**
 * Nothing here yet - and what to do about it.
 *
 * An empty state without a next step is a dead end, so `action` is what makes
 * this component worth having. Never use it for an error: that is an Alert.
 */
export function EmptyState({ icon, art, title, description, action, size = "inline", className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-3 rounded-medium bg-surface-container-low text-center",
                size === "page" ? "px-6 py-14" : "px-4 py-9",
                className,
            )}
        >
            {art
                ? art
                : icon
                  ? (
                        // check-design-allow: a decorative plate, not a control
                        <span className="flex h-11 w-11 items-center justify-center rounded-medium bg-surface-container text-on-surface-variant">
                            <Icon icon={icon} size="lg" />
                        </span>
                    )
                  : null}
            <div className="space-y-1">
                <p className={cn(size === "page" ? "text-title-lg" : "text-label-lg", "text-on-surface")}>{title}</p>
                {description ? <p className="mx-auto max-w-narrow text-body-sm text-on-surface-variant">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}

export type MetricProps = {
    label: ReactNode;
    /** The number itself. Always tabular, so a row of them lines up. */
    value: ReactNode;
    /** Change since the period before: "+18%", "+$3.10". */
    delta?: ReactNode;
    /** Up is not always good - a rising failure count is `bad`. */
    deltaTone?: "good" | "bad" | "flat";
    hint?: ReactNode;
    className?: string;
};

/** One number that matters, with the context to read it. */
export function Metric({ label, value, delta, deltaTone = "good", hint, className }: MetricProps) {
    return (
        <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-medium bg-surface-container p-4", className)}>
            <span className="text-label-md text-on-surface-variant">{label}</span>
            <span className="text-headline-lg tnum text-on-surface">{value}</span>
            <span className="flex items-center gap-2">
                {delta ? (
                    <span className={cn("text-label-md tnum", deltaTone === "good" ? "text-primary" : deltaTone === "bad" ? "text-error" : "text-on-surface-variant")}>
                        {delta}
                    </span>
                ) : null}
                {hint ? <span className="text-label-md text-on-surface-variant">{hint}</span> : null}
            </span>
        </div>
    );
}

export type CodeBlockProps = {
    children: string;
    /** Shown above the code: a filename, a shell name, an endpoint. */
    title?: ReactNode;
    action?: ReactNode;
    /** Wrap long lines instead of scrolling sideways - for a command in a narrow card. */
    wrap?: boolean;
    /** Colours, like an editor. Guessed from the code when left out; "text" for none (a key, an id). */
    lang?: CodeLang;
    className?: string;
};

/** Commands and payloads, in the mono face and in colour, never wrapped mid-token. */
export function CodeBlock({ children, title, action, wrap, lang, className }: CodeBlockProps) {
    return (
        <div className={cn("min-w-0 overflow-hidden rounded-medium bg-surface-container", className)}>
            {title || action ? (
                <div className="flex items-center gap-2 bg-surface-container-high px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-label-md text-on-surface-variant">{title}</span>
                    {action}
                </div>
            ) : null}
            <pre className={cn("p-4 text-body-sm font-mono text-on-surface", wrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "overflow-x-auto")}>
                <code className="font-mono">{highlight(children, lang)}</code>
            </pre>
        </div>
    );
}

export type ErrorStateProps = {
    /** What went wrong, in the user's words — never a stack trace. */
    title: ReactNode;
    /** What to do next. An error with no next step is a dead end. */
    description?: ReactNode;
    action?: ReactNode;
    size?: "inline" | "page";
    className?: string;
};

/**
 * Something failed. Distinct from `EmptyState` (nothing here yet) and from
 * `Alert` (a condition that persists next to other content): this one owns the
 * space where the content should have been.
 */
export function ErrorState({ title, description, action, size = "inline", className }: ErrorStateProps) {
    return (
        <div
            role="alert"
            className={cn(
                /* A calm surface with the error in the icon plate and the words -
                   a whole block of dark-theme `error-container` read as an alarm
                   louder than the thing that went wrong (2026-09-28). */
                "flex min-w-0 flex-col items-center justify-center gap-3 rounded-medium bg-surface-container-low text-center",
                size === "page" ? "px-6 py-14" : "px-4 py-9",
                className,
            )}
        >
            {/* check-design-allow: a decorative plate, not a control */}
            <span className="flex h-11 w-11 items-center justify-center rounded-medium bg-error-container text-on-error-container">
                <Icon icon={AlertTriangle} size="lg" />
            </span>
            <div className="space-y-1">
                <p className={cn(size === "page" ? "text-title-lg" : "text-label-lg", "text-on-surface")}>{title}</p>
                {description ? <p className="mx-auto max-w-narrow text-body-sm text-on-surface-variant">{description}</p> : null}
            </div>
            {action}
        </div>
    );
}

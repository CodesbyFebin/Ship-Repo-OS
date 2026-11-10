import type { ReactNode } from "react";
import { cn } from "../cn";

/**
 * The shapes a form-like page is built from — Settings, My stuff → Profile,
 * Wallet & NFTs. One set, so every such page reads the same:
 *
 *   SettingsGroup   a titled `surface-container` block (law 11: fill, no lines)
 *   SettingRow      label left, value + optional action right
 *   ActionRow       a title and a line of help, one action on the right
 *   InfoRow         words on their own, inside a group
 */

/**
 * A titled block of rows. The fill separates it from the pane; the rows
 * inside are separated by space, never a rule.
 */
export function SettingsGroup({
    title,
    description,
    danger,
    className,
    children,
}: {
    title?: string;
    description?: ReactNode;
    /** Destructive actions. The title takes the `error` role. */
    danger?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={cn("flex min-w-0 flex-col gap-2", className)}>
            {title && (
                <div className="px-1">
                    <h2 className={cn("text-title-sm", danger ? "text-error" : "text-on-surface")}>{title}</h2>
                    {description && <p className="mt-0.5 text-body-sm text-on-surface-variant">{description}</p>}
                </div>
            )}
            <div className="flex min-w-0 flex-col overflow-hidden rounded-medium bg-surface-container py-1">{children}</div>
        </section>
    );
}

export function SettingRow({
    label,
    value,
    mono = false,
    action,
}: {
    label: string;
    value: ReactNode;
    mono?: boolean;
    action?: ReactNode;
}) {
    return (
        <div className="flex min-h-touch min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
            <span className="shrink-0 text-body-md text-on-surface-variant">{label}</span>
            <div className="flex min-w-0 items-center gap-2">
                <span className={cn("min-w-0 truncate text-body-md text-on-surface", mono && "font-mono")}>{value}</span>
                {action}
            </div>
        </div>
    );
}

/** A title, a line of help and one action. On a phone the action drops under the words. */
export function ActionRow({
    title,
    description,
    action,
    leading,
}: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    leading?: ReactNode;
}) {
    return (
        <div className="flex min-h-touch min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            {leading && <span className="shrink-0">{leading}</span>}
            <div className="min-w-0 flex-1 basis-56">
                <p className="text-body-lg text-on-surface">{title}</p>
                {description && <p className="mt-0.5 text-body-sm text-on-surface-variant">{description}</p>}
            </div>
            {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
    );
}

/** Words, on their own, inside a group. */
export function InfoRow({ children }: { children: ReactNode }) {
    return <div className="px-4 py-3 text-body-md text-on-surface-variant">{children}</div>;
}

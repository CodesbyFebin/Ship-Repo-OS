import type { ReactNode } from "react";
import { cn } from "../cn";

const SIZE = { sm: "h-8 w-8 text-label-md", md: "h-10 w-10 text-label-lg", lg: "h-14 w-14 text-title-md", xl: "h-20 w-20 text-headline-sm" } as const;
export type AvatarSize = keyof typeof SIZE;

/** "Ada Lovelace" → "AL", "ada@x.com" → "AD". Never empty. */
export function initials(name?: string | null): string {
    const s = (name ?? "").split("@")[0].trim();
    const words = s.split(/[\s._-]+/).filter(Boolean);
    const two = words.length > 1 ? words[0][0] + words[1][0] : s.slice(0, 2);
    return (two || "?").toUpperCase();
}

export type AvatarProps = {
    /** A name or an email: gives the initials and the accessible label. */
    name?: string | null;
    src?: string | null;
    size?: AvatarSize;
    /** A small dot on the corner: online, busy. */
    status?: "online" | "away" | "busy";
    className?: string;
};

const DOT = { online: "bg-primary", away: "bg-tertiary", busy: "bg-error" } as const;

/**
 * A person or a team: a picture when there is one, two letters when there isn't.
 * Square like everything else in Ink. The letters sit on ink, never on a
 * random colour, so a list of people stays one colour and the art stays the art.
 */
export function Avatar({ name, src, size = "md", status, className }: AvatarProps) {
    return (
        <span role="img" aria-label={name ?? "User"} className={cn("relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-small bg-inverse-surface font-medium text-inverse-on-surface", SIZE[size], className)}>
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- any host, any format
                <img src={src} alt="" className="h-full w-full object-cover" />
            ) : (
                <span aria-hidden>{initials(name)}</span>
            )}
            {status ? <span aria-hidden className={cn("absolute bottom-0 right-0 h-2.5 w-2.5 ring-2 ring-surface", DOT[status])} /> : null}
        </span>
    );
}

export type AvatarGroupProps = {
    people: { name?: string | null; src?: string | null }[];
    /** How many to draw before "+3". */
    max?: number;
    size?: AvatarSize;
    className?: string;
};

/** A row of faces that overlap: the members of a team, who's on a document. */
export function AvatarGroup({ people, max = 4, size = "sm", className }: AvatarGroupProps) {
    const shown = people.slice(0, max);
    const more = people.length - shown.length;
    return (
        <span className={cn("inline-flex items-center", className)} aria-label={`${people.length} people`}>
            {shown.map((p, i) => (
                <Avatar key={i} name={p.name} src={p.src} size={size} className={cn("ring-2 ring-surface", i > 0 && "-ml-2")} />
            ))}
            {more > 0 ? (
                <span className={cn("-ml-2 inline-flex items-center justify-center rounded-small bg-surface-container-highest text-on-surface ring-2 ring-surface", SIZE[size])}>+{more}</span>
            ) : null}
        </span>
    );
}

/** Avatar + name + one line, the way a person appears in a row or a menu. */
export function Person({ name, email, src, size = "md", trailing }: { name?: string | null; email?: string | null; src?: string | null; size?: AvatarSize; trailing?: ReactNode }) {
    return (
        <span className="flex min-w-0 items-center gap-3">
            <Avatar name={name || email} src={src} size={size} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-body-md text-on-surface">{name || email}</span>
                {name && email ? <span className="block truncate text-label-md text-on-surface-variant">{email}</span> : null}
            </span>
            {trailing}
        </span>
    );
}

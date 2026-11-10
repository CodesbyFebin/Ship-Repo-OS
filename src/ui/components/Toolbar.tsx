"use client";

import type { IconGlyph } from "../primitives/Icon";
import { MoreVertical } from "../symbols";
import { cn } from "../cn";
import { Button, IconButton, type ButtonSize } from "../primitives/Button";
import { Menu, MenuItem } from "./Menu";
import { Tooltip } from "./Tooltip";
import { useWindowClass } from "./position";

/**
 * Top actions that fold on a phone
 *
 * The collection page used to show three big filled buttons in a row on a
 * phone and they overflowed. M3's rule is one filled button per screen, and
 * a page should not have to work out its own breakpoint to honour it — so
 * this decides what fits, from a `priority` each item declares:
 *
 *   primary    the one filled button. Only the first is ever rendered filled.
 *   secondary  the next most useful action — tonal on a wide screen.
 *   overflow   everything else — an icon button with a tooltip when there's
 *              room, folded into the phone's ⋮ menu when there isn't.
 *   menu       always behind ⋮, on every screen. For a page whose bar has
 *              no room for a row of icons (the collection studio's one bar).
 *
 * Phone: primary only - as a filled ICON (owner, 2026-09-26: the studio bar
 * is icons only, the room goes to the grid) - everything else behind ⋮. Tablet: primary filled,
 * secondary tonal, the rest behind ⋮. Laptop and up: primary filled,
 * secondary tonal, the rest as icon buttons — nothing hidden.
 */
export type ToolbarAction = {
    key: string;
    label: string;
    icon: IconGlyph;
    onClick: () => void;
    priority: "primary" | "secondary" | "overflow" | "menu";
    disabled?: boolean;
};

export type ToolbarProps = {
    /** Names the menu for screen readers when it folds on a phone, e.g. "Collection actions". */
    label: string;
    actions: ToolbarAction[];
    /** The labelled buttons' height. `xs` for a bar that should not shout. */
    size?: ButtonSize;
    className?: string;
};

export function Toolbar({ label, actions, size, className }: ToolbarProps) {
    const w = useWindowClass();
    const compact = w === "compact";
    /* A tablet (600-839) fits the filled and the tonal buttons, not a row of
       icon buttons as well - that is where the row overflowed. */
    const folds = compact || w === "medium";

    const primary = actions.find(a => a.priority === "primary");
    const rest = actions.filter(a => a !== primary);
    const secondary = compact ? [] : rest.filter(a => a.priority === "secondary");
    const inMenu = rest.filter(a => a.priority === "menu" || (folds && !secondary.includes(a)));
    const asIcons = folds ? [] : rest.filter(a => a.priority === "overflow");

    return (
        <div className={cn("flex min-w-0 items-center gap-2", className)}>
            {primary && (compact ? (
                <Tooltip content={primary.label}>
                    <IconButton icon={primary.icon} label={primary.label} variant="filled" onClick={primary.onClick} disabled={primary.disabled} />
                </Tooltip>
            ) : (
                <Button icon={primary.icon} size={size} onClick={primary.onClick} disabled={primary.disabled}>
                    {primary.label}
                </Button>
            ))}
            {secondary.map(a => (
                <Button key={a.key} icon={a.icon} size={size} variant="tonal" onClick={a.onClick} disabled={a.disabled} className="shrink-0">
                    {a.label}
                </Button>
            ))}
            {asIcons.map(a => (
                <Tooltip key={a.key} content={a.label}>
                    <IconButton icon={a.icon} label={a.label} onClick={a.onClick} disabled={a.disabled} />
                </Tooltip>
            ))}
            {inMenu.length > 0 && (
                <Menu label={label} placement="bottom-end" trigger={p => <IconButton {...p} icon={MoreVertical} label={label} />}>
                    {inMenu.map(a => (
                        <MenuItem key={a.key} icon={a.icon} onSelect={a.onClick} disabled={a.disabled}>
                            {a.label}
                        </MenuItem>
                    ))}
                </Menu>
            )}
        </div>
    );
}

import type { ReactNode } from "react";
import { cn } from "../cn";

export type Column<Row> = {
    key: string;
    header: ReactNode;
    /** Cell content for one row. */
    cell: (row: Row) => ReactNode;
    /** Numbers right-align and use tabular digits so columns line up. */
    numeric?: boolean;
    /** Hidden below `sm`: keep the phone view to what matters. */
    hideOnPhone?: boolean;
    width?: string;
};

export type TableProps<Row> = {
    /** Names the table for screen readers, e.g. "Runs this week". */
    label: string;
    columns: Column<Row>[];
    rows: Row[];
    rowKey: (row: Row) => string;
    onRowClick?: (row: Row) => void;
    /** Shown instead of the table when there are no rows. */
    empty?: ReactNode;
    className?: string;
};

/**
 * Rows of data. Still a real `<table>`, so screen readers announce the column
 * with each cell and the browser can sort, select and copy naturally.
 *
 * On a phone it scrolls sideways inside its own box - the page itself must
 * never scroll sideways - and columns marked `hideOnPhone` drop out first.
 */
export function Table<Row>({ label, columns, rows, rowKey, onRowClick, empty, className }: TableProps<Row>) {
    if (!rows.length && empty) return <>{empty}</>;

    return (
        <div className={cn("min-w-0 overflow-x-auto rounded-medium bg-surface-container", className)}>
            <table className="w-full border-collapse text-body-sm">
                <caption className="sr-only">{label}</caption>
                <thead>
                    <tr>
                        {columns.map(c => (
                            <th
                                key={c.key}
                                scope="col"
                                style={c.width ? { width: c.width } : undefined}
                                className={cn(
                                    "whitespace-nowrap bg-surface-container-high px-3 py-2.5 text-label-md text-on-surface-variant",
                                    c.numeric ? "text-right" : "text-left",
                                    c.hideOnPhone && "hidden sm:table-cell",
                                )}
                            >
                                {c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr
                            key={rowKey(row)}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                            className={cn(
                                "",
                                onRowClick && "cursor-pointer transition-colors duration-short2 ease-standard hover:bg-on-surface/[0.08]",
                            )}
                        >
                            {columns.map(c => (
                                <td
                                    key={c.key}
                                    className={cn(
                                        "px-3 py-3.5 text-on-surface",
                                        c.numeric ? "text-right tnum" : "text-left",
                                        c.hideOnPhone && "hidden sm:table-cell",
                                    )}
                                >
                                    {c.cell(row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export type ListProps = { className?: string; children: ReactNode };

/** A stack of rows that are objects, not data points: agents, runs, keys. */
export function List({ className, children }: ListProps) {
    return <ul className={cn("min-w-0 overflow-hidden rounded-medium bg-surface-container", className)}>{children}</ul>;
}

export type ListItemProps = {
    /** Avatar, icon or thumbnail. */
    leading?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    /** Status, price or a button. */
    trailing?: ReactNode;
    onClick?: () => void;
    href?: string;
    className?: string;
};

export function ListItem({ leading, title, description, trailing, onClick, href, className }: ListItemProps) {
    const inner = (
        <>
            {leading ? <span className="shrink-0">{leading}</span> : null}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-body-md text-on-surface">{title}</span>
                {description ? <span className="block truncate text-label-md text-on-surface-variant">{description}</span> : null}
            </span>
            {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
        </>
    );

    const shared = cn(
        "flex w-full min-h-14 items-center gap-3 px-3 py-2.5 text-left",
        (onClick || href) &&
            "transition-colors duration-short2 ease-standard hover:bg-on-surface/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        className,
    );

    return (
        <li className="min-w-0">
            {href ? (
                <a href={href} className={shared}>
                    {inner}
                </a>
            ) : onClick ? (
                <button type="button" onClick={onClick} className={shared}>
                    {inner}
                </button>
            ) : (
                <div className={shared}>{inner}</div>
            )}
        </li>
    );
}

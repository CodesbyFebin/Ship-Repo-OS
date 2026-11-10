/**
 * @/ui — the Ink design system (from AMNT), Material 3.
 *
 * Pages import from here and nowhere else for UI. If something is missing,
 * add it to the system and to `/design-system` first; never to the page.
 * See README.md and AGENTS.md.
 */

export { cn } from "./cn";
export * as tokens from "./tokens/tokens";
export { SITE_SEEDS, SITE_SEED_DEFAULT } from "./tokens/site-seeds";
export { interactive, stateLayer, focusRing, disabledStyles, touchTarget, lift, reveal } from "./state-layer";

/* primitives */
export { Icon, type IconProps, type IconSize, type IconGlyph, type Glyph } from "./primitives/Icon";
export { SYMBOL_VIEWBOX } from "./primitives/symbols.generated";
export { Spinner, Progress, type SpinnerProps, type ProgressProps } from "./primitives/Progress";
export {
    Button, ButtonLink, IconButton, Fab, buttonStyles,
    type ButtonProps, type ButtonLinkProps, type IconButtonProps, type FabProps,
    type ButtonVariant, type ButtonSize,
} from "./primitives/Button";
export { Badge, CountBadge, Status, Divider, type BadgeProps, type BadgeTone, type CountBadgeProps, type StatusProps, type DividerProps } from "./primitives/Badge";
export { Chip, ChipLink, ChipGroup, type ChipProps, type ChipLinkProps, type ChipKind, type ChipGroupProps } from "./primitives/Chip";
export { Skeleton, Kbd, VisuallyHidden, type SkeletonProps, type KbdProps } from "./primitives/Skeleton";

/* forms */
export { FormField, SupportingText, useFieldState, type FormFieldProps } from "./components/Field";
export {
    TextField, Textarea, Select, Search, ColorField, fieldStyles,
    type TextFieldProps, type TextFieldVariant, type TextareaProps, type SelectProps, type SearchProps,
    type ColorFieldProps,
} from "./components/Input";
export {
    Checkbox, Radio, RadioGroup, Switch, Slider, SegmentedButton,
    type CheckboxProps, type RadioProps, type RadioGroupProps, type SwitchProps,
    type SliderProps, type SegmentedButtonProps, type SegmentedOption,
} from "./components/Choice";

/* structure */
export { Card, Panel, Section, PageHeader, Breadcrumb, type CardProps, type PanelProps, type SectionProps, type PageHeaderProps, type BreadcrumbProps } from "./components/Card";
export { Tabs, TabPanel, type TabsProps, type TabItem, type TabPanelProps } from "./components/Tabs";
export { highlight, guessLang, type CodeLang } from "./highlight";
export { Alert, EmptyState, ErrorState, Metric, CodeBlock, type AlertProps, type EmptyStateProps, type ErrorStateProps, type MetricProps, type CodeBlockProps } from "./components/Feedback";
export { Table, List, ListItem, type TableProps, type Column, type ListProps, type ListItemProps } from "./components/Table";
export { SettingsGroup, SettingRow, ActionRow, InfoRow } from "./components/SettingsRows";

/* overlays */
export { Popover, type PopoverProps, type PopoverTriggerProps } from "./components/Popover";
export { Menu, MenuItem, MenuSub, MenuSeparator, MenuLabel, MenuActions, type MenuProps, type MenuItemProps, type MenuAction } from "./components/Menu";
export { Tooltip, type TooltipProps } from "./components/Tooltip";
export { Sheet, useConfirm, type SheetProps, type ConfirmOptions } from "./components/Sheet";
export { Window, type WindowProps } from "./components/Window";
export { usePersistedState, usePersistedText } from "./components/usePersistedState";
export { Toolbar, type ToolbarProps, type ToolbarAction } from "./components/Toolbar";
export { CHECKER_STYLE } from "./checker";
export { ColorPicker, ColorPopover, BASIC_COLOURS, gradientCss, type ColorPickerProps, type ColorPopoverProps, type Gradient } from "./components/ColorPicker";
export { ColorSwatches, PaletteGrid, type ColorSwatchesProps, type PaletteGridProps } from "./components/Swatches";
export { Snackbar, Toaster, toast, updateToast, dismissToast, type ToastInput, type ToastTone } from "./components/Toast";
export { download, startDownload, saveFile, fetchFile, DownloadLink, downloadHrefClick, Downloads, type DownloadJob } from "./components/Download";

/* navigation */
export { NavDrawerContext, TopAppBar, NavigationBar, NavigationRail, NavigationDrawer, NavRailItem, NavRailButton, type NavItem, type TopAppBarProps, type NavigationBarProps, type NavigationRailProps, type NavigationDrawerProps } from "./navigation/Navigation";
export { NavMenu, NavMenuGroups, type NavMenuLink, type NavMenuGroup } from "./navigation/NavMenu";
export { NavList, type NavListItem, type NavListGroup } from "./navigation/NavList";

/* layouts */
export {
    PublicLayout, AppLayout, WorkspaceLayout, SettingsLayout, DetailLayout, AuthLayout,
    ListDetail, SupportingPane,
    type ListDetailProps, type SupportingPaneProps,
} from "./layouts";

/* brand marks */
export { GoogleMark } from "./brand/GoogleMark";

/* helpers */
export { useMediaQuery, useWindowClass, place, useAnchoredPosition, type Placement, type WindowClass } from "./components/position";

/* ── Ship Kit v0.4 parts (2026-10-22) ─────────────────────────────────── */
export { Avatar, AvatarGroup, Person, initials, type AvatarProps, type AvatarGroupProps, type AvatarSize } from "./components/Avatar";
export { Calendar, DatePicker, DateRangePicker, RANGE_PRESETS, formatDay, toDay, today, type Day, type DayRange, type CalendarProps, type DatePickerProps, type DateRangePickerProps } from "./components/DatePicker";
export { LineChart, BarChart, DonutChart, Sparkline, ChartLegend, seriesColour, type Series, type LineChartProps, type BarChartProps, type DonutChartProps } from "./components/Charts";
export { FileUpload, sendFile, type FileUploadProps, type UploadItem } from "./components/FileUpload";
export { CommandMenu, useCommandHotkey, fuzzy, type CommandItem, type CommandMenuProps } from "./components/CommandMenu";
export { MultiSelect, Combobox, type Option, type MultiSelectProps, type ComboboxProps } from "./components/Combobox";
export { DataTable, Pagination, type DataColumn, type DataTableProps, type PaginationProps, type Sort } from "./components/DataTable";
export { IconGrid, IconPicker, allIcons, type IconGridProps } from "./components/IconPicker";
export { Accordion, Steps, CodeInput, Banner, NotificationBell, type AccordionItem, type CodeInputProps, type NotificationItem } from "./components/Extras";
export { SidebarShell, TopbarShell, type SidebarShellProps, type TopbarShellProps, type ShellLink, type ShellGroup } from "./layouts/Shells";
export { Tour, type TourStep } from "./components/Tour";

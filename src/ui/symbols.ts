/**
 * Material Symbols Rounded 400 — the one icon set (DESIGN-SYSTEM.md law 6).
 *
 *   import { Search, Close } from "./symbols";
 *   <Icon icon={Search} />
 *
 * Exports keep their lucide names on purpose: migrating a file is one import
 * line, not a rewrite of every call site in it. Each export is a plain object
 * of path data, so a route is only charged for the icons it draws — all 141
 * together would be 23 KB gz, and no route draws 141.
 *
 * Need one that is not here? Add the lucide name and the Material Symbols name
 * to `scripts/icon-map.json` and run `npm run icons:build`. Never hand-edit
 * the generated file, and never paste an SVG into a page.
 */
export * from "./primitives/symbols.generated";

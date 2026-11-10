import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { typescale, shape, elevation } from "./tokens/tokens";
import { text as legacyText } from "./tokens/legacy";

/**
 * Class merging that knows the M3 scales.
 *
 * Plain tailwind-merge treats any unknown `text-*` as a colour, so
 * `cn("text-title-md", "text-on-surface")` silently DROPPED the size and kept
 * only the colour. Registering the scale's role names as font sizes fixes that
 * for every component in @/ui — and the same trap applies to the spelled-out
 * shape steps (`rounded-medium`) and the elevation levels (`shadow-level-2`).
 *
 * The legacy step names are registered too, so a half-migrated file still
 * merges correctly. They go with `legacy.ts` in S11.
 */
const twMerge = extendTailwindMerge({
    classGroups: {
        "font-size": [{
            text: [
                ...Object.keys(typescale),
                ...Object.keys(legacyText),
                "d1", "d2", "d3", "d4", "legacy-lg", "body-xs", "body-2xs", "body-3xs",
            ],
        }],
        rounded: [{ rounded: Object.keys(shape) }],
        // The 48dp touch floor, so `min-h-0` on a Button can replace it.
        "min-h": [{ "min-h": ["touch"] }],
        shadow: [{
            shadow: [
                ...Object.keys(elevation).map(l => `level-${l}`),
                "elevation-1", "elevation-2", "elevation-3", "elevation-4", "highlight",
            ],
        }],
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

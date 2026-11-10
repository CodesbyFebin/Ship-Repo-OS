/**
 * Brand-colour starting points for a collection website
 *
 * A seed is ONE colour. Google's Material colour maths turns it into the whole
 * light + dark scheme, so a creator picks a mood and
 * every button, chip and surface follows. Hex lives here, in the design
 * system, and nowhere in the feature.
 */
import { scheme } from "./tokens";

export const SITE_SEED_DEFAULT: string = scheme.seed;

export const SITE_SEEDS: { name: string; seed: string }[] = [
    { name: "Lime", seed: SITE_SEED_DEFAULT },
    { name: "Violet", seed: "#7C4DFF" },
    { name: "Blue", seed: "#2F6BFF" },
    { name: "Teal", seed: "#00B8A9" },
    { name: "Pink", seed: "#FF3D9A" },
    { name: "Orange", seed: "#FF8A00" },
    { name: "Red", seed: "#F0443A" },
    { name: "Gold", seed: "#E8B100" },
    { name: "Slate", seed: "#5F7A8A" },
];

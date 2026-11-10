// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — The Preset Engine: Target Realities
// Word Budget Formula: duration_sec × wpm / 60 — enforced as a HARD cap.
// ─────────────────────────────────────────────────────────────────────────────

export interface Preset {
  id: string;
  label: string;
  emoji: string;
  audience: string;
  durationSec: number;
  wpm: number;
  wordBudget: number;
  rubricFocus: string[];
  /** Relative scene durations (must roughly sum to 1) */
  sceneWeights: { hook: number; chaos: number; reveal: number; proof: number; cta: number };
  accent: string; // tailwind-friendly hex for UI chips
}

const WPM = 145;

function budget(durationSec: number): number {
  return Math.round((durationSec * WPM) / 60);
}

export const PRESETS: Preset[] = [
  {
    id: "meta-hackathon",
    label: "Meta Hackathon",
    emoji: "🦑",
    audience: "Hackathon judges evaluating technical depth + Meta API usage",
    durationSec: 180,
    wpm: WPM,
    wordBudget: budget(180), // 435
    rubricFocus: ["Technical depth", "Meta API use", "Demo clarity"],
    sceneWeights: { hook: 0.1, chaos: 0.25, reveal: 0.25, proof: 0.25, cta: 0.15 },
    accent: "#10b981",
  },
  {
    id: "smart-india-hackathon",
    label: "Smart India Hackathon",
    emoji: "🇮🇳",
    audience: "SIH panel checking Problem Statement ID and theme fit",
    durationSec: 300,
    wpm: WPM,
    wordBudget: budget(300), // 725
    rubricFocus: ["Problem Statement ID", "Theme-fit", "Impact"],
    sceneWeights: { hook: 0.1, chaos: 0.3, reveal: 0.25, proof: 0.2, cta: 0.15 },
    accent: "#f59e0b",
  },
  {
    id: "y-combinator",
    label: "Y Combinator / Startup Pitch",
    emoji: "🚀",
    audience: "Investors filtering for traction and business model",
    durationSec: 120,
    wpm: WPM,
    wordBudget: budget(120), // 290
    rubricFocus: ["Traction (verified only)", "Market", "Business model"],
    sceneWeights: { hook: 0.15, chaos: 0.2, reveal: 0.25, proof: 0.25, cta: 0.15 },
    accent: "#f97316",
  },
  {
    id: "academic-defense",
    label: "Academic Defense",
    emoji: "🎓",
    audience: "Professors grading methodology and viva readiness",
    durationSec: 600,
    wpm: WPM,
    wordBudget: budget(600), // 1450
    rubricFocus: ["Methodology", "Results", "Viva readiness"],
    sceneWeights: { hook: 0.05, chaos: 0.25, reveal: 0.3, proof: 0.3, cta: 0.1 },
    accent: "#a78bfa",
  },
  {
    id: "open-source-launch",
    label: "Open-Source Launch",
    emoji: "🌐",
    audience: "The community: stars, contributors, adoption",
    durationSec: 240,
    wpm: WPM,
    wordBudget: budget(240), // 580
    rubricFocus: ["Stars", "Contributing", "Community"],
    sceneWeights: { hook: 0.1, chaos: 0.2, reveal: 0.3, proof: 0.2, cta: 0.2 },
    accent: "#22d3ee",
  },
  {
    id: "devpost-general",
    label: "Devpost General",
    emoji: "📦",
    audience: "Devpost reviewers expecting URL + team + demo",
    durationSec: 180,
    wpm: WPM,
    wordBudget: budget(180), // 435
    rubricFocus: ["Devpost URL", "Team members", "Demo clarity"],
    sceneWeights: { hook: 0.1, chaos: 0.25, reveal: 0.25, proof: 0.25, cta: 0.15 },
    accent: "#34d399",
  },
  {
    id: "college-submit",
    label: "College Submission",
    emoji: "📘",
    audience: "Faculty review: report + abstract + viva prep",
    durationSec: 600,
    wpm: WPM,
    wordBudget: budget(600),
    rubricFocus: ["20-page report", "150-word abstract", "Viva prep"],
    sceneWeights: { hook: 0.05, chaos: 0.25, reveal: 0.3, proof: 0.3, cta: 0.1 },
    accent: "#e879f9",
  },
];

export const DEFAULT_PRESET = PRESETS[0].id;

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** The Master System Prompt law: word budget = duration_sec × wpm / 60, hard cap. */
export function sceneBudgets(preset: Preset): { phase: Preset["sceneWeights"] extends never ? never : string; seconds: number; words: number }[] {
  const phases: (keyof Preset["sceneWeights"])[] = ["hook", "chaos", "reveal", "proof", "cta"];
  return phases.map((phase) => {
    const seconds = Math.round(preset.durationSec * preset.sceneWeights[phase]);
    return {
      phase,
      seconds,
      words: Math.round((seconds * preset.wpm) / 60),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Demo Maker engine, shared half (client-safe: no SDK imports).
// ("the /brag answer, long-form").
// repo URL + optional audit → a cinematic demo VideoScript: 10 scenes / ~300s,
// 7 scenes / ~150s, or 4 scenes / ~60s. Deterministic template first, LLM
// voiceover enhancement second — the demo never breaks.
// Same VideoScene contract as the Story Engine, so the canvas player, the
// SchemaEditor, the WebM recorder and the Render Cloud all speak it.
// ─────────────────────────────────────────────────────────────────────────────
import type { RepoData } from "./types";
import type { AuditRepoMeta, RepoAudit } from "./audit-types";
import type { VideoScene, VideoScript } from "./story-engine";

// ── Public options ───────────────────────────────────────────────────────────

export type DemoStyle = "launch" | "hackathon" | "academic" | "product";

export const DEMO_STYLES: { id: DemoStyle; label: string; hint: string }[] = [
  { id: "launch", label: "Launch", hint: "open-source launch — community + stars" },
  { id: "hackathon", label: "Hackathon", hint: "judges-facing — stack + demo speed" },
  { id: "academic", label: "Academic", hint: "defense-facing — methodology + results" },
  { id: "product", label: "Product", hint: "customer-facing — benefits + quickstart" },
];

export type DemoTarget = 60 | 150 | 300;

export const DEMO_TARGETS: { seconds: DemoTarget; label: string; scenes: number }[] = [
  { seconds: 60, label: "60s · teaser", scenes: 4 },
  { seconds: 150, label: "150s · mid cut", scenes: 7 },
  { seconds: 300, label: "300s · full demo", scenes: 10 },
];

export type DemoVoice = "calm" | "energetic" | "authoritative";

// ── Scene sizing ─────────────────────────────────────────────────────────────

/** Voiceover pacing: ~2.6 words/second of speech, scenes sized to the target. */
function sceneDuration(target: DemoTarget, count: number, index: number): number {
  const base = target / count;
  // slight arc: hook and CTA run a touch shorter, deep-dives longer
  const shape = index === 0 || index === count - 1 ? 0.85 : 1.05;
  return Math.max(8, Math.round(base * shape));
}

function voCount(dur: number): number {
  return Math.max(3, Math.min(7, Math.round(dur / 5)));
}

// ── Fact helpers ─────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);
}

export function installCommand(repo: RepoData): string {
  const pm = repo.detected.packageManager ?? (repo.manifest ? "npm" : null);
  if (pm === "pnpm" || pm === "yarn" || pm === "bun" || pm === "npm") {
    const script = ["dev", "start", "serve"].find((name) => repo.detected.scripts?.[name] || repo.manifest?.scripts?.[name]);
    const install = `${pm} install`;
    return script ? `${install} && ${pm} run ${script}` : install;
  }
  if (repo.rootFiles.some((f) => /^cargo\.toml$/i.test(f))) return "cargo run";
  if (repo.rootFiles.some((f) => /^go\.mod$/i.test(f))) return "go run .";
  if (repo.rootFiles.some((f) => /^pyproject\.toml$/i.test(f))) return "pip install -e .";
  return "clone, configure, run — see the README";
}

function testCommand(repo: RepoData): string {
  const s = repo.detected.scripts ?? {};
  if (s.test) return `run tests → ${s.test}`;
  if (repo.hasTests) return "test suite detected — run the runner in CI";
  return "no test suite detected — the audit flags it";
}

export function modulesOf(repo: RepoData): string[] {
  const skip = new Set([".github", ".vscode", "node_modules", "dist", "build", ".git"]);
  const dirs = repo.rootFiles.filter((f) => !skip.has(f.toLowerCase()) && !f.includes("."));
  const files = repo.rootFiles.filter((f) => f.includes(".") && !f.startsWith("."));
  return [...dirs, ...files].slice(0, 8);
}

// ── Style voice ──────────────────────────────────────────────────────────────

const HOOK_LINE: Record<DemoStyle, string> = {
  launch: "This is the launch — and every launch deserves a film.",
  hackathon: "Judges scan code. Audiences watch films. This is both stories in one.",
  academic: "Before the defense, the method. Before the method, the story.",
  product: "Don't explain the product. Show it working in the first thirty seconds.",
};

const CTA_LINES: Record<DemoStyle, string[]> = {
  launch: ["Star the repo. Clone it. Break it. Tell us what you find.", `${"{name}"}: built in the open, filmed by ShipOS.`],
  hackathon: ["The demo is live. The code is real. The audit is public.", "Judge the build — the film was free."],
  academic: ["The methodology is documented. The results are reproducible.", "Questions welcome — the viva starts now."],
  product: ["Start in one command. Ship in one afternoon.", `${"{name}"}: try it before you read a single doc page.`],
};

// ── Scene templates ──────────────────────────────────────────────────────────

type SceneCtx = {
  name: string;
  repo: RepoData;
  audit: RepoAudit | null;
  meta: AuditRepoMeta | null;
  style: DemoStyle;
};

type SceneTemplate = {
  key: string;
  /** Act labels per position, overridden by style where it matters. */
  actLabel: string;
  needsAudit: boolean;
  build: (ctx: SceneCtx, dur: number) => { title: string; visual: VideoScene["visual"]; vo: string[]; onScreen: string[]; goal: string };
};

const TEMPLATES: SceneTemplate[] = [
  {
    key: "hook",
    actLabel: "Act I · The Hook",
    needsAudit: false,
    build: (c, dur) => ({
      title: `${c.name}`,
      visual: "intro",
      goal: "CINE.MAP: name-drop over neon grid — open on the repo, not a logo.",
      vo: [
        `${c.name}.`,
        c.repo.description ? `In one line: ${c.repo.description.replace(/\.$/, "")}.` : `A ${c.repo.detected.language} project built in the open.`,
        HOOK_LINE[c.style],
        `This cut shows the project’s purpose and what the repository documents.`,
      ],
      onScreen: [c.repo.detected.language, c.repo.license?.spdx ?? "unlicensed", `${fmtNum(c.repo.stars)} stars`],
    }),
  },
  {
    key: "gap",
    actLabel: "Act II · The Gap",
    needsAudit: true,
    build: (c) => {
      const a = c.audit!;
      return {
        title: `${a.score}/100 — the honest number`,
        visual: "gauge",
        goal: "CINE.MAP: gauge-spin + whoosh — open on the score, not the logo.",
        vo: [
          `Every repository tells two stories. The code — and the proof.`,
          `The deterministic audit scored ${c.name} ${a.score} out of one hundred.`,
          `${a.stats.checksFailed} checks failed. ${a.stats.pointsAtStake} points are sitting on the table.`,
          `Grade ${a.grade} today. This film walks the path to one hundred.`,
        ],
        onScreen: [`${a.score}/100 ship score`, `${a.stats.checksFailed} failing checks`, `${a.stats.pointsAtStake} pts at stake`],
      };
    },
  },
  {
    key: "discovery",
    actLabel: "Act III · The Discovery",
    needsAudit: true,
    build: (c) => {
      const a = c.audit!;
      return {
        title: "What the audit actually found",
        visual: "stars",
        goal: "CINE.MAP: stars count-up + coin-drop — make the invisible visible.",
        vo: [
          `${a.stats.checksTotal} deterministic checks ran. Five categories. Zero LLM guessing.`,
          `Documentation, code quality, security, DevOps, community — measured, not vibes.`,
          `${a.stats.checksPassed} checks already pass. The bones are good.`,
          `The same repo always scores the same. That's the point.`,
        ],
        onScreen: [`${a.stats.checksTotal} checks · 5 categories`, `${a.stats.checksPassed} passed ✓`, "0 LLM guesses"],
      };
    },
  },
  {
    key: "blueprint",
    actLabel: "Act IV · The Blueprint",
    needsAudit: false,
    build: (c) => {
      const mods = modulesOf(c.repo);
      const stacks = c.repo.detected.frameworks.slice(0, 3);
      return {
        title: "How it's built",
        visual: "repo",
        goal: "CINE.MAP: module grid — the architecture without a whiteboard.",
        vo: [
          `Under the hood: ${c.repo.detected.language}${stacks.length ? ` with ${stacks.join(", ")}` : ""}.`,
          mods.length > 1 ? `${mods.length} top-level modules — from ${mods[0]} to ${mods[mods.length - 1]}.` : `A compact codebase — one look and you're oriented.`,
          c.repo.hasTests ? `A real test suite ships with it.` : `Tests are the first thing the audit would ask for.`,
          c.repo.ciWorkflows.length ? `${c.repo.ciWorkflows.length} CI workflows keep the main branch honest.` : `No CI yet — the roadmap's first checkbox.`,
        ],
        onScreen: [`${mods.length} modules mapped`, `${Object.keys(c.repo.detected.dependencies ?? {}).length} runtime deps`, c.repo.ciWorkflows.length ? "CI ✓" : "CI — pending"],
      };
    },
  },
  {
    key: "quickstart",
    actLabel: "Act V · Quickstart",
    needsAudit: false,
    build: (c) => ({
      title: "Zero to running",
      visual: "terminal",
      goal: "CINE.MAP: terminal type-out — the install command IS the money shot.",
      vo: [
        `The whole pitch is one command: ${installCommand(c.repo)}.`,
        c.repo.manifest?.version ? `Currently at version ${c.repo.manifest.version} — installable today.` : `Clone it and it runs — no fourteen-step setup ritual.`,
        testCommand(c.repo) + ".",
        `From npm install to first output in under a minute.`,
      ],
      onScreen: [installCommand(c.repo), c.repo.manifest?.version ? `v${c.repo.manifest.version}` : "main branch", c.repo.envExample ? ".env.example provided" : "zero-config default"],
    }),
  },
  {
    key: "climb",
    actLabel: "Act VI · The Climb",
    needsAudit: true,
    build: (c) => {
      const a = c.audit!;
      const fix1 = a.fixes[0];
      return {
        title: "Ranked fixes, full code",
        visual: "diff",
        goal: "CINE.MAP: diff-scroll + success-chime — every lost point comes back with code.",
        vo: [
          `The engine turns every lost point into a ranked fix — with the full code attached.`,
          fix1 ? `Fix number one: ${fix1.title}. Plus ${fix1.points} points in ${fix1.effort}.` : `The heaviest fix lands first.`,
          `${a.fixes.length} fixes in the queue, ordered by points per minute of effort.`,
          `Copy, paste, commit. The score moves.`,
        ],
        onScreen: [`${a.fixes.length} ranked fixes`, `+${fix1?.points ?? 0} · ${fix1?.title ?? ""}`, "full code attached"],
      };
    },
  },
  {
    key: "pipeline",
    actLabel: "Act VII · The Machine",
    needsAudit: true,
    build: (c) => {
      const a = c.audit!;
      const qw = a.roadmap.find((r) => r.quickWin);
      return {
        title: "Audit → Rank → Fix → Verify → Ship",
        visual: "arch",
        goal: "CINE.MAP: pipeline flow — the machine that walks the repo to 100.",
        vo: [
          `The pipeline is deterministic: audit, rank, fix, verify, ship.`,
          qw ? `Quick win first: “${qw.title}” moves the needle in under five minutes.` : `Each fix is small. Together they are total.`,
          `${a.stats.fixFiles.length} files generated — all grounded in the real stack.`,
          `No vibes. No guessing. The same repo, the same path, every time.`,
        ],
        onScreen: ["5-stage pipeline", `${a.stats.fixFiles.length} files generated`, qw ? "quick win < 5 min" : "ranked by ROI"],
      };
    },
  },
  {
    key: "proof",
    actLabel: "Act VIII · The Proof",
    needsAudit: true,
    build: (c) => {
      const a = c.audit!;
      return {
        title: `${a.score} → 100`,
        visual: "graph",
        goal: "CINE.MAP: commit-graph — the score climbs and stays.",
        vo: [
          `One click. Auto Fix applies every fix in ranked order.`,
          `Watch the gauge climb: ${a.score}... ${Math.min(100, a.score + 20)}... one hundred.`,
          `Grade S. Every check green. Re-audit any time — the number holds.`,
          `Then the badge ships to the README, and the report does the bragging.`,
        ],
        onScreen: [`${a.score} → 100/100`, `Grade ${a.grade} → S`, "README badge shipped"],
      };
    },
  },
  {
    key: "community",
    actLabel: "Act IX · The Community",
    needsAudit: false,
    build: (c) => ({
      title: "Built in the open",
      visual: "stars",
      goal: "CINE.MAP: stars count-up + community chips — traction is the proof.",
      vo: [
        `${fmtNum(c.repo.stars)} stars. ${fmtNum(c.repo.forks)} forks. This isn't a side project.`,
        c.repo.contributors.length ? `${c.repo.contributors.length} contributors have shaped it.` : `One maintainer so far — the best time to star it was yesterday.`,
        c.repo.commitCount ? `${fmtNum(c.repo.commitCount)} commits and counting.` : `The commit history tells the rest.`,
        `Open issues, open PRs, open roadmap — open everything.`,
      ],
      onScreen: [`${fmtNum(c.repo.stars)} stars`, `${fmtNum(c.repo.forks)} forks`, `${c.repo.contributors.length} contributors`],
    }),
  },
  {
    key: "launch",
    actLabel: "Act X · The Launch",
    needsAudit: false,
    build: (c) => ({
      title: c.style === "academic" ? "Questions welcome" : "Star it. Clone it. Ship it.",
      visual: "cta",
      goal: "CINE.MAP: end-card — end on the command, not the credits.",
      vo: [
        ...CTA_LINES[c.style].map((l) => l.replace("{name}", c.name)),
        c.audit ? `The audit scored the code. The film sells the vision. ${c.name} — from ${c.audit.score} to one hundred.` : `${c.name}. Now you've seen it work.`,
      ],
      onScreen: [c.repo.homepage ? c.repo.homepage.replace(/^https?:\/\//, "") : "github.com/" + c.name, c.repo.license?.spdx ?? "MIT", "made with ShipOS"],
    }),
  },
];

// ── Script assembly ──────────────────────────────────────────────────────────

export function buildDemoScript(
  repo: RepoData,
  audit: RepoAudit | null,
  opts: { targetSeconds: DemoTarget; style: DemoStyle },
): VideoScript {
  const target = DEMO_TARGETS.find((t) => t.seconds === opts.targetSeconds) ?? DEMO_TARGETS[2];
  const ctx: SceneCtx = {
    name: `${repo.owner}/${repo.repo}`,
    repo,
    audit,
    meta: null,
    style: opts.style,
  };

  const pool = TEMPLATES.filter((t) => !t.needsAudit || audit);
  const count = Math.min(target.scenes, pool.length);
  const chosen = pool.slice(0, count);

  const scenes: VideoScene[] = chosen.map((t, i) => {
    const dur = sceneDuration(opts.targetSeconds, count, i);
    const built = t.build(ctx, dur);
    // Trim or pad VO lines to fit the scene duration honestly.
    const want = voCount(dur);
    const vo = built.vo.slice(0, Math.max(3, want));
    return {
      id: `demo-${t.key}`,
      act: t.key,
      actLabel: t.actLabel,
      title: built.title,
      duration: dur,
      vo,
      onScreen: built.onScreen,
      visual: built.visual,
      goal: built.goal,
      meta: audit ? { stars: repo.stars, passed: audit.stats.checksPassed, total: audit.stats.checksTotal } : { stars: repo.stars, passed: 0, total: 0 },
    };
  });

  return {
    title: `${ctx.name} — ${target.label.replace(" · ", " ")} demo`,
    scenes,
    totalDuration: scenes.reduce((s, x) => s + x.duration, 0),
  };
}

// ── Director brief ───────────────────────────────────────────────────────────

/** Everything the brief needs — satisfied by the persisted DemoMeta snapshot. */
export interface DemoBriefInput {
  repoTitle: string;
  tagline?: string;
  language?: string;
  license?: string | null;
  homepage?: string | null;
  stars?: number;
  version?: string | null;
  installCmd?: string;
  modules?: string[];
  auditScore?: number | null;
}

export function buildDemoBrief(
  input: DemoBriefInput,
  script: VideoScript,
  opts: { style: DemoStyle; voice: DemoVoice; targetSeconds: DemoTarget },
): string {
  const lines: string[] = [
    `# DEMO FILM BRIEF — ${input.repoTitle}`,
    "",
    `**Target tools:** Runway Gen-3 · Sora · Pika · Kling · Remotion`,
    `**Cut:** ${script.totalDuration}s · ${script.scenes.length} scenes · ${opts.style} style · ${opts.voice} voice`,
    `**Aspect:** 16:9 · ${opts.targetSeconds >= 300 ? "the full 5-minute demo" : `${opts.targetSeconds}s cut`}`,
    input.tagline ? `**Repo:** ${input.tagline}` : "",
    input.auditScore != null ? `**ShipOS audit:** ${input.auditScore}/100 — facts audited before filming` : "",
    "",
    "## Scene-by-scene",
  ].filter((l) => l !== "");
  let acc = 0;
  for (const s of script.scenes) {
    lines.push(
      "",
      `### ${s.actLabel} — ${s.title}  (t+${acc}s → t+${acc + s.duration}s)`,
      `- Visual: ${s.visual} · ${s.goal}`,
      `- On screen: ${s.onScreen.join(" · ")}`,
      `- Voiceover:`,
      ...s.vo.map((v) => `  - "${v}"`),
    );
    acc += s.duration;
  }
  lines.push(
    "",
    "## Look",
    "- Neon-on-dark palette: violet `#6c5ce7` · cyan `#00cec9` on `#0a0a0f`",
    "- Ken Burns drift on every panel, film grain at 4%, captions bottom-center",
    "- Score: low synth pad, whoosh on act transitions, chime on proofs",
    "",
    "## Negative prompt",
    "No stock handshakes, no fake UI screenshots, no invented metrics, no lorem ipsum, no robot voice clichés.",
  );
  return lines.join("\n");
}

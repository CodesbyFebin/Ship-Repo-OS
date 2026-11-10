// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Competitor Radar: the repo-to-video landscape from live research.
// Nov-8 leaderboard (15 repos) + category map + field patterns, then the
// ShipOS feature matrix. Update this file when the field moves — the Radar
// tab renders straight off it.
// ─────────────────────────────────────────────────────────────────────────────

export type ToolKind = "open-source" | "hosted" | "web" | "source-available" | "skill";

export type Competitor = {
  id: string;
  name: string;
  /** Repo slug or site URL. */
  handle: string;
  href: string;
  kind: ToolKind;
  /** Display string — "~78k", "new", "—" (not published). */
  stars: string;
  /** Their one-line pitch, as surveyed. */
  how: string;
  /** Their strongest use case. */
  bestFor: string;
  /** The door ShipOS walks through. */
  gap: string;
};

// ── Nov-8 leaderboard — the 15 trending repos ────────────────────────────────

export type LeaderRow = {
  rank: number;
  repo: string;
  href: string;
  stars: string;
  velocity: string;
  what: string;
  category: CategoryId;
};

export const LEADERBOARD_DATE = "Nov 8 snapshot";

export const LEADERBOARD: LeaderRow[] = [
  { rank: 1, repo: "harry0703/MoneyPrinterTurbo", href: "https://github.com/harry0703/MoneyPrinterTurbo", stars: "140k", velocity: "+3.7k / 7d", what: "Topic in, finished short out — script, footage, voiceover, subtitles, music.", category: "studio" },
  { rank: 2, repo: "heygen-com/hyperframes", href: "https://github.com/heygen-com/hyperframes", stars: "77k", velocity: "+22.3k in Nov", what: "Write HTML, render MP4. Built for agents.", category: "renderer" },
  { rank: 3, repo: "calesthio/OpenMontage", href: "https://github.com/calesthio/OpenMontage", stars: "73.8k", velocity: "+2,014 in 1 day (Nov 7)", what: "Full agentic studio — 12 pipelines, 100+ tools, 700+ skill files.", category: "studio" },
  { rank: 4, repo: "HBAI-Ltd/Toonflow-app", href: "https://github.com/HBAI-Ltd/Toonflow-app", stars: "21k", velocity: "pushed Nov 5", what: "Infinite-canvas workbench for short dramas and motion comics.", category: "studio" },
  { rank: 5, repo: "latent-spaces/brag", href: "https://github.com/latent-spaces/brag", stars: "20.6k", velocity: "steady breakout", what: "One command turns your just-built project into a 20s launch video.", category: "launch" },
  { rank: 6, repo: "hypit-ai/hypit", href: "https://github.com/hypit-ai/hypit", stars: "~20k", velocity: "20k by Oct 8", what: "Clone any viral video as an editable workflow, then ship 100 variants.", category: "clone" },
  { rank: 7, repo: "lemomo-ai/lemo-opuscar", href: "https://github.com/lemomo-ai/lemo-opuscar", stars: "13.2k", velocity: "created Sep 26", what: "66 film styles made entirely in code, no video model.", category: "renderer" },
  { rank: 8, repo: "Vincentwei1021/video-shotcraft", href: "https://github.com/Vincentwei1021/video-shotcraft", stars: "11k", velocity: "+1,088 in 1 day (Nov 7)", what: "Cinematic product promos with Remotion — 124+ shot recipe cards, beat sync.", category: "launch" },
  { rank: 9, repo: "dramaclaw/dramaclaw", href: "https://github.com/dramaclaw/dramaclaw", stars: "7.4k", velocity: "trending since summer", what: "Script-to-finished-film pipeline for dramas, ads, product videos.", category: "studio" },
  { rank: 10, repo: "openfilm/openfilm", href: "https://github.com/openfilm/openfilm", stars: "5.2k", velocity: "27 days on trending since Oct 12", what: "Coding agent writes film as web pages; Studio editor changes anything.", category: "renderer" },
  { rank: 11, repo: "nexu-io/html-video", href: "https://github.com/nexu-io/html-video", stars: "4.8k", velocity: "evergreen trending", what: "HTML to MP4 on your laptop — 21 templates, paste a repo / article link.", category: "renderer" },
  { rank: 12, repo: "JuneYaooo/rea-video", href: "https://github.com/JuneYaooo/rea-video", stars: "3.7k", velocity: "+126 stars on Nov 8, breakout", what: "Reverse-engineer any video shot by shot, then hand you the remake plan.", category: "clone" },
  { rank: 13, repo: "scenario-labs/skills", href: "https://github.com/scenario-labs/skills", stars: "3.5k", velocity: "97 skills", what: "Production-ready images, video, audio, 3D via Scenario MCP.", category: "renderer" },
  { rank: 14, repo: "kaomei/stickman-video-director", href: "https://github.com/kaomei/stickman-video-director", stars: "3.2k", velocity: "522 forks", what: "Script to viral stickman videos for faceless YouTube.", category: "explainer" },
  { rank: 15, repo: "Vincentwei1021/anything2explainer", href: "https://github.com/Vincentwei1021/anything2explainer", stars: "3.1k", velocity: "sister repo to shotcraft", what: "Topic in, narrated black-canvas explainer out — Remotion + TTS.", category: "explainer" },
];

// ── Category map ─────────────────────────────────────────────────────────────

export type CategoryId = "studio" | "renderer" | "clone" | "launch" | "explainer";

export const CATEGORY_META: Record<CategoryId, { label: string; blurb: string }> = {
  studio: { label: "Full studio systems", blurb: "Whole pipelines — storyboard, voiceover, cut — behind one agent." },
  renderer: { label: "Code-to-video renderers", blurb: "The infrastructure layer: HTML / Remotion / code → deterministic MP4." },
  clone: { label: "Clone & reverse-engineer", blurb: "The hottest new angle — start from a reference video, not a prompt." },
  launch: { label: "Launch & product promo", blurb: "Paste your repo / site → launch video. ShipOS's home turf." },
  explainer: { label: "Explainers & faceless", blurb: "Topic in, narrated explainer out — channels that never show a face." },
};

export const CATEGORY_DETAILS: { id: CategoryId; tools: { name: string; note: string }[] }[] = [
  {
    id: "studio",
    tools: [
      { name: "OpenMontage", note: "12 pipelines — Animated Explainer, Cinematic, Clip Factory, Documentary Montage, Podcast Repurpose, Localization & Dub. Approval gate at each stage." },
      { name: "Toonflow-app", note: "Script, storyboard, characters, scenes, image and video shots on one infinite canvas." },
      { name: "DramaClaw", note: "Novel / script → character extraction → episode planning → storyboard → voiceover → final cut. Elastic 2.0 — source-available, not OSS." },
    ],
  },
  {
    id: "renderer",
    tools: [
      { name: "hyperframes", note: "HeyGen's Apache 2.0 framework. HTML + data attributes → deterministic MP4. 7–21 agent skills per bundle; powers /brag." },
      { name: "html-video", note: "The DIY ancestor: prompt / article / repo → multi-frame HTML scenes → headless Chromium + ffmpeg. No per-render fees." },
      { name: "OpenFilm", note: "Same HTML-film idea with a real editor — move, scale, rotate, restyle anything; export MP4, GIF, or a Premiere / Resolve timeline." },
    ],
  },
  {
    id: "clone",
    tools: [
      { name: "hypit", note: "Gives agents SVML — a video language. Splits a viral Short into footage, captions, B-roll, effects anchored to words; re-skin 100×." },
      { name: "rea-video", note: "Shot-by-shot verdict: filmed, AI-generated, or coded — plus how captions, cuts and audio were made and how to remake it." },
      { name: "bang-motion", note: "Agent skill → motion designer: openers, promos, kinetic typography as one index.html that plays like video. 40 days on daily trending." },
    ],
  },
  {
    id: "launch",
    tools: [
      { name: "brag", note: "/brag turns the project you just built into a short shareable launch video — music, motion, share copy. Powered by Hyperframes; its own launch loop was made by /brag." },
      { name: "video-shotcraft", note: "Real page captures, 2.5D camera moves, beat-synced cuts, sound design, Motion Workbench, JianYing / CapCut export — all Remotion." },
      { name: "Watch list", note: "saas-video-ad-skill (real web app → 15–40s SaaS ads), autonomous-sop-video (workflow → narrated tutorial), video-agent-studio (phone photos → Shorts)." },
    ],
  },
  {
    id: "explainer",
    tools: [
      { name: "anything2explainer", note: "Topic + length + language → researched narration, voiceover, frame-accurate timeline, then parallel agents write one Remotion component per shot." },
      { name: "video-talkcraft", note: "Voiceover-driven: give it a script + finished VO, it aligns word-level timestamps and builds a SHOTBOOK." },
      { name: "stickman-video-director", note: "Script → multi-style animated stickman videos for faceless YouTube — visuals, VO, captions, SFX, 100% free." },
    ],
  },
];

// ── What the pattern tells us — and what ShipOS ships in answer ──────────────

export type Pattern = { n: number; title: string; body: string; shipos: string };

export const FIELD_PATTERNS: Pattern[] = [
  {
    n: 1,
    title: "Skills beat apps",
    body: "Almost every trending repo is not an app — it's a SKILL.md + scripts that teaches Claude Code / Codex how to do video. That's why they spread so fast.",
    shipos: "scene-schema.json already ships with every render — the storyboard contract any agent can write or film. Next: publish the auditor + optimizer as a skills package.",
  },
  {
    n: 2,
    title: "Deterministic beats generative",
    body: "The winners render with HTML, Remotion, or code — not just a video model. Editable, re-runnable, brand-consistent output wins.",
    shipos: "Already the law here: Path A is a deterministic canvas composer; Path B stages the same schema through Remotion + ffmpeg. Same schema, byte-stable replays.",
  },
  {
    n: 3,
    title: "Reference is the new prompt",
    body: "hypit and rea-video both start from “give me a viral video you like” instead of “write me a prompt.” Cloning and reverse-engineering is now first-class.",
    shipos: "On the radar: paste a reference video URL and the Story Engine maps its act structure onto your audit's scene schema — clone the shape, keep your facts.",
  },
  {
    n: 4,
    title: "Repo-to-video is a sub-niche of launch video",
    body: "brag and video-shotcraft both treat “paste your repo / site” as the input and “launch video” as the output.",
    shipos: "That's literally the territory — except ShipOS walks in with the audit score, the 54-fix optimization pack, and a 5-minute cut, not just a 20-second loop.",
  },
];

// ── Deep-compare roster (feature matrix) ─────────────────────────────────────

export const COMPETITORS: Competitor[] = [
  {
    id: "openmontage",
    name: "OpenMontage",
    handle: "calesthio/OpenMontage",
    href: "https://github.com/calesthio/OpenMontage",
    kind: "open-source",
    stars: "73.8k",
    how: "Full agentic studio — 12 pipelines, 100+ tools, 700+ skill files.",
    bestFor: "Teams already living inside an agentic IDE that want full production control.",
    gap: "No audit before filming — it narrates whatever the repo is, README rot and all.",
  },
  {
    id: "hyperframes",
    name: "HyperFrames",
    handle: "heygen-com/hyperframes",
    href: "https://github.com/heygen-com/hyperframes",
    kind: "open-source",
    stars: "77k",
    how: "Write HTML → render MP4. Built for coding agents; powers /brag.",
    bestFor: "Agents that can emit pixel-perfect HTML frames and want deterministic output.",
    gap: "Frames are all it knows — no scoring, no optimization, no distribution pack.",
  },
  {
    id: "brag",
    name: "brag",
    handle: "latent-spaces/brag",
    href: "https://github.com/latent-spaces/brag",
    kind: "skill",
    stars: "20.6k",
    how: "One command turns the project you just built into a 20s launch video — music, motion, share copy. Hyperframes-powered.",
    bestFor: "The fastest possible “I just shipped something” social loop.",
    gap: "20 seconds and done — no audit, no SEO/AEO/GEO pack, no long-form cut.",
  },
  {
    id: "repoclip",
    name: "RepoClip",
    handle: "repoclip.io",
    href: "https://repoclip.io",
    kind: "hosted",
    stars: "—",
    how: "Paste a repo URL → AI analyzes code, generates narration, visuals, music. GitHub Action + public API.",
    bestFor: "Zero-setup teams that want a video in CI without reading a doc.",
    gap: "Closed hosted pipeline — no editable scene schema, no repo visibility scoring.",
  },
  {
    id: "shotcraft",
    name: "video-shotcraft",
    handle: "Vincentwei1021/video-shotcraft",
    href: "https://github.com/Vincentwei1021/video-shotcraft",
    kind: "skill",
    stars: "11k",
    how: "Cinematic product promos with Remotion — 124+ shot recipe cards, beat sync, page captures.",
    bestFor: "Polished product promos with full shot-level control.",
    gap: "Promo craft only — repo health, optimization and distribution are out of scope.",
  },
  {
    id: "aidemo",
    name: "aidemo",
    handle: "tandryukha/aidemo",
    href: "https://github.com/tandryukha/aidemo",
    kind: "open-source",
    stars: "~26",
    how: "Coding agent writes storyboard.json → headless Chrome records, voices, captions. CI-friendly, ~$0.",
    bestFor: "Deterministic replay in CI with no API key.",
    gap: "Storyboard written by the agent, not editable per scene; no cloud 4K path.",
  },
  {
    id: "openfilm",
    name: "OpenFilm",
    handle: "openfilm/openfilm",
    href: "https://github.com/openfilm/openfilm",
    kind: "open-source",
    stars: "5.2k",
    how: "Agent writes the film as web pages; local Studio editor for cutting.",
    bestFor: "Creative developers who want to hand-edit the agent's cut locally.",
    gap: "Editing-only story layer — nothing upstream (audit) or downstream (SEO/AEO/GEO).",
  },
  {
    id: "gitdiagram",
    name: "GitDiagram",
    handle: "gitdiagram.com",
    href: "https://gitdiagram.com",
    kind: "web",
    stars: "—",
    how: "Replace \"hub\" with \"diagram\" in any GitHub URL → 1-min narrated explainer video.",
    bestFor: "The fastest zero-setup URL trick for a fixed 1-minute walkthrough.",
    gap: "One fixed format, one fixed length — no presets, no schema, no optimization.",
  },
];

// ── Feature matrix — ShipOS vs the field ─────────────────────────────────────

export type MatrixMark = "full" | "partial" | "none";

export type MatrixRow = {
  capability: string;
  /** Column keys: "shipos" + every COMPETITORS id. */
  cells: Record<string, MatrixMark>;
};

export const MATRIX_ROWS: MatrixRow[] = [
  {
    capability: "Scores the repo before filming (0–100 audit + grade)",
    cells: { shipos: "full", openmontage: "none", hyperframes: "none", brag: "none", repoclip: "none", shotcraft: "none", aidemo: "none", openfilm: "none", gitdiagram: "none" },
  },
  {
    capability: "SEO / AEO / GEO pack — description · topics · agents.txt · llms.txt · 50 fixes",
    cells: { shipos: "full", openmontage: "none", hyperframes: "none", brag: "none", repoclip: "none", shotcraft: "none", aidemo: "none", openfilm: "none", gitdiagram: "none" },
  },
  {
    capability: "Long-form cut — 5-minute demo, not just a 20s loop",
    cells: { shipos: "full", openmontage: "full", hyperframes: "partial", brag: "none", repoclip: "partial", shotcraft: "partial", aidemo: "partial", openfilm: "partial", gitdiagram: "none" },
  },
  {
    capability: "Instant browser render (WebM, $0, no GPU, no queue)",
    cells: { shipos: "full", openmontage: "none", hyperframes: "partial", brag: "partial", repoclip: "none", shotcraft: "partial", aidemo: "partial", openfilm: "none", gitdiagram: "full" },
  },
  {
    capability: "4K cloud render on free ZeroGPU (quota-honest ledger)",
    cells: { shipos: "full", openmontage: "none", hyperframes: "partial", brag: "partial", repoclip: "partial", shotcraft: "partial", aidemo: "none", openfilm: "none", gitdiagram: "none" },
  },
  {
    capability: "Per-scene editable schema (voiceover · captions · effects · cine-map)",
    cells: { shipos: "full", openmontage: "partial", hyperframes: "partial", brag: "none", repoclip: "none", shotcraft: "full", aidemo: "partial", openfilm: "full", gitdiagram: "none" },
  },
  {
    capability: "Captions both ways — SRT download + WebVTT in-player",
    cells: { shipos: "full", openmontage: "partial", hyperframes: "none", brag: "partial", repoclip: "full", shotcraft: "full", aidemo: "full", openfilm: "partial", gitdiagram: "partial" },
  },
  {
    capability: "$0 voiceover (Web Speech presets · no ElevenLabs bill)",
    cells: { shipos: "full", openmontage: "partial", hyperframes: "none", brag: "partial", repoclip: "partial", shotcraft: "partial", aidemo: "full", openfilm: "partial", gitdiagram: "full" },
  },
  {
    capability: "Open source / self-host",
    cells: { shipos: "full", openmontage: "full", hyperframes: "full", brag: "full", repoclip: "none", shotcraft: "full", aidemo: "full", openfilm: "full", gitdiagram: "none" },
  },
  {
    capability: "No paid API key on any path",
    cells: { shipos: "full", openmontage: "partial", hyperframes: "partial", brag: "full", repoclip: "none", shotcraft: "full", aidemo: "full", openfilm: "partial", gitdiagram: "full" },
  },
  {
    capability: "Structured data — JSON-LD, robots AI rules, launch copy pack",
    cells: { shipos: "full", openmontage: "none", hyperframes: "none", brag: "partial", repoclip: "none", shotcraft: "none", aidemo: "none", openfilm: "none", gitdiagram: "none" },
  },
];

// ── Where ShipOS wins — the six differentiators ──────────────────────────────

export type Differentiator = {
  title: string;
  body: string;
  icon: string; // lucide glyph name resolvable in the tab
};

export const DIFFERENTIATORS: Differentiator[] = [
  {
    title: "Audit before filming",
    body: "The only tool in the field that scores the repo 0–100 across Docs · Code Quality · Security · DevOps · Community before a single frame is written — so the film sells the truth, not the README rot.",
    icon: "scan",
  },
  {
    title: "The Optimization Pack nobody else ships",
    body: "SEO · AEO · GEO each driven to 100/100: optimized description, 12–18 topics, agents.txt, llms.txt, FAQ, JSON-LD, AI-crawler robots rules, launch copy — 54 fixes per repo.",
    icon: "wand",
  },
  {
    title: "20-second loop → 5-minute cut",
    body: "brag ships the 20s social loop; ShipOS ships that and the 5-minute demo — ten scenes, full architecture walkthrough, same deterministic schema, same one command.",
    icon: "film",
  },
  {
    title: "Two paths, both $0",
    body: "Path A renders WebM entirely in the browser — MediaRecorder + canvas, no server, ~10s. Path B renders 4K in the cloud on free ZeroGPU with a 300 GPU-second daily ledger. Pick per video.",
    icon: "cloud",
  },
  {
    title: "The schema is the product",
    body: "Every video is a scene-schema.json — acts, per-scene voiceover, captions, effects, cine-map. Edit it in the Studio, hand it to an agent, or replay it deterministically in CI like aidemo's storyboard.json.",
    icon: "layers",
  },
  {
    title: "Story → distribution, end to end",
    body: "One run ships the film, slides.pptx, landing.html, brief.md and captions.srt. Competitors stop at the video; ShipOS walks it to SEO, answer engines and generative engines.",
    icon: "rocket",
  },
];

// ── Signals from the field → the ShipOS roadmap ─────────────────────────────

export type AdoptSignal = {
  title: string;
  source: string;
  detail: string;
  tier: "FREE" | "PRO" | "TEAM";
  status: "shipped" | "planned";
};

export const ADOPT_SIGNALS: AdoptSignal[] = [
  {
    title: "storyboard contract",
    source: "aidemo",
    detail: "scene-schema.json already ships with every render — an agent can write or rewrite it and ShipOS will film it.",
    tier: "FREE",
    status: "shipped",
  },
  {
    title: "one-command demo film",
    source: "brag",
    detail: "the Demo Maker: paste a repo URL → 5-minute cinematic demo, 10 scenes, SRT + schema + cloud 4K. brag's loop, long-form.",
    tier: "FREE",
    status: "shipped",
  },
  {
    title: "`npx skills add shipos`",
    source: "OpenFilm · OpenMontage",
    detail: "publish the auditor + optimizer as a skills package so Claude Code / Cursor can call them inline.",
    tier: "FREE",
    status: "planned",
  },
  {
    title: "GitHub Action",
    source: "RepoClip",
    detail: "audit + optimization pack + Path A render on every push, results committed back as artifacts.",
    tier: "PRO",
    status: "planned",
  },
  {
    title: "reference-video cloning",
    source: "hypit · rea-video",
    detail: "map a reference video's act structure onto the audit's scene schema — clone the shape, keep your facts.",
    tier: "PRO",
    status: "planned",
  },
  {
    title: "public video API",
    source: "RepoClip",
    detail: "POST /api/v1/render next to the existing /api/v1/audit — schema in, job id out, poll to done.",
    tier: "PRO",
    status: "planned",
  },
  {
    title: "HTML-frame mode",
    source: "HyperFrames",
    detail: "optional composer that lets an agent author raw HTML frames instead of the scene schema.",
    tier: "TEAM",
    status: "planned",
  },
  {
    title: "deterministic CI replay",
    source: "aidemo",
    detail: "pin the schema + seed → byte-identical render in CI, no API key, no flake.",
    tier: "TEAM",
    status: "planned",
  },
];

export const SURVEY_NOTE =
  "Matrix cells reflect each tool's public pitch as surveyed; “partial” means reachable with setup or a paid key. Stars and velocity are approximate at survey time.";

# ShipOS — The Universal Submission Engine

![ShipOS repository launch banner](docs/media/social-preview.png)

[Looping GIF preview](docs/media/repo-preview.gif) · [MP4 teaser](docs/media/repo-teaser.mp4) · [Captions](docs/media/repo-teaser.vtt)

ShipOS turns a GitHub repository into a complete, provenance-verified launch kit — and then films it. Paste a repo URL and get an audited README, a 0–100 full-repo score with ranked fixes, an SEO/AEO/GEO optimization pack, a cinematic 5-minute demo film, and a 4K render bundle. The submission pipeline records the evidence behind its claims.

```
repo URL ──► ingest (10 claws) ──► audit (50 checks · 0–100) ──► forge ──► verify ──► ship
                    │
                    ├──► optimize (SEO · AEO · GEO · 54-point review pack)
                    ├──► demo film (60s / 150s / 300s · 10 acts · LLM voiceover)
                    ├──► render cloud (Path B · 4K · GPU-quota pipeline)
                    └──► competitor radar (the repo-to-video field, mapped)
```

---

## Modes

| Mode | What it does |
|------|--------------|
| **GitHub Workbench** | 40 evidence checks, 30 launch assets, and 30 runnable utilities. Includes profile README, SVG and PNG previews, and a local CLI for GIF, MP4, and WebVTT. |
| **Full Package** | One URL → README, demo script, pitch deck, report, SEO report, repo health, claim ledger, export bundle. Every claim checked against real commits (verified / partial / rejected). |
| **Full Repo Auditor** | Repo-wide deterministic audit: 50 checks × 100 points across Docs 25 · Code Quality 25 · Security 20 · DevOps 15 · Community 15, grades S–F. Every missing point gets a ranked fix with full copy-paste code. Also supports a zero-network **file-list mode** and strictness levels. |
| **Optimization Engine** | Scores Search-Engine (SEO), Answer-Engine (AEO) and Generative-Engine (GEO) visibility 0–100, then ships the 54-point pack: description, topics, `agents.txt`, `llms.txt`, FAQ, JSON-LD, robots AI rules, launch copy with observed scores and guidance for a follow-up scan. |
| **Demo Maker** | Repo URL → **5-minute demo film**: 10 acts, ~300s schema, LLM-written voiceover with a deterministic fallback, captions, brief, scene editor, and one-click WebM export or Render Cloud handoff. Audit facts are woven into the story ("audit before filming"). |
| **README Upgrader** | Zero-trust README audit across 8 categories → the full 100/100 README with every fix applied. |
| **Video Studio (Path A)** | Cinematic canvas player + browser recorder. Edit the scene schema, play the story, export WebM instantly — $0, no server. |
| **Render Cloud (Path B)** | Real 4K pipeline on free GPU quotas: GPU bursts for voiceover/banners/captions, CPU Remotion + ffmpeg muxing, daily 300 GPU-second budget ledger, ZIP bundle with deploy files. |
| **Competitor Radar** | The repo-to-video field, mapped: Nov-8 leaderboard of 15 trending tools, 5 category deep-dives, 11-capability feature matrix, 4 field patterns, and the 6 doors it leaves open — ShipOS's roadmap. |
| **Model Radar** | Browse the bundled model catalog and compare filters and capabilities. |
| **PRO** | Gated extras: 4K renders, scheduled auto-audits, public API keys (`/api/v1/audit`), team seats. |

---

## Quick Start

```bash
# 1. install with Node.js 24 and Bun 1.3.4 available
bun install --frozen-lockfile

# 2. configure
cp .env.example .env          # SQLite DATABASE_URL — no other setup needed

# 3. initialize the default SQLite path and apply the schema
mkdir -p prisma/db && touch prisma/db/custom.db
bun run db:push

# 4. run
bun run dev                   # http://localhost:3000
```

Production build: `bun run build && bun run start`. For standalone SQLite deployments, set an absolute `DATABASE_URL` for both schema setup and the running server.

### GitHub Workbench

Open **GitHub Workbench** in the mode bar, or run `node scripts/workbench.mjs --help` in a checkout. See the [Workbench guide](docs/workbench.md) for evidence, scoring, exports, and media publishing.

The server runs as a trusted single-instance demo. See the [security policy](SECURITY.md) before giving others access.

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                 # mode rail and view router
│   └── api/
│       ├── ship/                # POST — full package pipeline (fire-and-forget job)
│       ├── projects/            # GET list · GET/DELETE [id] — ship logs
│       ├── audit/               # POST audit · GET/DELETE [id] · offline file-list mode
│       ├── optimize/            # POST optimizer · GET/DELETE [id]
│       ├── demo/                # POST demo maker · GET/DELETE [id]
│       ├── render/              # POST render cloud · GET/DELETE [id]
│       ├── upgrade/             # POST README upgrader
│       ├── pro/                 # PRO license state (demo checkout)
│       ├── scheduled/           # scheduled auto-audits (PRO)
│       ├── team/ · apikeys/     # team seats + public API keys (PRO)
│       ├── feedback/            # per-fix "was this helpful?"
│       └── v1/audit/            # public API (PRO TEAM, key-gated)
├── lib/shipos/                  # the engines
│   ├── ingest.ts / scrape.ts    # repo ingestion: retry + snapshot fallback, never masks 404
│   ├── audit.ts / repo-audit.ts # 50-check deterministic audit engine
│   ├── fixes.ts / generators.ts # ranked fixes with full code + artifact forges
│   ├── optimizer.ts             # SEO/AEO/GEO scoring + 54-point pack (LLM + fallback)
│   ├── story-engine.ts          # scene schema (VideoScript contract)
│   ├── demo-engine.ts / demo-runner.ts  # 5-min demo film builder
│   ├── render-worker.ts / hf-bundle.ts  # Path B worker + ZIP bundle
│   ├── cinema-canvas.ts         # Path A canvas renderer
│   └── competitors.ts           # radar data (15 tools · 5 categories · 4 patterns)
└── ui/                          # design-system kit (Material-3-flavoured, dark first)
```

### The zero-lies loop

Ingestion crawls the live repo (with transient-failure retry + exponential backoff). Every generated claim is cross-checked against the captured facts, and only *verified* claims make it into artifacts. If live ingestion fails, the last good snapshot from the database is used and labeled (`source: snapshot`) — real 404s are never masked.

### Deterministic, always-lands engines

Every LLM-powered step has a deterministic template fallback: the audit is pure code, the demo script builds from repo facts alone, the optimizer's 54-point pack ships even with the LLM offline. The app never shows a dead end.

---

## API Examples

```bash
# full package
curl -X POST localhost:3000/api/ship \
  -H 'content-type: application/json' \
  -d '{"repoUrl": "https://github.com/honojs/hono", "preset": "meta-hackathon"}'

# full repo audit
curl -X POST localhost:3000/api/audit \
  -H 'content-type: application/json' \
  -d '{"repoUrl": "https://github.com/honojs/hono", "strictness": "balanced"}'

# 5-minute demo film
curl -X POST localhost:3000/api/demo \
  -H 'content-type: application/json' \
  -d '{"repoUrl": "https://github.com/honojs/hono", "targetSeconds": 300, "style": "launch"}'

# optimization pack
curl -X POST localhost:3000/api/optimize \
  -H 'content-type: application/json' \
  -d '{"repoUrl": "https://github.com/honojs/hono"}'
```

Jobs are fire-and-forget: POST returns `{ ok, id }`, then poll `GET /api/<engine>/:id` for `status` / `stage` progress.

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript 5** (strict)
- **Tailwind CSS 4** + custom **Material-3-flavoured UI kit** (`src/ui`)
- **Prisma ORM + SQLite** (12 models: projects, jobs, quota ledger, PRO state)
- **bun** runtime; WebM via `MediaRecorder`, ZIP via `jszip`
- LLM-enhanced copywriting with deterministic fallbacks

## Scripts

```bash
bun run dev        # dev server (port 3000)
bun run test       # Workbench regression tests
bun run typecheck  # TypeScript
bun run lint:workbench # Workbench ESLint
bun run lint       # full repository ESLint
bun run db:push    # apply prisma schema
bun run db:generate
bun run build      # production build
bun run start      # production server
```

## License

MIT — see [LICENSE](./LICENSE).

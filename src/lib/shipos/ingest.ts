// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Ingestion orchestrator: GitHub URL → verified RepoData
// ─────────────────────────────────────────────────────────────────────────────
import type { RepoCommit, RepoData, CommitType, RepoManifest, DetectedStack, RepoData as RepoDataT } from "./types";
import {
  scrapeRepoPage,
  scrapeTree,
  scrapeCommits,
  fetchRaw,
  tryRestApi,
  RepoNotFoundError,
  IngestionError,
} from "./scrape";
import { db } from "@/lib/db";

export { RepoNotFoundError, IngestionError };

/** Accept `owner/repo`, `github.com/owner/repo`, `https://github.com/owner/repo(.git)` */
export function normalizeRepoUrl(input: string): { owner: string; repo: string; url: string } {
  let s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const m = s.match(/github\.com[/:]([^/]+)\/([^/?#]+)/i);
  if (m) {
    return { owner: m[1], repo: m[2], url: `https://github.com/${m[1]}/${m[2]}` };
  }
  const short = s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (short) {
    return { owner: short[1], repo: short[2], url: `https://github.com/${short[1]}/${short[2]}` };
  }
  throw new IngestionError("Invalid repository. Use https://github.com/owner/repo");
}

const COMMIT_TYPE_RE = /^(\w+)(\([^)]*\))?!?:\s/;
const TYPE_MAP: Record<string, CommitType> = {
  feat: "feat",
  feature: "feat",
  fix: "fix",
  bugfix: "fix",
  hotfix: "fix",
  chore: "chore",
  docs: "docs",
  doc: "docs",
  refactor: "refactor",
  test: "test",
  tests: "test",
  style: "style",
  perf: "perf",
  performance: "perf",
  ci: "ci",
  build: "ci",
};

export function classifyCommit(message: string): CommitType {
  const m = message.match(COMMIT_TYPE_RE);
  if (m) return TYPE_MAP[m[1].toLowerCase()] ?? "other";
  return "other";
}

const FRAMEWORK_MAP: Record<string, string> = {
  react: "React",
  "react-dom": "React",
  next: "Next.js",
  nuxt: "Nuxt",
  "@nuxt/framework": "Nuxt",
  vue: "Vue",
  svelte: "Svelte",
  "@sveltejs/kit": "SvelteKit",
  "@angular/core": "Angular",
  remix: "Remix",
  "@remix-run/node": "Remix",
  astro: "Astro",
  gatsby: "Gatsby",
  express: "Express",
  fastify: "Fastify",
  hono: "Hono",
  "@nestjs/core": "NestJS",
  koa: "Koa",
  "socket.io": "Socket.IO",
  ws: "WebSocket",
  prisma: "Prisma",
  "@prisma/client": "Prisma",
  drizzle: "Drizzle ORM",
  "drizzle-orm": "Drizzle ORM",
  mongoose: "Mongoose",
  "type-orm": "TypeORM",
  "typeorm": "TypeORM",
  "sequelize": "Sequelize",
  "knex": "Knex",
  "tailwindcss": "Tailwind CSS",
  "styled-components": "styled-components",
  "@tanstack/react-query": "TanStack Query",
  "react-router": "React Router",
  "react-router-dom": "React Router",
  "three": "Three.js",
  "framer-motion": "Framer Motion",
  "zod": "Zod",
  "electron": "Electron",
  "playwright": "Playwright",
  "puppeteer": "Puppeteer",
  "langchain": "LangChain",
  "openai": "OpenAI SDK",
  "axios": "Axios",
  "graphql": "GraphQL",
  "fastapi": "FastAPI",
  "flask": "Flask",
  "django": "Django",
  "streamlit": "Streamlit",
  "pydantic": "Pydantic",
  "torch": "PyTorch",
  "tensorflow": "TensorFlow",
  "scikit-learn": "scikit-learn",
  "numpy": "NumPy",
  "pandas": "pandas",
  "gin-gonic/gin": "Gin",
  "actix-web": "Actix Web",
  "rocket": "Rocket",
  "axum": "Axum",
  "tokio": "Tokio",
  "spring-boot": "Spring Boot",
};

const DB_MAP: Record<string, string> = {
  pg: "PostgreSQL",
  postgres: "PostgreSQL",
  "pg-promise": "PostgreSQL",
  mysql: "MySQL",
  mysql2: "MySQL",
  sqlite: "SQLite",
  "sqlite3": "SQLite",
  "better-sqlite3": "SQLite",
  mongodb: "MongoDB",
  mongoose: "MongoDB",
  redis: "Redis",
  ioredis: "Redis",
  supabase: "Supabase",
  firebase: "Firebase",
  firestore: "Firebase",
  dynamodb: "DynamoDB",
  "aws-sdk": "AWS SDK",
  pscale: "PlanetScale",
  "@planetscale/database": "PlanetScale",
  psycopg2: "PostgreSQL",
  "psycopg2-binary": "PostgreSQL",
  pymongo: "MongoDB",
};

const TEST_DEPS = ["jest", "vitest", "mocha", "pytest", "cypress", "playwright", "@playwright/test", "karma", "ava", "uvu", "node:test"];

function detectStack(
  manifest: RepoManifest | null,
  rootFiles: string[],
  readme: string | null
): RepoDataT["detected"] {
  const deps = { ...(manifest?.dependencies ?? {}), ...(manifest?.devDependencies ?? {}) };
  const depKeys = new Set(Object.keys(deps).map((k) => k.toLowerCase()));

  const frameworks = new Set<string>();
  const databases = new Set<string>();
  const tools = new Set<string>();

  for (const [dep, name] of Object.entries(FRAMEWORK_MAP)) {
    if (depKeys.has(dep)) frameworks.add(name);
  }
  for (const [dep, name] of Object.entries(DB_MAP)) {
    if (depKeys.has(dep)) databases.add(name);
  }
  if (rootFiles.some((f) => /^dockerfile$/i.test(f)) || depKeys.has("docker-compose")) tools.add("Docker");
  if (rootFiles.some((f) => /^docker-compose/i.test(f))) tools.add("Docker Compose");
  if (rootFiles.some((f) => f.toLowerCase().startsWith(".github"))) tools.add("GitHub Actions");
  if (rootFiles.some((f) => /^vercel\.json$/i.test(f))) tools.add("Vercel");
  if (rootFiles.some((f) => /^netlify\.toml$/i.test(f))) tools.add("Netlify");
  if (rootFiles.some((f) => /^wrangler\.toml$/i.test(f)) || depKeys.has("wrangler")) tools.add("Cloudflare Workers");
  if (depKeys.has("typescript") || rootFiles.some((f) => f === "tsconfig.json")) tools.add("TypeScript");
  if (depKeys.has("eslint")) tools.add("ESLint");
  if (depKeys.has("prettier") || rootFiles.some((f) => f.startsWith(".prettierrc"))) tools.add("Prettier");

  // Language detection from manifests + files
  const langs: { name: string; pct: number }[] = [];
  const isJs = manifest !== null;
  const hasTs = depKeys.has("typescript") || rootFiles.includes("tsconfig.json");
  const hasPython =
    rootFiles.some((f) => ["requirements.txt", "pyproject.toml", "setup.py", "Pipfile"].includes(f)) ||
    (readme?.toLowerCase().includes("pip install") ?? false);
  const hasGo = rootFiles.includes("go.mod");
  const hasRust = rootFiles.includes("Cargo.toml");
  const hasJava = rootFiles.some((f) => ["pom.xml", "build.gradle", "build.gradle.kts"].includes(f));
  const hasRuby = rootFiles.includes("Gemfile");
  const hasPhp = rootFiles.includes("composer.json");
  const hasCpp = rootFiles.some((f) => ["CMakeLists.txt", "Makefile"].includes(f)) && !isJs;

  if (isJs && hasTs) langs.push({ name: "TypeScript", pct: 60 }, { name: "JavaScript", pct: 25 });
  else if (isJs) langs.push({ name: "JavaScript", pct: 70 });
  if (hasPython) langs.push({ name: "Python", pct: langs.length ? 15 : 80 });
  if (hasGo) langs.push({ name: "Go", pct: langs.length ? 15 : 80 });
  if (hasRust) langs.push({ name: "Rust", pct: langs.length ? 15 : 80 });
  if (hasJava) langs.push({ name: "Java", pct: langs.length ? 15 : 80 });
  if (hasRuby) langs.push({ name: "Ruby", pct: langs.length ? 10 : 80 });
  if (hasPhp) langs.push({ name: "PHP", pct: langs.length ? 10 : 80 });
  if (hasCpp) langs.push({ name: "C/C++", pct: langs.length ? 10 : 80 });
  if (langs.length === 0) langs.push({ name: "Unknown", pct: 100 });
  // normalize percentages
  const total = langs.reduce((s, l) => s + l.pct, 0);
  for (const l of langs) l.pct = Math.round((l.pct / total) * 100);

  // Package manager
  let packageManager: string | null = null;
  if (rootFiles.includes("bun.lock") || rootFiles.includes("bun.lockb")) packageManager = "bun";
  else if (rootFiles.includes("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (rootFiles.includes("yarn.lock")) packageManager = "yarn";
  else if (rootFiles.includes("package-lock.json")) packageManager = "npm";
  else if (rootFiles.includes("requirements.txt") || rootFiles.includes("pyproject.toml")) packageManager = "pip";
  else if (rootFiles.includes("Cargo.toml")) packageManager = "cargo";
  else if (rootFiles.includes("go.mod")) packageManager = "go";

  return {
    language: langs[0]?.name ?? "Unknown",
    languages: langs,
    frameworks: [...frameworks],
    databases: [...databases],
    tools: [...tools],
    packageManager,
    scripts: manifest?.scripts ?? {},
    dependencies: manifest?.dependencies ?? {},
    devDependencies: manifest?.devDependencies ?? {},
  };
}

/** Snapshot languages may be stored as plain strings (legacy) or {name,pct}; coerce to {name,pct}[]. */
function coerceLangPcts(v: unknown): { name: string; pct: number }[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 8).map((item) => {
    if (typeof item === "string") return { name: item, pct: 0 };
    if (item && typeof item === "object") {
      const o = item as { name?: unknown; pct?: unknown };
      return {
        name: typeof o.name === "string" ? o.name : "Unknown",
        pct: typeof o.pct === "number" ? o.pct : 0,
      };
    }
    return { name: "Unknown", pct: 0 };
  });
}

function parseEnvExample(content: string): { file: string; vars: { name: string; comment: string }[] } {
  const vars: { name: string; comment: string }[] = [];
  let lastComment = "";
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t) {
      lastComment = "";
      continue;
    }
    if (t.startsWith("#")) {
      lastComment = t.replace(/^#+\s*/, "");
      continue;
    }
    const kv = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (kv) vars.push({ name: kv[1], comment: lastComment });
  }
  return { file: ".env.example", vars };
}

/**
 * Snapshot fallback — when GitHub is unreachable (5xx bursts, rate-limit walls,
 * sandbox egress outages), rehydrate the most recent successful ingestion of
 * the same repo instead of failing the pipeline. A stale snapshot scores from
 * real data; a genuine 404 still fails loudly. Historical rows may predate a
 * RepoData field, so every field is coerced to the current schema.
 */
function coerceStrArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function sanitizeRepoSnapshot(raw: unknown, owner: string, repo: string): RepoData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const j = raw as Record<string, unknown>;
  // Reject mismatches — the row must belong to the requested repo.
  if (j.owner !== owner || j.repo !== repo) return null;
  const det = (typeof j.detected === "object" && j.detected !== null ? j.detected : {}) as Record<string, unknown>;
  return {
    owner: String(j.owner ?? owner),
    repo: String(j.repo ?? repo),
    url: String(j.url ?? `https://github.com/${owner}/${repo}`),
    description: typeof j.description === "string" ? j.description : "",
    topics: coerceStrArray(j.topics),
    stars: Number(j.stars ?? 0) || 0,
    forks: Number(j.forks ?? 0) || 0,
    watchers: Number(j.watchers ?? 0) || 0,
    openIssues: typeof j.openIssues === "number" ? j.openIssues : null,
    license:
      typeof j.license === "object" && j.license !== null
        ? (j.license as RepoData["license"])
        : null,
    defaultBranch: typeof j.defaultBranch === "string" ? j.defaultBranch : "main",
    createdAt: typeof j.createdAt === "string" ? j.createdAt : null,
    pushedAt: typeof j.pushedAt === "string" ? j.pushedAt : null,
    commitCount: typeof j.commitCount === "number" ? j.commitCount : null,
    releaseCount: typeof j.releaseCount === "number" ? j.releaseCount : null,
    homepage: typeof j.homepage === "string" ? j.homepage : null,
    commits: Array.isArray(j.commits) ? (j.commits as RepoData["commits"]) : [],
    contributors: Array.isArray(j.contributors) ? (j.contributors as RepoData["contributors"]) : [],
    rootFiles: coerceStrArray(j.rootFiles),
    githubFiles: coerceStrArray(j.githubFiles),
    ciWorkflows: coerceStrArray(j.ciWorkflows),
    hasTests: Boolean(j.hasTests),
    readme: typeof j.readme === "string" ? j.readme : null,
    readmeTruncated: Boolean(j.readmeTruncated),
    manifest:
      typeof j.manifest === "object" && j.manifest !== null
        ? (j.manifest as RepoData["manifest"])
        : null,
    envExample:
      typeof j.envExample === "object" && j.envExample !== null
        ? (j.envExample as RepoData["envExample"])
        : null,
    detected: {
      language: typeof det.language === "string" ? det.language : "Unknown",
      languages: coerceLangPcts(det.languages),
      frameworks: coerceStrArray(det.frameworks),
      databases: coerceStrArray(det.databases),
      tools: coerceStrArray(det.tools),
      packageManager: typeof det.packageManager === "string" ? det.packageManager : null,
      scripts:
        typeof det.scripts === "object" && det.scripts !== null
          ? (det.scripts as DetectedStack["scripts"])
          : {},
      dependencies:
        typeof det.dependencies === "object" && det.dependencies !== null
          ? (det.dependencies as DetectedStack["dependencies"])
          : {},
      devDependencies:
        typeof det.devDependencies === "object" && det.devDependencies !== null
          ? (det.devDependencies as DetectedStack["devDependencies"])
          : {},
    },
    source: "web-scrape",
    ingestedAt: new Date().toISOString(),
  };
}

async function loadRepoSnapshot(owner: string, repo: string): Promise<RepoData | null> {
  try {
    const row = await db.shipProject.findFirst({
      where: { owner, repo, status: "ready", repoJson: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!row?.repoJson) return null;
    const snap = sanitizeRepoSnapshot(JSON.parse(row.repoJson), owner, repo);
    if (!snap) return null;
    // The snapshot may predate later root-level scans; backfill what we can infer.
    if (!snap.githubFiles.length) {
      snap.githubFiles = snap.rootFiles
        .filter((f) => f.toLowerCase().startsWith(".github/"))
        .map((f) => f.slice(".github/".length));
    }
    if (!snap.ciWorkflows.length) {
      snap.ciWorkflows = snap.githubFiles.filter((f) => f.toLowerCase().startsWith("workflows/"));
    }
    return snap;
  } catch {
    return null;
  }
}

export async function ingestRepo(input: string): Promise<RepoData> {
  const { owner, repo, url } = normalizeRepoUrl(input);
  try {
    return await ingestRepoLive(url);
  } catch (err) {
    // 404 = the repo genuinely does not exist — never mask it with a snapshot.
    if (err instanceof RepoNotFoundError) throw err;
    const snap = await loadRepoSnapshot(owner, repo);
    if (snap) {
      console.warn(
        `[shipos] live ingestion of ${owner}/${repo} failed (${err instanceof Error ? err.message : err}) — using the last good snapshot`,
      );
      return snap;
    }
    throw err;
  }
}

async function ingestRepoLive(url: string): Promise<RepoData> {
  const { owner, repo } = normalizeRepoUrl(url);

  // 1. Repo overview page (metadata + license + counts)
  const meta = await scrapeRepoPage(owner, repo);
  const branch = meta.defaultBranch;

  // 2. Parallel: root tree, .github tree, workflows tree, commits (2 pages), REST enhancement
  const [rootTree, ghTree, wfTree, commitsP1, commitsP2, restRepo] = await Promise.all([
    scrapeTree(owner, repo, branch),
    scrapeTree(owner, repo, branch, ".github"),
    scrapeTree(owner, repo, branch, ".github/workflows"),
    scrapeCommits(owner, repo, branch, 1),
    scrapeCommits(owner, repo, branch, 2),
    tryRestApi(`/repos/${owner}/${repo}`),
  ]);

  const rootFiles = [...new Set([...rootTree.map((t) => t.name), ...meta.rootSpecialFiles])];
  const githubFiles = [...new Set(ghTree.map((t) => t.name))];

  // 3. Parallel raw fetches: manifests + README + .env.example
  const manifestName = rootTree.find((t) => t.name === "package.json") ? "package.json" : null;
  const readmeCandidates = meta.readmePath
    ? [meta.readmePath]
    : ["README.md", "readme.md", "Readme.md", "README.rst", "README.txt"];
  const envCandidate = rootFiles.find((f) => /^\.env\.(example|sample|template)$/i.test(f));

  const [manifestRaw, readmeRaw, envRaw, restLanguages] = await Promise.all([
    manifestName ? fetchRaw(owner, repo, branch, manifestName) : Promise.resolve(null),
    (async () => {
      for (const c of readmeCandidates) {
        const r = await fetchRaw(owner, repo, branch, c);
        if (r) return r;
      }
      return null;
    })(),
    envCandidate ? fetchRaw(owner, repo, branch, envCandidate) : Promise.resolve(null),
    tryRestApi(`/repos/${owner}/${repo}/languages`),
  ]);

  // Manifest
  let manifest: RepoManifest | null = null;
  if (manifestRaw) {
    try {
      const pkg = JSON.parse(manifestRaw) as Record<string, unknown>;
      manifest = {
        name: typeof pkg.name === "string" ? pkg.name : null,
        version: typeof pkg.version === "string" ? pkg.version : null,
        dependencies: (pkg.dependencies as Record<string, string>) ?? {},
        devDependencies: (pkg.devDependencies as Record<string, string>) ?? {},
        scripts: (pkg.scripts as Record<string, string>) ?? {},
        description: typeof pkg.description === "string" ? pkg.description : null,
        keywords: Array.isArray(pkg.keywords) ? (pkg.keywords as unknown[]).map(String).slice(0, 15) : [],
        licenseField: typeof pkg.license === "string" ? pkg.license : null,
        author: typeof pkg.author === "string" ? pkg.author : (pkg.author as { name?: string } | undefined)?.name ?? null,
        repository:
          typeof pkg.repository === "string"
            ? pkg.repository
            : ((pkg.repository as { url?: string } | undefined)?.url ?? null),
        bugs: typeof pkg.bugs === "string" ? pkg.bugs : ((pkg.bugs as { url?: string } | undefined)?.url ?? null),
        homepage: typeof pkg.homepage === "string" ? pkg.homepage : null,
        type: typeof pkg.type === "string" ? pkg.type : null,
      };
    } catch {
      manifest = null;
    }
  }

  // Python/Go/Rust manifests when package.json absent
  if (!manifest) {
    if (rootFiles.includes("requirements.txt")) {
      const req = await fetchRaw(owner, repo, branch, "requirements.txt");
      if (req) {
        const deps: Record<string, string> = {};
        for (const line of req.split("\n")) {
          const t = line.trim();
          if (!t || t.startsWith("#") || t.startsWith("-")) continue;
          const parts = t.split(/[=><~!]/);
          if (parts[0]) deps[parts[0].trim()] = parts.slice(1).join("") || "*";
        }
        manifest = { name: repo, version: null, dependencies: deps, devDependencies: {}, scripts: {} };
      }
    } else if (rootFiles.includes("go.mod")) {
      const gomod = await fetchRaw(owner, repo, branch, "go.mod");
      if (gomod) {
        const moduleName = gomod.match(/^module\s+(\S+)/m)?.[1] ?? null;
        manifest = { name: moduleName ?? repo, version: null, dependencies: {}, devDependencies: {}, scripts: {} };
      }
    } else if (rootFiles.includes("Cargo.toml")) {
      const cargo = await fetchRaw(owner, repo, branch, "Cargo.toml");
      if (cargo) {
        const name = cargo.match(/^name\s*=\s*"([^"]+)"/m)?.[1] ?? repo;
        const version = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null;
        manifest = { name, version, dependencies: {}, devDependencies: {}, scripts: {} };
      }
    }
  }

  const commits: RepoCommit[] = [...commitsP1, ...commitsP2]
    .filter((c) => c.sha)
    .map((c) => ({ sha: c.sha, message: c.message, type: classifyCommit(c.message), author: c.author, date: c.date }));

  // Contributors from commit author frequency (real, from ingested commits)
  const authorCounts = new Map<string, number>();
  for (const c of commits) authorCounts.set(c.author, (authorCounts.get(c.author) ?? 0) + 1);
  const contributors = [...authorCounts.entries()]
    .map(([login, count]) => ({ login, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const ciWorkflows = wfTree.filter((t) => t.type === "file" && /\.(yml|yaml)$/.test(t.name)).map((t) => t.name);

  const hasTests =
    rootTree.some((t) => /^(test|tests|__tests__|spec|e2e)$/i.test(t.name) && t.type === "dir") ||
    Object.keys(manifest?.scripts ?? {}).some((s) => /^test/.test(s)) ||
    Object.keys({ ...(manifest?.dependencies ?? {}), ...(manifest?.devDependencies ?? {}) }).some((d) =>
      TEST_DEPS.includes(d.toLowerCase())
    );

  // REST API languages (higher fidelity) when token present
  let languages = detectStack(manifest, rootFiles, readmeRaw).languages;
  if (restLanguages) {
    const entries = Object.entries(restLanguages).filter(([, v]) => typeof v === "number") as [string, number][];
    const total = entries.reduce((s, [, b]) => s + b, 0);
    if (total > 0 && entries.length > 0) {
      languages = entries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, bytes]) => ({ name, pct: Math.max(1, Math.round((bytes / total) * 100)) }));
    }
  }

  const detected = detectStack(manifest, rootFiles, readmeRaw);
  detected.languages = languages;
  detected.language = languages[0]?.name ?? "Unknown";

  const dates = commits.map((c) => new Date(c.date).getTime()).filter((n) => !Number.isNaN(n));

  return {
    owner,
    repo,
    url,
    description: meta.description,
    topics: meta.topics,
    stars: restRepo ? Number(restRepo.stargazers_count ?? meta.stars) || meta.stars : meta.stars,
    forks: restRepo ? Number(restRepo.forks_count ?? meta.forks) || meta.forks : meta.forks,
    watchers: meta.watchers,
    openIssues: restRepo ? Number(restRepo.open_issues_count ?? 0) || null : null,
    license: meta.license,
    defaultBranch: branch,
    createdAt: restRepo ? String(restRepo.created_at ?? "") || null : null,
    pushedAt: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    commitCount: meta.commitCount,
    releaseCount: meta.releaseCount,
    homepage: meta.homepage,
    commits,
    contributors,
    rootFiles,
    githubFiles,
    ciWorkflows,
    hasTests,
    readme: readmeRaw ? readmeRaw.slice(0, 60_000) : null,
    readmeTruncated: !!readmeRaw && readmeRaw.length > 60_000,
    manifest,
    envExample: envRaw ? parseEnvExample(envRaw) : null,
    detected,
    source: restRepo ? "github-api" : "web-scrape",
    ingestedAt: new Date().toISOString(),
  };
}

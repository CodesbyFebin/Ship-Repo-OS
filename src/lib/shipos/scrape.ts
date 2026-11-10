// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — CLAW 1: The Ingestion & Parsing Claw ("The Eyes")
// Live GitHub ingestion without authentication:
//   1. repo page embeddedData  → metadata (stars, forks, license, topics…)
//   2. tree pages              → real root files + .github/workflows listing
//   3. commits pages           → real commits with hashes, dates, authors
//   4. raw.githubusercontent   → package.json / manifests / README / .env.example
// Enhances with the REST API when a GITHUB_TOKEN is configured.
// ─────────────────────────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export class RepoNotFoundError extends Error {
  constructor(public repoUrl: string) {
    super(`Repository not found or private: ${repoUrl}`);
    this.name = "RepoNotFoundError";
  }
}

export class IngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestionError";
  }
}

// Transient upstream failures (GitHub 502/503/504 bursts, rate-limit 429s) are
// common — the ingestion claw retries them with exponential backoff + jitter
// instead of failing a whole pipeline on the first blip.
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(
  url: string,
  timeoutMs = 15000,
  retries = 2,
): Promise<{ status: number; body: string }> {
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      const body = await res.text();
      if (res.ok || !TRANSIENT_STATUS.has(res.status) || attempt === retries) {
        return { status: res.status, body };
      }
      lastStatus = res.status;
      lastBody = body;
    } catch (err) {
      // Timeouts and connection resets are transient too — retry unless out of attempts.
      if (attempt === retries) {
        throw new IngestionError(
          `Network failure reaching ${url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    await sleep(600 * 2 ** attempt + Math.floor(Math.random() * 300));
  }
  return { status: lastStatus, body: lastBody };
}

/** Fetch an embedded JSON payload from any github.com page (react-app.embeddedData). */
function extractEmbeddedPayload(html: string): Record<string, unknown> | null {
  const m = html.match(
    /<script type="application\/json" data-target="react-app\.embeddedData">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type Json = unknown;

/** Deep-search a JSON structure with a predicate. */
function deepFind(node: Json, pred: (v: Record<string, unknown>) => boolean, depth = 0): Record<string, unknown> | null {
  if (depth > 24 || node == null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = deepFind(item, pred, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (pred(obj)) return obj;
    for (const v of Object.values(obj)) {
      const hit = deepFind(v, pred, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function deepFindAll(node: Json, pred: (v: Record<string, unknown>) => boolean, out: Record<string, unknown>[] = [], depth = 0): Record<string, unknown>[] {
  if (depth > 24 || node == null) return out;
  if (Array.isArray(node)) {
    for (const item of node) deepFindAll(item, pred, out, depth + 1);
    return out;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (pred(obj)) out.push(obj);
    for (const v of Object.values(obj)) deepFindAll(v, pred, out, depth + 1);
  }
  return out;
}

export interface ScrapedMeta {
  description: string;
  topics: string[];
  stars: number;
  forks: number;
  watchers: number;
  license: { spdx: string; name: string } | null;
  defaultBranch: string;
  commitCount: number | null;
  releaseCount: number | null;
  homepage: string | null;
  readmePath: string | null;
  rootSpecialFiles: string[];
}

/** Parse github.com/{owner}/{repo} — the overview page. */
export async function scrapeRepoPage(owner: string, repo: string): Promise<ScrapedMeta> {
  const url = `https://github.com/${owner}/${repo}`;
  const { status, body } = await fetchText(url);
  if (status === 404) throw new RepoNotFoundError(url);
  if (status !== 200) throw new IngestionError(`GitHub returned HTTP ${status} for ${url}`);

  const payload = extractEmbeddedPayload(body);
  const meta: ScrapedMeta = {
    description: "",
    topics: [],
    stars: 0,
    forks: 0,
    watchers: 0,
    license: null,
    defaultBranch: "main",
    commitCount: null,
    releaseCount: null,
    homepage: null,
    readmePath: null,
    rootSpecialFiles: [],
  };

  if (payload) {
    const sidebar = deepFind(payload, (o) => "stargazerCount" in o && "forksCount" in o);
    if (sidebar) {
      meta.description = typeof sidebar.description === "string" ? sidebar.description : "";
      meta.stars = Number(sidebar.stargazerCount ?? 0) || 0;
      meta.forks = Number(sidebar.forksCount ?? 0) || 0;
      meta.watchers = Number(sidebar.watcherCount ?? 0) || 0;
      meta.topics = Array.isArray(sidebar.topics)
        ? (sidebar.topics as Record<string, unknown>[]).map((t) => String(t.name ?? t)).filter(Boolean)
        : [];
      const repoObj = sidebar.repo as Record<string, unknown> | undefined;
      const lic = (repoObj?.license ?? (sidebar as Record<string, unknown>).license) as Record<string, unknown> | undefined;
      if (lic && lic.spdxId && lic.spdxId !== "NOASSERTION") {
        meta.license = { spdx: String(lic.spdxId), name: String(lic.name ?? lic.spdxId) };
      }
      meta.homepage = typeof sidebar.website === "string" && sidebar.website ? sidebar.website : null;
    }
    const overview = deepFind(payload, (o) => "commitCount" in o && "overviewFiles" in o);
    if (overview) {
      meta.commitCount = Number(overview.commitCount ?? 0) || null;
      const files = Array.isArray(overview.overviewFiles) ? overview.overviewFiles : [];
      for (const f of files as Record<string, unknown>[]) {
        const p = String(f.path ?? "").toLowerCase();
        if (p.endsWith("readme.md") || p.endsWith("readme.rst") || p === "readme") meta.readmePath = String(f.path ?? "README.md");
        else if (p) meta.rootSpecialFiles.push(String(f.path));
      }
    }
    const rel = deepFind(payload, (o) => "releaseCount" in o && "tagCount" in o);
    if (rel) meta.releaseCount = Number(rel.releaseCount ?? 0) || null;
  }

  // Fallbacks from raw HTML
  const branchMatch = body.match(/"defaultBranch":"([^"]+)"/);
  if (branchMatch) meta.defaultBranch = branchMatch[1];
  if (!meta.description) {
    const og = body.match(/<meta property="og:description" content="([^"]*)"/);
    if (og) meta.description = og[1].replace(/ - \d+ stars.*$/, "").trim();
  }
  if (!meta.stars) {
    const stars = body.match(/([\d.,kKmM]+)\s*stars/);
    if (stars) meta.stars = parseCount(stars[1]);
  }
  if (meta.topics.length === 0) {
    const tps = deepFindAll(payload ?? {}, (o) => Array.isArray(o.topics) && (o.topics as unknown[]).length > 0);
    for (const t of tps) {
      meta.topics = (t.topics as Record<string, unknown>[]).map((x) => String(x.name ?? x));
      if (meta.topics.length) break;
    }
  }
  return meta;
}

export interface ScrapedTreeItem {
  name: string;
  type: "file" | "dir";
}

/** Parse github.com/{owner}/{repo}/tree/{branch}[/{path}] — a real directory listing. */
export async function scrapeTree(owner: string, repo: string, branch: string, path = ""): Promise<ScrapedTreeItem[]> {
  const url = `https://github.com/${owner}/${repo}/tree/${branch}${path ? `/${path}` : ""}`;
  try {
    const { status, body } = await fetchText(url);
    if (status !== 200) return [];
    const payload = extractEmbeddedPayload(body);
    if (!payload) return [];
    const container = deepFind(
      payload,
      (o) => Array.isArray(o.items) && o.items.length > 0 && typeof (o.items as Record<string, unknown>[])[0]?.name === "string"
    );
    if (!container) return [];
    return (container.items as Record<string, unknown>[]).map((it) => ({
      name: String(it.name ?? ""),
      type: it.contentType === "directory" ? "dir" : "file",
    }));
  } catch {
    return [];
  }
}

export interface ScrapedCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

/** Parse github.com/{owner}/{repo}/commits/{branch}?page=N — real commits. */
export async function scrapeCommits(owner: string, repo: string, branch: string, page = 1): Promise<ScrapedCommit[]> {
  const url = `https://github.com/${owner}/${repo}/commits/${branch}?page=${page}`;
  try {
    const { status, body } = await fetchText(url);
    if (status !== 200) return [];
    const payload = extractEmbeddedPayload(body);
    if (!payload) return [];
    const groups = deepFindAll(payload, (o) => Array.isArray(o.commits) && o.commits.length > 0);
    const commits: ScrapedCommit[] = [];
    const seen = new Set<string>();
    for (const g of groups) {
      for (const c of g.commits as Record<string, unknown>[]) {
        const sha = String(c.oid ?? "");
        if (!sha || seen.has(sha)) continue;
        seen.add(sha);
        const authorObj = (c.author ?? {}) as Record<string, unknown>;
        commits.push({
          sha,
          message: String(c.shortMessage ?? c.message ?? "").split("\n")[0],
          author: String(authorObj.login ?? authorObj.name ?? "unknown"),
          date: String(c.committedDate ?? c.authoredDate ?? new Date().toISOString()),
        });
      }
    }
    return commits;
  } catch {
    return [];
  }
}

/** Fetch a raw file from raw.githubusercontent.com — null when missing. */
export async function fetchRaw(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
  try {
    const { status, body } = await fetchText(
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path.replace(/^\/+/, "")}`,
      12000
    );
    if (status === 200 && body.length < 2_000_000) return body;
    return null;
  } catch {
    return null;
  }
}

function parseCount(s: string): number {
  const n = s.toLowerCase().replace(/,/g, "");
  if (n.endsWith("k")) return Math.round(parseFloat(n) * 1000);
  if (n.endsWith("m")) return Math.round(parseFloat(n) * 1000000);
  return parseInt(parseFloat(n).toFixed(0), 10) || 0;
}

/** Optional REST API enhancement when GITHUB_TOKEN is set. Returns null on any failure. */
export async function tryRestApi(path: string): Promise<Record<string, unknown> | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ShipOS",
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

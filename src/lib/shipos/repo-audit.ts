// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Full Repo Auditor: deterministic 100-point engine.
// 5 weighted categories · 50 checks · zero LLM guessing.
//   Documentation 25 · Code Quality 25 · Security 20 · DevOps 15 · Community 15
// Every failed check maps to a fix (fixes.ts) with FULL copy-paste code,
// so the composer can rank fixes into a guaranteed path to 100/100.
// Strictness modes (lenient/balanced/strict) shift thresholds, never the rubric.
// ─────────────────────────────────────────────────────────────────────────────
import type { RepoData } from "./types";
import type { AuditRisk, CodeFix, RepoAudit, RepoAuditCategory, RepoAuditCheck, RoadmapStep, Strictness } from "./audit-types";
import { DEFAULT_STRICTNESS, FIX_PRIORITY_ORDER, gradeFor, percentileFor, RISK_SEVERITY_ORDER, repoTier } from "./audit-types";
import { countWords } from "./generators";
import { FIX_BUILDERS, FIX_META, testCmdFor, installCmd, suggestedKeywords, type FixContext, type LinterKind } from "./fixes";

/** Extra probes fetched by the pipeline before scoring. */
export interface AuditScan {
  workflowContents: { name: string; content: string }[];
  raws: Record<string, string>; // e.g. pyproject.toml / Cargo.toml content when no package.json
}

const TEST_IN_CI_RE = /\b(npm|yarn|pnpm|bun)\s+(run\s+)?test\b|\bpytest\b|\bgo\s+test\b|\bcargo\s+test\b|\bvitest\b|\bjest\b|\bmvn\s+test\b|\bgradle\s+test\b|\bmake\s+test\b/i;
const LINT_IN_CI_RE = /\blint\b|\beslint\b|\bruff\b|\bgolangci\b|\bclippy\b|\bcargo\s+fmt\b|\bprettier\b|\bbiome\b|\bstylelint\b|\bformat\b|--check\b/i;
const COVERAGE_RE = /codecov|coverage|coverprofile|tarpaulin|--cov\b/i;
const CACHE_IN_CI_RE = /actions\/cache|setup-node[\s\S]{0,400}cache:|setup-python[\s\S]{0,400}cache:|setup-go[\s\S]{0,400}cache:|gradle\/actions\/setup-gradle[\s\S]{0,200}cache|pnpm\/action-setup|swatinem\/rust-cache/i;
const MATRIX_IN_CI_RE = /matrix\s*:/i;
const PINNED_ACTION_RE = /uses:\s*\S+@(?!\$)[^\s]+/;
const MASTER_REF_RE = /uses:\s*\S+@(master|main)\b/i;
const PERMISSIONS_RE = /^[\s-]*permissions\s*:/im;
const SECRET_FILE_RE = /^\.env$|^\.env\.local$|^\.env\.production$|credentials\.json$|\.pem$|_rsa$|\.p12$|secret[s]?\.txt$/i;
const SECRET_PATTERN_RE = /(sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|xox[bp]-[A-Za-z0-9-]{10,}|AIzaSy[A-Za-z0-9_-]{33}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const STRICT_TS_RE = /"strict"\s*:\s*true/;

// ── Thresholds by strictness ─────────────────────────────────────────────────

interface Thresholds {
  readmeWords: number;
  manifestMissingTolerance: number; // 0 = every field required
  badgeRows: number;
}

function thresholdsFor(strictness: Strictness): Thresholds {
  if (strictness === "lenient") return { readmeWords: 350, manifestMissingTolerance: 2, badgeRows: 2 };
  if (strictness === "strict") return { readmeWords: 900, manifestMissingTolerance: 0, badgeRows: 4 };
  return { readmeWords: 600, manifestMissingTolerance: 1, badgeRows: 3 };
}

// ── Detection helpers ────────────────────────────────────────────────────────

function rootHas(repo: RepoData, re: RegExp): boolean {
  return repo.rootFiles.some((f) => re.test(f));
}

function ghOrRootHas(repo: RepoData, re: RegExp): boolean {
  return repo.rootFiles.some((f) => re.test(f)) || repo.githubFiles.some((f) => re.test(f));
}

function detectLinter(repo: RepoData): LinterKind | null {
  const root = repo.rootFiles.map((f) => f.toLowerCase());
  if (root.some((f) => f === "biome.json" || f === "biome.jsonc")) return "biome";
  if (root.some((f) => /^eslint\.config\./.test(f) || /^\.eslintrc/.test(f))) return "eslint";
  if (root.some((f) => f.startsWith(".prettierrc") || f === "prettier.config.js" || f === "prettier.config.mjs")) return "prettier";
  if (root.some((f) => f === "ruff.toml" || f === ".ruff.toml")) return "ruff";
  if (root.some((f) => f === ".flake8" || (f === "setup.cfg" && true))) return "flake8";
  if (root.some((f) => f === ".golangci.yml" || f === ".golangci.yaml")) return "golangci";
  if (root.some((f) => f === "rustfmt.toml" || f === ".rustfmt.toml")) return "rustfmt";
  if (root.includes(".editorconfig")) return "editorconfig";
  return null;
}

function lockfileCheck(repo: RepoData): { pass: boolean; detail: string } {
  const files = repo.rootFiles.map((f) => f.toLowerCase());
  const found: string[] = [];
  if (files.includes("package-lock.json")) found.push("package-lock.json");
  if (files.includes("pnpm-lock.yaml")) found.push("pnpm-lock.yaml");
  if (files.includes("yarn.lock")) found.push("yarn.lock");
  if (files.includes("bun.lockb") || files.includes("bun.lock")) found.push("bun.lock");
  if (files.includes("poetry.lock")) found.push("poetry.lock");
  if (files.includes("uv.lock")) found.push("uv.lock");
  if (files.includes("pipfile.lock")) found.push("Pipfile.lock");
  if (files.includes("go.sum")) found.push("go.sum");
  if (files.includes("cargo.lock")) found.push("Cargo.lock");
  if (files.includes("composer.lock")) found.push("composer.lock");
  if (found.length) return { pass: true, detail: `lockfile committed: ${found.join(", ")}` };
  const offline = repo.offline;
  if (offline) return { pass: false, detail: "no lockfile in the pasted file list" };
  if (files.includes("pyproject.toml") || files.includes("requirements.txt")) {
    return { pass: false, detail: "Python project without a lockfile (pip-compile / poetry.lock / uv.lock)" };
  }
  if (files.includes("package.json")) return { pass: false, detail: "package.json without a committed lockfile — installs are not reproducible" };
  return { pass: true, detail: "n/a — no package manifest that requires a lockfile" };
}

function hasTestSuite(repo: RepoData): { pass: boolean; detail: string } {
  const dirs = repo.rootFiles.filter((f) => /^(tests?|__tests__|spec|e2e)$/i.test(f));
  const deps = Object.keys({ ...(repo.manifest?.dependencies ?? {}), ...(repo.manifest?.devDependencies ?? {}) });
  const testDeps = deps.filter((d) =>
    ["jest", "vitest", "mocha", "pytest", "cypress", "playwright", "@playwright/test", "karma", "ava", "node:test", "unittest"].includes(d.toLowerCase())
  );
  const cfg = repo.rootFiles.filter((f) =>
    /^(jest\.config|vitest\.config|playwright\.config|cypress\.config|pytest\.ini|tox\.ini|conftest\.py|karma\.conf)/i.test(f)
  );
  const treeTests = repo.offline && repo.rootFiles.some((f) => /\.(test|spec)\.[tj]sx?$|_test\.(go|py)$|test_.*\.py$/i.test(f));
  const parts: string[] = [];
  if (dirs.length) parts.push(`directory: ${dirs.join(", ")}`);
  if (testDeps.length) parts.push(`dependencies: ${testDeps.join(", ")}`);
  if (cfg.length) parts.push(`config: ${cfg.join(", ")}`);
  if (treeTests) parts.push("test-suffixed files in the tree");
  return { pass: parts.length > 0 || repo.hasTests, detail: parts.length ? parts.join(" · ") : "no test directory, dependency or config detected" };
}

function testScriptCheck(repo: RepoData): { pass: boolean; detail: string } {
  const t = repo.manifest?.scripts?.test;
  if (t) {
    const real = !/^echo/i.test(t.trim()) && !/Error: no test specified/i.test(t);
    return { pass: real, detail: real ? `scripts.test → "${t.slice(0, 60)}"` : "scripts.test is the npm placeholder" };
  }
  const root = repo.rootFiles.map((f) => f.toLowerCase());
  if (root.includes("go.mod")) return { pass: true, detail: "go test built into the toolchain" };
  if (root.includes("cargo.toml")) return { pass: true, detail: "cargo test built into the toolchain" };
  if (root.includes("pytest.ini") || root.includes("tox.ini") || root.includes("conftest.py")) {
    return { pass: true, detail: "pytest configured at the root" };
  }
  return { pass: false, detail: "no discoverable test command" };
}

function metadataCheck(repo: RepoData, scan: AuditScan, th: Thresholds): { pass: boolean; detail: string; na?: boolean } {
  const m = repo.manifest;
  if (m) {
    const missing: string[] = [];
    if (!m.name) missing.push("name");
    if (!m.description) missing.push("description");
    if (!m.version) missing.push("version");
    if (!m.keywords || m.keywords.length < 3) missing.push("keywords (≥3)");
    if (!m.licenseField) missing.push("license");
    if (!m.repository) missing.push("repository");
    if (!m.author) missing.push("author");
    if (!m.bugs) missing.push("bugs");
    if (missing.length === 0) return { pass: true, detail: "all manifest fields present" };
    return { pass: missing.length <= th.manifestMissingTolerance, detail: `missing: ${missing.join(", ")}` };
  }
  // Non-node manifests
  const pyproject = scan.raws["pyproject.toml"];
  if (pyproject) {
    const hasProject = /^\[project\]/m.test(pyproject);
    const hasName = /^name\s*=\s*"(.+)"/m.test(pyproject);
    const hasDesc = /^description\s*=\s*"(.+)"/m.test(pyproject);
    const ok = hasProject && hasName && hasDesc;
    return { pass: ok, detail: ok ? "pyproject [project] metadata present" : "pyproject missing [project] name/description" };
  }
  const cargo = scan.raws["Cargo.toml"];
  if (cargo) {
    const hasName = /^name\s*=\s*"(.+)"/m.test(cargo);
    const hasDesc = /^description\s*=\s*"(.+)"/m.test(cargo);
    const hasLicense = /^license\s*=\s*"(.+)"/m.test(cargo);
    const ok = hasName && hasDesc && hasLicense;
    return { pass: ok, detail: ok ? "Cargo [package] metadata present" : "Cargo.toml missing description/license" };
  }
  if (repo.rootFiles.map((f) => f.toLowerCase()).includes("go.mod")) {
    return { pass: true, detail: "go.mod module declared (Go manifests carry no extra metadata)" };
  }
  if (repo.offline) return { pass: true, detail: "n/a — offline mode cannot read manifest contents", na: true };
  return { pass: false, detail: "no manifest metadata found" };
}

// ── README section probes ────────────────────────────────────────────────────

function readmeHas(repo: RepoData, re: RegExp): boolean {
  return !!repo.readme && re.test(repo.readme);
}

function countBadgeRows(md: string): number {
  const badge = /(\[!\[[^\]]*\]\([^)]*\)\]|\[!\[[^\]]*\]\()[^\n]*/g;
  const lines = new Set<string>();
  for (const m of md.matchAll(badge)) lines.add(m[0].trim());
  return lines.size;
}

// ── The rubric: 5 weighted categories · 50 checks · exactly 100 points ───────

interface CheckDef {
  id: string;
  label: string;
  weight: number;
  fixId: string; // fix that resolves this check when failed
  test: (repo: RepoData, scan: AuditScan, th: Thresholds) => { pass: boolean; detail: string; na?: boolean };
}

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  checks: CheckDef[];
}

const RUBRIC: CategoryDef[] = [
  {
    id: "docs",
    name: "Documentation",
    icon: "FileText",
    checks: [
      {
        id: "doc-readme",
        label: "README exists",
        weight: 3,
        fixId: "readme-scaffold",
        test: (repo) => {
          const pass = !!(repo.readme && repo.readme.trim().length > 0);
          return { pass, detail: pass ? `README found (${countWords(repo.readme!)} words)` : "no README file in the repository" };
        },
      },
      {
        id: "doc-depth",
        label: "README depth",
        weight: 3,
        fixId: "readme-upgrade",
        test: (repo, _scan, th) => {
          const words = repo.readme ? countWords(repo.readme) : 0;
          return { pass: words >= th.readmeWords, detail: repo.readme ? `${words}/${th.readmeWords} words` : "no README to measure" };
        },
      },
      {
        id: "doc-install",
        label: "Install steps in README",
        weight: 1.5,
        fixId: "readme-upgrade",
        test: (repo) => ({
          pass: readmeHas(repo, /^#{1,3}[^\n]*(install|getting started|setup|quick ?start)/im),
          detail: readmeHas(repo, /^#{1,3}[^\n]*(install|getting started|setup|quick ?start)/im) ? "install section found" : "no install section — users don't know how to start",
        }),
      },
      {
        id: "doc-usage",
        label: "Usage examples in README",
        weight: 1.5,
        fixId: "readme-upgrade",
        test: (repo) => ({
          pass: readmeHas(repo, /^#{1,3}[^\n]*(usage|example|quick ?start)/im) && /```/.test(repo.readme ?? ""),
          detail: readmeHas(repo, /```/) ? "usage section with code examples" : "no usage section with runnable code",
        }),
      },
      {
        id: "doc-toc",
        label: "Table of contents",
        weight: 1,
        fixId: "readme-upgrade",
        test: (repo) => {
          const pass = readmeHas(repo, /^#{1,3}[^\n]*(table of contents|contents)\b/im) || (repo.readme?.match(/^\s*[-*] \[[^\]]+\]\(/gm)?.length ?? 0) >= 3;
          return { pass, detail: pass ? "TOC found" : "no table of contents for long READMEs" };
        },
      },
      {
        id: "doc-badges",
        label: "README badge row",
        weight: 3,
        fixId: "readme-upgrade",
        test: (repo, _scan, th) => {
          const n = repo.readme ? countBadgeRows(repo.readme) : 0;
          return { pass: n >= th.badgeRows, detail: `${n} badge(s) found · target ≥ ${th.badgeRows}` };
        },
      },
      {
        id: "doc-license",
        label: "License declared",
        weight: 3,
        fixId: "license-file",
        test: (repo) => {
          const file = rootHas(repo, /^licen[cs]e/i);
          const meta = !repo.offline && repo.license != null;
          return {
            pass: file || meta,
            detail: meta ? `${repo.license!.spdx} (detected by GitHub)` : file ? "LICENSE file at root" : repo.offline ? "no LICENSE file in the pasted list" : "no license file or metadata",
          };
        },
      },
      {
        id: "doc-contributing",
        label: "CONTRIBUTING.md",
        weight: 2,
        fixId: "contributing-file",
        test: (repo) => {
          const pass = ghOrRootHas(repo, /^contributing(\.|-|$)/i);
          return { pass, detail: pass ? "contributing guide found" : "no CONTRIBUTING.md — first-time contributors have no map" };
        },
      },
      {
        id: "doc-changelog",
        label: "CHANGELOG.md",
        weight: 1.5,
        fixId: "changelog-file",
        test: (repo) => {
          const pass = rootHas(repo, /^changelog(\.|$)/i);
          return { pass, detail: pass ? "changelog found" : "no changelog — users upgrade blind" };
        },
      },
      {
        id: "doc-coc",
        label: "Code of Conduct",
        weight: 1.5,
        fixId: "code-of-conduct",
        test: (repo) => {
          const pass = ghOrRootHas(repo, /code_of_conduct/i);
          return { pass, detail: pass ? "code of conduct found" : "no code of conduct" };
        },
      },
      {
        id: "doc-env-example",
        label: ".env.example",
        weight: 1.5,
        fixId: "env-example",
        test: (repo) => {
          const pass = rootHas(repo, /^\.env\.example$/i) || rootHas(repo, /^\.env\.sample$/i) || rootHas(repo, /^\.env\.template$/i);
          return { pass, detail: pass ? ".env.example found" : repo.offline ? "no .env.example in the pasted list" : "no .env.example — setup requires guesswork" };
        },
      },
      {
        id: "doc-folder",
        label: "docs/ folder",
        weight: 1,
        fixId: "docs-folder",
        test: (repo) => {
          const pass = rootHas(repo, /^docs?$/i) || rootHas(repo, /^docs?\//i);
          return { pass, detail: pass ? "docs/ directory found" : "no docs/ directory for long-form material" };
        },
      },
      {
        id: "doc-troubleshooting",
        label: "Troubleshooting / FAQ",
        weight: 1.5,
        fixId: "readme-upgrade",
        test: (repo) => ({
          pass: readmeHas(repo, /^#{1,3}[^\n]*(troubleshooting|faq|common issues|known issues)/im),
          detail: readmeHas(repo, /^#{1,3}[^\n]*(troubleshooting|faq|common issues|known issues)/im) ? "troubleshooting/FAQ found" : "no troubleshooting or FAQ section",
        }),
      },
    ],
  },
  {
    id: "quality",
    name: "Code Quality",
    icon: "Gauge",
    checks: [
      {
        id: "qa-linter",
        label: "Linter/formatter config",
        weight: 3,
        fixId: "lint-config",
        test: (repo) => {
          const linter = detectLinter(repo);
          return { pass: !!linter, detail: linter ? `${linter} configured` : "no linter/formatter config — style is luck" };
        },
      },
      {
        id: "qa-typing",
        label: "Type checking",
        weight: 3,
        fixId: "typing-config",
        test: (repo) => {
          const root = repo.rootFiles.map((f) => f.toLowerCase());
          if (root.includes("tsconfig.json")) return { pass: true, detail: "tsconfig.json present" };
          if (root.includes("jsconfig.json")) return { pass: true, detail: "jsconfig.json present" };
          if (root.includes("mypy.ini") || root.includes("pyrightconfig.json") || root.includes("py.typed")) {
            return { pass: true, detail: "Python type checking configured" };
          }
          if (root.includes("go.mod")) return { pass: true, detail: "Go is statically typed" };
          if (root.includes("cargo.toml")) return { pass: true, detail: "Rust is statically typed" };
          const langs = repo.detected.languages.map((l) => l.name.toLowerCase()).join(" ");
          if (/go|rust|java|c\+\+|kotlin|swift/.test(langs)) return { pass: true, detail: "compiled/typed language" };
          return { pass: false, detail: "no type checking configured" };
        },
      },
      {
        id: "qa-ts-strict",
        label: "TypeScript strict mode",
        weight: 1,
        fixId: "typing-config",
        test: (repo) => {
          const root = repo.rootFiles.map((f) => f.toLowerCase());
          if (!root.includes("tsconfig.json")) {
            if (root.includes("go.mod") || root.includes("cargo.toml")) return { pass: true, detail: "n/a — statically typed toolchain", na: true };
            return { pass: true, detail: "n/a — no TypeScript in this repo", na: true };
          }
          if (repo.offline) return { pass: true, detail: "n/a — offline mode cannot read tsconfig.json", na: true };
          if (repo.tsconfigRaw === null || repo.tsconfigRaw === undefined) return { pass: true, detail: "tsconfig.json present (content not probeable)", na: true };
          const strict = STRICT_TS_RE.test(repo.tsconfigRaw);
          return { pass: strict, detail: strict ? `"strict": true` : `tsconfig.json lacks "strict": true` };
        },
      },
      {
        id: "qa-metadata",
        label: "Manifest metadata complete",
        weight: 3,
        fixId: "metadata-patch",
        test: (repo, scan, th) => metadataCheck(repo, scan, th),
      },
      {
        id: "qa-tests",
        label: "Test suite detected",
        weight: 4,
        fixId: "test-setup",
        test: (repo) => hasTestSuite(repo),
      },
      {
        id: "qa-test-script",
        label: "Test command discoverable",
        weight: 2,
        fixId: "test-script",
        test: (repo) => testScriptCheck(repo),
      },
      {
        id: "qa-coverage",
        label: "Coverage tooling",
        weight: 2,
        fixId: "coverage",
        test: (repo, scan) => {
          const cfg = rootHas(repo, /^(codecov\.yml|\.coveragerc|coverage\.config)$/i);
          const inCi = scan.workflowContents.some((w) => COVERAGE_RE.test(w.content));
          const inScripts = Object.values(repo.manifest?.scripts ?? {}).some((s) => /coverage/i.test(s));
          return {
            pass: cfg || inCi || inScripts,
            detail: cfg ? "coverage config found" : inCi ? "coverage step in CI" : inScripts ? "coverage script in manifest" : "no coverage measurement",
          };
        },
      },
      {
        id: "qa-lockfile",
        label: "Lockfile committed",
        weight: 2,
        fixId: "lockfile-guidance",
        test: (repo) => lockfileCheck(repo),
      },
      {
        id: "qa-gitignore",
        label: ".gitignore present",
        weight: 2,
        fixId: "gitignore",
        test: (repo) => {
          const pass = rootHas(repo, /^\.gitignore$/i);
          return { pass, detail: pass ? ".gitignore found" : "no .gitignore — artifacts and secrets can leak into commits" };
        },
      },
      {
        id: "qa-examples",
        label: "Examples / live demo",
        weight: 2,
        fixId: "examples-starter",
        test: (repo) => {
          const dir = rootHas(repo, /^(examples?|demos?|playground)$/i);
          const live = !!repo.homepage;
          return {
            pass: dir || live,
            detail: dir ? "examples directory found" : live ? `live demo: ${repo.homepage!.slice(0, 48)}` : "no examples or demo link",
          };
        },
      },
      {
        id: "qa-editorconfig",
        label: ".editorconfig",
        weight: 0.5,
        fixId: "editorconfig",
        test: (repo) => {
          const pass = rootHas(repo, /^\.editorconfig$/i);
          return { pass, detail: pass ? ".editorconfig found" : "no .editorconfig — editors fight over tabs/spaces" };
        },
      },
      {
        id: "qa-node-version",
        label: "Node version pinned",
        weight: 0.5,
        fixId: "node-version",
        test: (repo) => {
          const root = repo.rootFiles.map((f) => f.toLowerCase());
          const isNode = !!repo.manifest || root.includes("package.json");
          if (!isNode) return { pass: true, detail: "n/a — not a Node project", na: true };
          const pass = root.includes(".nvmrc") || root.includes(".node-version");
          return {
            pass,
            detail: pass ? "node version file found" : "no .nvmrc/.node-version — contributors guess the runtime version",
          };
        },
      },
    ],
  },
  {
    id: "security",
    name: "Security",
    icon: "ShieldCheck",
    checks: [
      {
        id: "sec-security-md",
        label: "SECURITY.md policy",
        weight: 3,
        fixId: "security-policy",
        test: (repo) => {
          const pass = ghOrRootHas(repo, /^security(\.md|$)/i);
          return { pass, detail: pass ? "SECURITY.md found" : "no security policy — disclosures land in public issues" };
        },
      },
      {
        id: "sec-secrets",
        label: "No committed secrets",
        weight: 4,
        fixId: "secrets-cleanup",
        test: (repo) => {
          const leakedFiles = repo.rootFiles.filter((f) => SECRET_FILE_RE.test(f));
          const readmeHit = repo.readme ? SECRET_PATTERN_RE.test(repo.readme) : false;
          const manifestHit = repo.manifest ? SECRET_PATTERN_RE.test(JSON.stringify(repo.manifest).slice(0, 4000)) : false;
          if (leakedFiles.length) {
            return { pass: false, detail: `secret-shaped files committed: ${leakedFiles.join(", ")} — rotate and remove` };
          }
          if (readmeHit || manifestHit) {
            return { pass: false, detail: "credential-looking string found in tracked text — rotate this key now" };
          }
          return { pass: true, detail: "no secret-shaped files or keys detected at the root" };
        },
      },
      {
        id: "sec-env-gitignore",
        label: ".gitignore covers .env",
        weight: 2,
        fixId: "env-protection",
        test: (repo) => {
          const gitignore = rootHas(repo, /^\.gitignore$/i);
          if (!gitignore) return { pass: false, detail: "no .gitignore at all — .env files can be committed by accident" };
          return { pass: true, detail: ".gitignore present — confirm it lists .env*" };
        },
      },
      {
        id: "sec-dependabot",
        label: "Dependency update bot",
        weight: 2,
        fixId: "dependabot",
        test: (repo) => {
          const dep = ghOrRootHas(repo, /^dependabot/i) || rootHas(repo, /^renovate\.json/i);
          return { pass: dep, detail: dep ? "dependabot/renovate configured" : "no automated dependency updates — CVEs land silently" };
        },
      },
      {
        id: "sec-codeql",
        label: "Code scanning (CodeQL)",
        weight: 2,
        fixId: "codeql",
        test: (repo) => {
          const pass = repo.ciWorkflows.some((w) => /codeql|security/i.test(w)) || ghOrRootHas(repo, /^codeql/i);
          return { pass, detail: pass ? "code scanning workflow found" : "no automated code scanning — vulnerabilities ship unnoticed" };
        },
      },
      {
        id: "sec-docker-nonroot",
        label: "Dockerfile hardening",
        weight: 2,
        fixId: "dockerfile-hardening",
        test: (repo) => {
          const hasDocker = rootHas(repo, /^dockerfile$/i);
          if (!hasDocker) return { pass: true, detail: "n/a — no Dockerfile in this repo", na: true };
          if (repo.offline) return { pass: true, detail: "Dockerfile present (contents not probeable offline)", na: true };
          return { pass: false, detail: "Dockerfile detected — probe it for USER/non-root and pinned base (auto-hardening available)" };
        },
      },
      {
        id: "sec-workflow-pinning",
        label: "Actions pinned to versions",
        weight: 2,
        fixId: "workflow-pinning",
        test: (_repo, scan) => {
          const uses = scan.workflowContents.map((w) => w.content).join("\n").match(/^[\s-]*uses:.*$/gm) ?? [];
          if (uses.length === 0) return { pass: true, detail: "n/a — no workflow steps to pin", na: true };
          const unpinned = uses.filter((u) => !PINNED_ACTION_RE.test(u) || MASTER_REF_RE.test(u));
          return {
            pass: unpinned.length === 0,
            detail: unpinned.length ? `${unpinned.length} unpinned action(s) (branch refs or floating tags)` : "all actions pinned to tagged versions",
          };
        },
      },
      {
        id: "sec-permissions",
        label: "Workflow permissions block",
        weight: 2,
        fixId: "workflow-pinning",
        test: (_repo, scan) => {
          if (scan.workflowContents.length === 0) return { pass: true, detail: "n/a — no workflows yet", na: true };
          const ok = scan.workflowContents.some((w) => PERMISSIONS_RE.test(w.content));
          return { pass: ok, detail: ok ? "explicit permissions block found" : "no `permissions:` block — workflows run with broad token scope" };
        },
      },
      {
        id: "sec-audit-script",
        label: "Dependency audit command",
        weight: 1,
        fixId: "audit-script",
        test: (repo, scan) => {
          const scripts = Object.entries(repo.manifest?.scripts ?? {}).map(([k, v]) => `${k}:${v}`).join(" ");
          const inCi = scan.workflowContents.map((w) => w.content).join("\n");
          const auditRe = /\bnpm audit\b|\bbun audit\b|\bpnpm audit\b|\byarn audit\b|\bcargo (audit|deny)\b|\bpip-audit\b|\bosv-scanner\b|\bgo vet\b|\bgolangci-lint\b/i;
          const pass = auditRe.test(scripts) || auditRe.test(inCi);
          return { pass, detail: pass ? "dependency/vuln audit command found" : "no `audit` command in scripts or CI" };
        },
      },
    ],
  },
  {
    id: "devops",
    name: "DevOps",
    icon: "Workflow",
    checks: [
      {
        id: "dev-ci",
        label: "GitHub Actions workflows",
        weight: 4,
        fixId: "ci-workflow",
        test: (repo) => {
          const n = repo.ciWorkflows.length;
          return { pass: n > 0, detail: n ? `${n} workflow(s): ${repo.ciWorkflows.slice(0, 4).join(", ")}` : "no CI workflows" };
        },
      },
      {
        id: "dev-ci-tests",
        label: "CI runs the tests",
        weight: 3,
        fixId: "ci-workflow",
        test: (_repo, scan) => {
          const hit = scan.workflowContents.find((w) => TEST_IN_CI_RE.test(w.content));
          return {
            pass: !!hit,
            detail: hit ? `${hit.name} runs the test suite` : scan.workflowContents.length ? "workflows exist but none runs tests" : "no workflows to run tests",
          };
        },
      },
      {
        id: "dev-ci-lint",
        label: "Lint enforced in CI",
        weight: 1,
        fixId: "ci-workflow",
        test: (_repo, scan) => {
          const hit = scan.workflowContents.find((w) => LINT_IN_CI_RE.test(w.content));
          return { pass: !!hit, detail: hit ? `${hit.name} enforces lint/format` : "no workflow enforces lint/format" };
        },
      },
      {
        id: "dev-ci-cache",
        label: "CI dependency caching",
        weight: 1.5,
        fixId: "ci-workflow",
        test: (_repo, scan) => {
          const hit = scan.workflowContents.find((w) => CACHE_IN_CI_RE.test(w.content));
          return { pass: !!hit, detail: hit ? `${hit.name} caches dependencies` : "no caching — every run re-downloads the world" };
        },
      },
      {
        id: "dev-ci-matrix",
        label: "Matrix builds",
        weight: 1,
        fixId: "ci-workflow",
        test: (_repo, scan) => {
          const hit = scan.workflowContents.find((w) => MATRIX_IN_CI_RE.test(w.content));
          return { pass: !!hit, detail: hit ? "matrix strategy found" : "single-version CI — cross-version breakage ships unseen" };
        },
      },
      {
        id: "dev-dockerfile",
        label: "Dockerfile",
        weight: 1,
        fixId: "dockerfile-hardening",
        test: (repo) => {
          const pass = rootHas(repo, /^dockerfile$/i);
          return { pass, detail: pass ? "Dockerfile found" : "no Dockerfile — deploys are copy-paste folklore" };
        },
      },
      {
        id: "dev-compose",
        label: "docker-compose",
        weight: 1,
        fixId: "docker-compose",
        test: (repo) => {
          const pass = rootHas(repo, /^docker-compose(\.yml|\.yaml)?$/i) || rootHas(repo, /^compose(\.yml|\.yaml)?$/i);
          return { pass, detail: pass ? "compose file found" : "no docker-compose — local setup needs tribal knowledge" };
        },
      },
      {
        id: "dev-dockerignore",
        label: ".dockerignore",
        weight: 1,
        fixId: "dockerignore",
        test: (repo) => {
          const hasDocker = rootHas(repo, /^dockerfile$/i);
          if (!hasDocker) return { pass: true, detail: "n/a — no Dockerfile in this repo", na: true };
          const pass = rootHas(repo, /^\.dockerignore$/i);
          return { pass, detail: pass ? ".dockerignore found" : "no .dockerignore — images ship node_modules and .git" };
        },
      },
      {
        id: "dev-release",
        label: "Release automation",
        weight: 1.5,
        fixId: "release-workflow",
        test: (repo) => {
          const wf = repo.ciWorkflows.some((w) => /release|publish|changeset/i.test(w));
          const changesets = rootHas(repo, /^\.changeset/i);
          const script = Object.keys(repo.manifest?.scripts ?? {}).some((s) => /release/i.test(s));
          const releases = (repo.releaseCount ?? 0) > 0;
          if (wf || changesets || script) return { pass: true, detail: "release pipeline detected" };
          return {
            pass: releases,
            detail: releases ? `${repo.releaseCount} GitHub release(s), but manual` : repo.offline ? "n/a — offline mode cannot see releases" : "no releases and no release pipeline",
          };
        },
      },
    ],
  },
  {
    id: "community",
    name: "Community",
    icon: "Users",
    checks: [
      {
        id: "com-issues",
        label: "Issue templates",
        weight: 3,
        fixId: "issue-templates",
        test: (repo) => {
          const pass = ghOrRootHas(repo, /^issue_template/i);
          return { pass, detail: pass ? "issue templates found" : "no issue templates — bug reports arrive unstructured" };
        },
      },
      {
        id: "com-pr",
        label: "PR template",
        weight: 3,
        fixId: "pr-template",
        test: (repo) => {
          const pass = ghOrRootHas(repo, /^pull_request_template/i) || ghOrRootHas(repo, /^PULL_REQUEST_TEMPLATE/i);
          return { pass, detail: pass ? "PR template found" : "no PR template" };
        },
      },
      {
        id: "com-codeowners",
        label: "CODEOWNERS",
        weight: 2,
        fixId: "codeowners",
        test: (repo) => {
          const pass = repo.githubFiles.some((f) => /^codeowners/i.test(f)) || rootHas(repo, /^\.?codeowners$/i) || rootHas(repo, /^(docs|src)\/codeowners$/i);
          return { pass, detail: pass ? "CODEOWNERS found" : "no CODEOWNERS — review requests go to nobody" };
        },
      },
      {
        id: "com-funding",
        label: "FUNDING.yml",
        weight: 1,
        fixId: "funding",
        test: (repo) => {
          const pass = ghOrRootHas(repo, /^funding(\.yml)?$/i);
          return { pass, detail: pass ? "FUNDING.yml found" : "no sponsor button" };
        },
      },
      {
        id: "com-meta",
        label: "Description + topics set",
        weight: 3,
        fixId: "repo-meta",
        test: (repo) => {
          if (repo.offline) return { pass: true, detail: "n/a — offline mode (verify live)", na: true };
          const d = repo.description.trim().length >= 10;
          const t = repo.topics.length >= 2;
          if (d && t) return { pass: true, detail: `"${repo.description.slice(0, 60)}" + ${repo.topics.length} topics` };
          if (!d && !t) return { pass: false, detail: "no description and no topics — invisible to search" };
          return { pass: false, detail: d ? "description set, topics missing" : "topics set, description missing" };
        },
      },
      {
        id: "com-social",
        label: "Social proof in README",
        weight: 1.5,
        fixId: "readme-upgrade",
        test: (repo) => {
          const md = repo.readme ?? "";
          const pass = /shields\.io|badgen|circleci.*badge|travis-ci/i.test(md);
          return { pass, detail: pass ? "shields/badges found" : "no badges — the repo looks unloved at a glance" };
        },
      },
      {
        id: "com-contributing-ref",
        label: "README links contributing",
        weight: 1.5,
        fixId: "readme-upgrade",
        test: (repo) => {
          const pass = readmeHas(repo, /contributing/i);
          return { pass, detail: pass ? "README mentions contributing" : "README never mentions how to contribute" };
        },
      },
    ],
  },
];

// ── Risks: failed security-relevant checks → severity-ranked risk list ───────

const RISK_MAP: Record<string, { severity: AuditRisk["severity"]; title: string }> = {
  "sec-secrets": { severity: "critical", title: "Committed secrets detected" },
  "sec-env-gitignore": { severity: "high", title: "Environment files not protected" },
  "sec-docker-nonroot": { severity: "high", title: "Dockerfile runs as root" },
  "qa-gitignore": { severity: "high", title: "No .gitignore — secret leak risk" },
  "sec-workflow-pinning": { severity: "medium", title: "Unpinned GitHub Actions" },
  "sec-permissions": { severity: "medium", title: "Broad workflow token scope" },
  "sec-codeql": { severity: "medium", title: "No automated code scanning" },
  "sec-dependabot": { severity: "low", title: "No dependency update bot" },
  "sec-security-md": { severity: "low", title: "No vulnerability disclosure policy" },
  "sec-audit-script": { severity: "low", title: "No dependency audit command" },
};

// ── Engine: score → compose fixes → roadmap ─────────────────────────────────

function fileStatus(path: string, repo: RepoData): "NEW" | "UPDATED" {
  const base = path.split("/").pop() ?? path;
  if (path.startsWith(".github/workflows/")) {
    return repo.ciWorkflows.some((w) => w.toLowerCase() === base.toLowerCase()) ? "UPDATED" : "NEW";
  }
  if (path.startsWith(".github/") || path.startsWith(".github\\")) {
    return repo.githubFiles.some((f) => f.toLowerCase() === base.toLowerCase()) ? "UPDATED" : "NEW";
  }
  return repo.rootFiles.some((f) => f.toLowerCase() === base.toLowerCase()) ? "UPDATED" : "NEW";
}

export function auditRepo(repo: RepoData, scan: AuditScan, strictness: Strictness = DEFAULT_STRICTNESS): RepoAudit {
  const th = thresholdsFor(strictness);

  const categories: RepoAuditCategory[] = RUBRIC.map((cat) => {
    const checks: RepoAuditCheck[] = cat.checks.map((c) => {
      const r = c.test(repo, scan, th);
      return { id: c.id, label: c.label, weight: c.weight, pass: r.pass, detail: r.detail, na: r.na };
    });
    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      score: checks.filter((c) => c.pass).reduce((s, c) => s + c.weight, 0),
      max: checks.reduce((s, c) => s + c.weight, 0),
      checks,
    };
  });

  const score = Math.round(categories.reduce((s, c) => s + c.score, 0) * 2) / 2;
  const finalScore = Math.round(score);
  const failed = categories.flatMap((c) => c.checks.filter((k) => !k.pass).map((k) => ({ ...k, category: c.id })));
  // Check id → fix id lookup (RepoAuditCheck intentionally omits fixId in the API contract)
  const fixForCheck: Record<string, string> = Object.fromEntries(
    RUBRIC.flatMap((cat) => cat.checks.map((c) => [c.id, c.fixId]))
  );

  // Compose fixes: group failed checks by fixId
  const ctx: FixContext = {
    year: new Date().getFullYear(),
    testCmd: testCmdFor(repo),
    installCmd: installCmd(repo),
    linter: detectLinter(repo),
    licenseSpdx: repo.license?.spdx ?? repo.manifest?.licenseField ?? null,
    workflowFile: "ci.yml",
    hasWorkflowTests: scan.workflowContents.some((w) => TEST_IN_CI_RE.test(w.content)),
    hasWorkflowLint: scan.workflowContents.some((w) => LINT_IN_CI_RE.test(w.content)),
    keywords: suggestedKeywords(repo),
    isNode: !!repo.manifest,
    isPython: /python/i.test(repo.detected.language) || rootHas(repo, /^pyproject\.toml$|^requirements\.txt$/i),
    isGo: rootHas(repo, /^go\.mod$/i) || /go\b/i.test(repo.detected.language),
    isRust: rootHas(repo, /^cargo\.toml$/i) || /rust/i.test(repo.detected.language),
  };

  const grouped = new Map<string, { points: number; checkIds: string[] }>();
  for (const f of failed) {
    const fixId = fixForCheck[f.id];
    if (!fixId) continue;
    const g = grouped.get(fixId) ?? { points: 0, checkIds: [] };
    g.points += f.weight;
    g.checkIds.push(f.id);
    grouped.set(fixId, g);
  }

  const fixes: CodeFix[] = [];
  for (const [fixId, g] of grouped) {
    const meta = FIX_META[fixId];
    const builder = FIX_BUILDERS[fixId];
    if (!meta) continue;
    let files: CodeFix["files"] = [];
    if (builder) {
      // Defensive: normalize builder output to an array of files
      const raw = builder(repo, ctx);
      files = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
      for (const file of files) {
        if (!file.status) file.status = fileStatus(file.path, repo);
      }
    }
    if (!files.length && !meta.manualSteps) continue;
    fixes.push({
      id: fixId,
      rank: 0,
      title: meta.title,
      checkIds: g.checkIds,
      points: g.points,
      priority: meta.priority,
      effort: meta.effort,
      why: meta.why,
      docsUrl: meta.docsUrl,
      files,
      manualSteps: meta.manualSteps,
    });
  }

  // Ranking: most points first, then priority, then effort (quick wins)
  fixes.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const p = FIX_PRIORITY_ORDER[a.priority] - FIX_PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return a.title.localeCompare(b.title);
  });
  fixes.forEach((f, i) => (f.rank = i + 1));

  // Roadmap: cumulative projected score as fixes are applied in order
  const roadmap: RoadmapStep[] = [];
  let cumulative = finalScore;
  for (const f of fixes) {
    cumulative = Math.min(100, cumulative + f.points);
    roadmap.push({
      rank: f.rank,
      fixId: f.id,
      title: f.title,
      points: f.points,
      effort: f.effort,
      quickWin: effortMinutesSafe(f.effort) <= 5,
      cumulative,
    });
  }

  // Risks: failed security-relevant checks, severity-ranked
  const risks: AuditRisk[] = failed
    .filter((f) => RISK_MAP[f.id])
    .map((f) => ({ id: f.id, severity: RISK_MAP[f.id].severity, title: RISK_MAP[f.id].title, detail: f.detail, checkId: f.id }))
    .sort((a, b) => RISK_SEVERITY_ORDER[a.severity] - RISK_SEVERITY_ORDER[b.severity]);

  const stats = {
    checksTotal: categories.reduce((s, c) => s + c.checks.length, 0),
    checksPassed: categories.reduce((s, c) => s + c.checks.filter((k) => k.pass).length, 0),
    checksFailed: failed.length,
    pointsAtStake: 100 - finalScore,
    fixFiles: [...new Set(fixes.flatMap((f) => f.files.map((x) => x.path)).filter((p) => !p.startsWith("GUIDE:")))],
    minutesTotal: fixes.reduce((s, f) => s + effortMinutesSafe(f.effort), 0),
  };

  return {
    score: finalScore,
    grade: gradeFor(finalScore),
    tier: repoTier(finalScore),
    percentile: percentileFor(finalScore),
    strictness,
    categories,
    risks,
    fixes,
    roadmap,
    stats,
  };
}

function effortMinutesSafe(effort: string): number {
  const m = effort.match(/(\d+)\s*min/i);
  return m ? Number(m[1]) : 10;
}

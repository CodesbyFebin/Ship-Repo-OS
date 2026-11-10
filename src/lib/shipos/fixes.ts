// ─────────────────────────────────────────────────────────────────────────────
// ShipOS — Full Repo Auditor: fix forges.
// Every fix produces FULL, copy-paste-ready file content grounded in the
// repository's real stack (package manager, language, test runner, license).
// Nothing generic: the ci.yml for a pnpm repo is a pnpm ci.yml.
// ─────────────────────────────────────────────────────────────────────────────
import type { RepoData } from "./types";
import type { FixFile, FixPriority } from "./audit-types";

// ── Detected linter kinds ────────────────────────────────────────────────────

export type LinterKind = "eslint" | "biome" | "prettier" | "ruff" | "flake8" | "golangci" | "rustfmt" | "editorconfig";

export interface FixContext {
  year: number;
  testCmd: string | null; // best-effort runnable test command
  installCmd: string; // dependency install command
  linter: LinterKind | null; // linter config detected in the repo
  licenseSpdx: string | null; // resolved license (metadata or file)
  workflowFile: string; // the CI file this audit will create, e.g. "ci.yml"
  hasWorkflowTests: boolean;
  hasWorkflowLint: boolean;
  keywords: string[]; // suggested GitHub topics
  isNode: boolean;
  isPython: boolean;
  isGo: boolean;
  isRust: boolean;
}

// ── Small helpers ────────────────────────────────────────────────────────────

function pm(repo: RepoData): string {
  return repo.detected.packageManager ?? "npm";
}

/** Proper "run script" command for the detected package manager. */
export function runScript(repo: RepoData, script: string): string {
  const m = pm(repo);
  if (m === "bun") return `bun run ${script}`;
  if (m === "pnpm") return `pnpm ${script}`;
  if (m === "yarn") return `yarn ${script}`;
  return `npm run ${script}`;
}

export function installCmd(repo: RepoData): string {
  const m = pm(repo);
  if (m === "bun") return "bun install";
  if (m === "pnpm") return "pnpm install";
  if (m === "yarn") return "yarn install";
  if (m === "pip") return "pip install -r requirements.txt";
  if (m === "cargo") return "cargo build";
  if (m === "go") return "go mod download";
  return "npm install";
}

export function testCmdFor(repo: RepoData): string | null {
  const scripts = repo.manifest?.scripts ?? {};
  const t = scripts.test;
  if (t && !/^echo/i.test(t.trim()) && !/Error: no test specified/i.test(t)) {
    return runScript(repo, "test");
  }
  const root = repo.rootFiles.map((f) => f.toLowerCase());
  if (root.includes("pytest.ini") || root.includes("tox.ini") || root.includes("conftest.py") || root.includes("pyproject.toml")) return "pytest";
  if (root.includes("go.mod")) return "go test ./...";
  if (root.includes("cargo.toml")) return "cargo test";
  return null;
}

function languageFlags(repo: RepoData): Pick<FixContext, "isNode" | "isPython" | "isGo" | "isRust"> {
  const langs = repo.detected.languages.map((l) => l.name.toLowerCase()).join(" ");
  const root = repo.rootFiles.map((f) => f.toLowerCase());
  return {
    isNode: !!repo.manifest && (repo.manifest.dependencies !== undefined),
    isPython: /python/.test(langs) || root.includes("pyproject.toml") || root.includes("requirements.txt"),
    isGo: /go\b/.test(langs) || root.includes("go.mod"),
    isRust: /rust/.test(langs) || root.includes("cargo.toml"),
  };
}

export function suggestedKeywords(repo: RepoData): string[] {
  const out = new Set<string>();
  for (const l of repo.detected.languages) out.add(l.name.toLowerCase().replace(/\+\+/, "cpp").replace(/\s+/g, "-"));
  for (const f of repo.detected.frameworks.slice(0, 3)) out.add(f.toLowerCase().replace(/\s+/g, "-"));
  for (const t of repo.topics.slice(0, 5)) out.add(t.toLowerCase());
  out.add("open-source");
  return [...out].slice(0, 10);
}

function defaultBranch(repo: RepoData): string {
  return repo.defaultBranch || "main";
}

function firstSentence(s: string | null | undefined, fallback: string): string {
  const t = (s ?? "").trim();
  if (!t) return fallback;
  return t.split(/(?<=[.!?])\s/)[0].slice(0, 180);
}

// ── Fix metadata (title / priority / effort / why / docs) ───────────────────

export interface FixMeta {
  title: string;
  priority: FixPriority;
  effort: string;
  why: string;
  docsUrl?: string;
  /** Clear manual steps for fixes no template can fully generate. */
  manualSteps?: string[];
}

export const FIX_META: Record<string, FixMeta> = {
  "ci-workflow": {
    title: "Add a CI workflow that runs the test suite",
    priority: "critical",
    effort: "5 min",
    why: "A CI workflow is the single highest-leverage file in a repository: it runs tests on every push and PR, blocks regressions before they merge, and powers the build badge. Without it, 'it works on my machine' is the only guarantee you have.",
    docsUrl: "https://docs.github.com/en/actions/automating-builds-and-tests/about-continuous-integration",
  },
  "test-setup": {
    title: "Set up the automated test suite",
    priority: "critical",
    effort: "10 min",
    why: "Tests are the difference between a demo and a product. A wired-up suite with one real test beats a perfect README with zero tests — contributors can verify their changes, and refactors stop being terrifying.",
    docsUrl: "https://docs.github.com/en/actions/automating-builds-and-tests/about-continuous-integration",
  },
  "readme-scaffold": {
    title: "Create a README (the front door of the repo)",
    priority: "critical",
    effort: "5 min",
    why: "No README means no README score, no first impression, and most visitors bounce. This scaffold is grounded in your real stack — drop it in and iterate.",
    docsUrl: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes",
  },
  "readme-upgrade": {
    title: "Grow the README to 400+ words (or run the Upgrader)",
    priority: "high",
    effort: "10 min",
    why: "Thin READMEs read as abandonware and rank poorly in search. Expand the problem/solution, features, install, usage and testing sections — or switch to the README Upgrader mode for the full LLM-forged 100/100 rewrite.",
    docsUrl: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes",
  },
  "license-file": {
    title: "Add a LICENSE file",
    priority: "critical",
    effort: "2 min",
    why: "Without a license file, nobody can legally use, modify or redistribute your code — and GitHub shows 'no license' which blocks adoption and some package registries.",
    docsUrl: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository",
  },
  "test-script": {
    title: "Wire the `test` script / test command",
    priority: "high",
    effort: "2 min",
    why: "A discoverable test command (`npm test`, `make test`) is what CI, contributors and AI agents look for first. It must be one copy-paste away.",
    docsUrl: "https://docs.npmjs.com/cli/v10/using-npm/scripts",
  },
  "test-ci": {
    title: "Make CI actually run the tests",
    priority: "critical",
    effort: "5 min",
    why: "A workflow that builds but never tests is decoration. This fix ensures the test suite is part of the automated pipeline so regressions fail loudly.",
    docsUrl: "https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs",
  },
  "coverage": {
    title: "Track and publish test coverage",
    priority: "high",
    effort: "5 min",
    why: "Coverage turns 'we have tests' into 'we have 82% coverage on the paths that matter'. The badge keeps the number visible and regressing coverage becomes embarrassing — which is the point.",
    docsUrl: "https://about.codecov.io/product/codecov-free-tier/",
  },
  "auto-ci": {
    title: "Add GitHub Actions CI",
    priority: "critical",
    effort: "5 min",
    why: "No CI workflows detected. Continuous integration is table stakes for any serious repository — this generates a full workflow matched to your stack.",
    docsUrl: "https://docs.github.com/en/actions",
  },
  "ci-badge": {
    title: "Surface the CI badge in the README",
    priority: "medium",
    effort: "2 min",
    why: "A build-passing badge is the fastest trust signal a visitor can read without scrolling. If CI exists but the badge is missing, you are hiding your best proof.",
    docsUrl: "https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/adding-a-workflow-status-badge",
  },
  "lint-enforcement": {
    title: "Enforce lint/format in CI",
    priority: "high",
    effort: "5 min",
    why: "Style arguments end when a robot enforces them. A lint job makes every PR self-clean and keeps review comments about logic, not commas.",
    docsUrl: "https://eslint.org/docs/latest/use/integrations#run-eslint-on-pull-requests",
  },
  "release-workflow": {
    title: "Automate releases",
    priority: "high",
    effort: "10 min",
    why: "Manual releases drift, forget changelogs and skip artifacts. A release workflow cuts a GitHub Release (and publishes the package where applicable) on every version tag.",
    docsUrl: "https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes",
  },
  dependabot: {
    title: "Enable Dependabot dependency updates",
    priority: "high",
    effort: "2 min",
    why: "Dependencies rot silently. Dependabot opens version-bump PRs weekly — including security patches — so staying current becomes reviewing PRs instead of migrations.",
    docsUrl: "https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file",
  },
  "issue-templates": {
    title: "Add issue templates",
    priority: "medium",
    effort: "5 min",
    why: "Templates turn 'it does not work pls help' into structured, reproducible reports with versions and steps — triage time drops dramatically.",
    docsUrl: "https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-in-your-repository/about-issue-and-pull-request-templates",
  },
  "pr-template": {
    title: "Add a pull request template",
    priority: "medium",
    effort: "2 min",
    why: "A PR template makes every change declare what/why/testing, which keeps reviews fast and the git history meaningful.",
    docsUrl: "https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-in-your-repository/creating-a-pull-request-template-for-your-repository",
  },
  "code-of-conduct": {
    title: "Adopt a Code of Conduct",
    priority: "medium",
    effort: "2 min",
    why: "A CoC sets expectations for behavior and gives you a enforcement path before problems start. Most foundations and ecosystems require one for adoption.",
    docsUrl: "https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project",
  },
  "security-policy": {
    title: "Add a security policy (SECURITY.md)",
    priority: "high",
    effort: "2 min",
    why: "SECURITY.md tells researchers how to report vulnerabilities responsibly instead of opening public issues — and it is required by many enterprise buyers and OpenSSF scorecard.",
    docsUrl: "https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository",
  },
  funding: {
    title: "Add a FUNDING.yml file",
    priority: "low",
    effort: "2 min",
    why: "The 'Sponsor this project' button costs one file. Even if you never expect money, it signals a maintained project and enables GitHub Sponsors.",
    docsUrl: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository",
  },
  "repo-meta": {
    title: "Set the repo description and topics",
    priority: "medium",
    effort: "2 min",
    why: "Description and topics are how your repo is found — on GitHub search, Google, and trending pages. Four points for two minutes of typing.",
    docsUrl: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics",
  },
  "contributing-file": {
    title: "Add a CONTRIBUTING.md guide",
    priority: "medium",
    effort: "5 min",
    why: "A contributing guide converts drive-by stars into first PRs: it answers setup, branch, commit and PR questions before they are asked.",
    docsUrl: "https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors",
  },
  "changelog-file": {
    title: "Add a CHANGELOG.md",
    priority: "medium",
    effort: "2 min",
    why: "A changelog is the project's public memory. Users scan it to decide whether to upgrade; generated from your real commit history below.",
    docsUrl: "https://keepachangelog.com/en/1.1.0/",
  },
  "docs-folder": {
    title: "Add a docs/ folder",
    priority: "low",
    effort: "5 min",
    why: "A docs/ directory separates the quickstart (README) from the deep material (architecture, guides, ADRs) — and several doc site generators pick it up automatically.",
    docsUrl: "https://docs.github.com/en/communities/documenting-your-project-with-wikis",
  },
  "lint-config": {
    title: "Add linter/formatter configuration",
    priority: "medium",
    effort: "5 min",
    why: "Zero-config formatting is a myth; a checked-in config makes style deterministic across machines, editors and CI.",
    docsUrl: "https://eslint.org/docs/latest/use/configure/configuration-files",
  },
  "typing-config": {
    title: "Enable type checking",
    priority: "medium",
    effort: "5 min",
    why: "Types catch a whole class of bugs at build time and make editors genuinely useful for contributors. This adds a strict, sane config.",
    docsUrl: "https://www.typescriptlang.org/docs/handbook/tsconfig-json.html",
  },
  "metadata-patch": {
    title: "Complete the package metadata",
    priority: "medium",
    effort: "2 min",
    why: "Registries, dependency dashboards and search all index manifest metadata. Missing description/license/repository fields make the package look abandoned.",
    docsUrl: "https://docs.npmjs.com/package.json",
  },
  "examples-starter": {
    title: "Add an examples/ folder",
    priority: "low",
    effort: "5 min",
    why: "A minimal runnable example is the highest-converting documentation you can ship — many users read the example before the README.",
    docsUrl: "https://docs.github.com/en/repositories/creating-and-managing-repositories/best-practices-for-repositories",
  },
  gitignore: {
    title: "Add a .gitignore",
    priority: "high",
    effort: "2 min",
    why: "Without .gitignore, build artifacts, dependencies and .env secrets leak into commits. One file prevents the most common repo accidents.",
    docsUrl: "https://git-scm.com/docs/gitignore",
  },
  "env-example": {
    title: "Add a .env.example",
    priority: "medium",
    effort: "5 min",
    why: "A committed .env.example documents every variable your app needs — new contributors run setup on the first try instead of grepping your source.",
    docsUrl: "https://12factor.net/config",
  },
  "env-protection": {
    title: "Keep .env out of git",
    priority: "critical",
    effort: "2 min",
    why: "One accidental `git add .env` leaks live credentials forever (they stay in history). Ignoring env files is the cheapest insurance in software.",
    docsUrl: "https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files",
  },
  "secrets-cleanup": {
    title: "Remove & rotate committed secrets",
    priority: "critical",
    effort: "15 min",
    why: "Secret-shaped files or keys are tracked in this repo. Anything pushed to GitHub must be considered compromised — rotate first, delete second.",
    docsUrl: "https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning",
    manualSteps: [
      "1. ROTATE every exposed key/token at its provider (GitHub, OpenAI, AWS, Stripe…) — deletion alone is not enough.",
      "2. Remove the file(s) from the working tree: `git rm --cached .env && rm .env` (keep your local copy if needed).",
      "3. Purge history so old commits stop leaking: `npx git-filter-repo --path .env --invert-paths` (or BFG Repo-Cleaner), then force-push.",
      "4. Add the patterns to .gitignore (.env, .env.*, *.pem, credentials.json) — the auditor's env-protection fix generates this.",
      "5. Add secret scanning: repo Settings → Code security → Secret scanning + Push protection.",
      "6. Re-run this audit to confirm the check passes.",
    ],
  },
  "lockfile-guidance": {
    title: "Commit a lockfile",
    priority: "high",
    effort: "5 min",
    why: "Without a lockfile, two installs of the same package.json can produce different dependency trees — 'works on my machine' becomes a build bug.",
    docsUrl: "https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json",
    manualSteps: [
      "Node (npm): run `npm install --package-lock-only`, commit package-lock.json.",
      "Node (pnpm): commit pnpm-lock.yaml (generated automatically by `pnpm install`).",
      "Node (bun): commit bun.lock / bun.lockb.",
      "Python: `pip install pip-tools` then `pip-compile` to commit requirements.txt pins — or adopt uv/poetry and commit uv.lock / poetry.lock.",
      "Rust/Go: Cargo.lock / go.sum are generated on build — commit them (libraries may intentionally skip Cargo.lock).",
      "Never manually edit a lockfile; regenerate it with the package manager.",
    ],
  },
  editorconfig: {
    title: "Add a .editorconfig",
    priority: "low",
    effort: "2 min",
    why: "One tiny file ends the tabs-vs-spaces war across every editor and OS — diffs stop filling up with whitespace noise.",
    docsUrl: "https://editorconfig.org",
  },
  "node-version": {
    title: "Pin the Node runtime",
    priority: "low",
    effort: "2 min",
    why: "A .nvmrc tells contributors, CI and hosts exactly which Node version this repo supports — no more 'which Node are you on?' threads.",
    docsUrl: "https://github.com/nvm-sh/nvm",
  },
  codeql: {
    title: "Enable CodeQL code scanning",
    priority: "medium",
    effort: "5 min",
    why: "CodeQL scans every push for known vulnerability patterns and flags them as code scanning alerts — free security review from GitHub.",
    docsUrl: "https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning",
  },
  "workflow-pinning": {
    title: "Pin GitHub Actions to versions",
    priority: "medium",
    effort: "10 min",
    why: "Workflows that float on `@main` execute whatever a third party pushes next. Pin to version tags and add an explicit permissions block to shrink the blast radius of a compromised action.",
    docsUrl: "https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions",
    manualSteps: [
      "Pin every `uses:` to a release tag or SHA — e.g. `actions/checkout@v4` (not `@main`).",
      "For maximum safety, pin to the full commit SHA (the taginator action or Dependabot can keep SHAs updated).",
      "Add a top-level permissions block to each workflow to scope the GITHUB_TOKEN:",
      "    permissions:",
      "      contents: read",
      "Re-run this audit to confirm both pinning and permissions checks pass.",
    ],
  },
  "audit-script": {
    title: "Add a dependency audit command",
    priority: "low",
    effort: "5 min",
    why: "A one-line audit script surfaces known CVEs in your dependency tree before attackers do.",
    docsUrl: "https://docs.npmjs.com/cli/v10/commands/npm-audit",
    manualSteps: [
      "Node: add to package.json scripts → `\"audit\": \"npm audit --audit-level=high\"` (pnpm/yarn/bun equivalents exist).",
      "Rust: `cargo install cargo-audit` then run `cargo audit` — wire it into CI.",
      "Python: `pip install pip-audit` then run `pip-audit` — wire it into CI.",
      "Go: `govulncheck ./...` (golang.org/x/vuln) — wire it into CI.",
      "Optional: add the audit command as a scheduled weekly workflow step.",
    ],
  },
  "dockerfile-hardening": {
    title: "Add a hardened Dockerfile",
    priority: "medium",
    effort: "10 min",
    why: "Multi-stage builds, a pinned base image and a non-root USER turn 'it runs in Docker' into 'it runs safely in Docker'.",
    docsUrl: "https://docs.docker.com/build/building/best-practices/",
  },
  "docker-compose": {
    title: "Add docker-compose.yml",
    priority: "low",
    effort: "5 min",
    why: "One command (`docker compose up`) becomes the entire local setup — app, database, caches — for every contributor.",
    docsUrl: "https://docs.docker.com/compose/",
  },
  dockerignore: {
    title: "Add a .dockerignore",
    priority: "low",
    effort: "2 min",
    why: "Without it, images ship .git, node_modules and local env files — slower builds, bigger images, leaked secrets.",
    docsUrl: "https://docs.docker.com/build/concepts/context/#dockerignore-files",
  },
  codeowners: {
    title: "Add a CODEOWNERS file",
    priority: "medium",
    effort: "2 min",
    why: "CODEOWNERS auto-requests review from the right people on every PR — the difference between 'review pending' forever and a merged change.",
    docsUrl: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners",
  },
};

// ── Fix builders ─────────────────────────────────────────────────────────────

type FixBuilder = (repo: RepoData, ctx: FixContext) => FixFile[];

// ── Hardening / hygiene builders (security · devops · quality) ───────────────

function envExampleFix(repo: RepoData): FixFile {
  const vars: [string, string][] = repo.manifest
    ? [
        ["PORT", "3000"],
        ["NODE_ENV", "development"],
        ["DATABASE_URL", "postgres://user:password@localhost:5432/mydb"],
      ]
    : ctx_python(repo)
      ? [
          ["DATABASE_URL", "postgres://user:password@localhost:5432/mydb"],
          ["SECRET_KEY", "change-me"],
          ["DEBUG", "true"],
        ]
      : [
          ["DATABASE_URL", "postgres://user:password@localhost:5432/mydb"],
          ["LOG_LEVEL", "info"],
        ];
  const lines = [
    `# .env.example — copy to .env and fill in real values (.env is git-ignored, never commit it).`,
    `# Generated by ShipOS Full Repo Auditor — extend with every variable your app reads.`,
    ``,
    ...vars.map(([k, v]) => `${k}=${v}`),
  ];
  return { path: ".env.example", language: "bash", content: lines.join("\n"), note: "Copy to .env, never commit the real .env" };
}

function ctx_python(repo: RepoData): boolean {
  const root = repo.rootFiles.map((f) => f.toLowerCase());
  return root.includes("pyproject.toml") || root.includes("requirements.txt") || /python/i.test(repo.detected.language);
}

function editorconfigFix(): FixFile {
  return {
    path: ".editorconfig",
    language: "ini",
    content: [
      "# EditorConfig — https://editorconfig.org",
      "root = true",
      "",
      "[*]",
      "charset = utf-8",
      "end_of_line = lf",
      "insert_final_newline = true",
      "trim_trailing_whitespace = true",
      "indent_style = space",
      "indent_size = 2",
      "",
      "[*.md]",
      "trim_trailing_whitespace = false",
      "",
      "[*.{py,rs}]",
      "indent_size = 4",
      "",
      "[Makefile]",
      "indent_style = tab",
    ].join("\n"),
  };
}

function nodeVersionFix(): FixFile {
  return { path: ".nvmrc", language: "text", content: "22", note: "nvm use → installs the exact runtime" };
}

function envProtectionFix(repo: RepoData): FixFile {
  const stack = repo.rootFiles.map((f) => f.toLowerCase());
  const extras: string[] = [];
  if (stack.includes("package.json")) extras.push("node_modules/", "dist/", ".next/", "coverage/");
  if (stack.includes("pyproject.toml") || stack.includes("requirements.txt")) extras.push("__pycache__/", ".venv/", "*.pyc");
  if (stack.includes("cargo.toml")) extras.push("target/");
  if (stack.includes("go.mod")) extras.push("bin/");
  const lines = [
    "# Append these lines to your existing .gitignore (or use them as the file).",
    "# Secrets never belong in git — .env.example (safe template) is fine to commit.",
    "",
    ...extras.map((e) => e),
    "",
    "# ── secrets & env ──",
    ".env",
    ".env.*",
    "!.env.example",
    "*.pem",
    "*.key",
    "*.p12",
    "credentials.json",
    "*.pfx",
    "_rsa",
  ];
  return {
    path: "GITIGNORE-SNIPPET.gitignore",
    language: "bash",
    content: lines.join("\n"),
    status: "GUIDE",
    note: "Guide — append these lines to .gitignore, then `git rm --cached .env` if it was ever committed",
  };
}

function codeqlWorkflowFix(repo: RepoData): FixFile {
  const langs = /typescript|javascript/i.test(repo.detected.language) || repo.manifest ? "javascript-typescript" : /python/i.test(repo.detected.language) ? "python" : /go\b/i.test(repo.detected.language) ? "go" : "javascript-typescript";
  return {
    path: ".github/workflows/codeql.yml",
    language: "yaml",
    content: [
      `# CodeQL — GitHub's semantic code scanner. Alerts appear under Security → Code scanning.`,
      `# Generated by ShipOS Full Repo Auditor.`,
      `name: CodeQL`,
      ``,
      `on:`,
      `  push:`,
      `    branches: ["${defaultBranch(repo)}"]`,
      `  pull_request:`,
      `    branches: ["${defaultBranch(repo)}"]`,
      `  schedule:`,
      `    - cron: "0 6 * * 1"`,
      ``,
      `permissions:`,
      `  contents: read`,
      ``,
      `jobs:`,
      `  analyze:`,
      `    name: Analyze (${langs})`,
      `    runs-on: ubuntu-latest`,
      `    permissions:`,
      `      contents: read`,
      `      security-events: write`,
      `    steps:`,
      `      - uses: actions/checkout@v4`,
      `      - uses: github/codeql-action/init@v3`,
      `        with:`,
      `          languages: ${langs}`,
      `      - uses: github/codeql-action/analyze@v3`,
    ].join("\n"),
  };
}

function dockerfileFix(repo: RepoData): FixFile {
  const branch = defaultBranch(repo);
  if (ctx_python(repo)) {
    return {
      path: "Dockerfile",
      language: "dockerfile",
      content: [
        `# Multi-stage, non-root, health-checked — generated by ShipOS Full Repo Auditor.`,
        `# syntax=docker/dockerfile:1`,
        `FROM python:3.12-slim AS base`,
        `ENV PYTHONDONTWRITEBYTECODE=1 \\`,
        `    PYTHONUNBUFFERED=1`,
        `WORKDIR /app`,
        ``,
        `FROM base AS deps`,
        `COPY requirements.txt ./`,
        `RUN pip install --no-cache-dir --prefix=/install -r requirements.txt`,
        ``,
        `FROM base AS runtime`,
        `RUN groupadd -r appuser && useradd -r -g appuser appuser`,
        `COPY --from=deps /install /usr/local`,
        `COPY . .`,
        `USER appuser`,
        `EXPOSE 8000`,
        `HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2).status==200 else 1)" || exit 1`,
        `CMD ["python", "-m", "your_app"]  # ← point at your entrypoint`,
      ].join("\n"),
      note: "Point CMD at your real entrypoint; adjust the healthcheck path",
    };
  }
  if (repo.rootFiles.map((f) => f.toLowerCase()).includes("go.mod")) {
    return {
      path: "Dockerfile",
      language: "dockerfile",
      content: [
        `# Multi-stage, non-root, health-checked — generated by ShipOS Full Repo Auditor.`,
        `# syntax=docker/dockerfile:1`,
        `FROM golang:1.23-alpine AS build`,
        `WORKDIR /src`,
        `COPY go.mod go.sum* ./`,
        `RUN go mod download`,
        `COPY . .`,
        `RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/app ./...`,
        ``,
        `FROM gcr.io/distroless/static-debian12:nonroot`,
        `COPY --from=build /out/app /app`,
        `USER nonroot:nonroot`,
        `EXPOSE 8080`,
        `ENTRYPOINT ["/app"]`,
      ].join("\n"),
    };
  }
  return {
    path: "Dockerfile",
    language: "dockerfile",
    content: [
      `# Multi-stage, non-root, health-checked — generated by ShipOS Full Repo Auditor.`,
      `# syntax=docker/dockerfile:1`,
      `FROM node:22-alpine AS deps`,
      `WORKDIR /app`,
      `COPY package*.json ./`,
      `RUN npm ci --omit=dev`,
      ``,
      `FROM node:22-alpine AS build`,
      `WORKDIR /app`,
      `COPY package*.json ./`,
      `RUN npm ci`,
      `COPY . .`,
      `RUN npm run build --if-present`,
      ``,
      `FROM node:22-alpine AS runtime`,
      `ENV NODE_ENV=production`,
      `WORKDIR /app`,
      `RUN addgroup -S app && adduser -S app -G app`,
      `COPY --from=deps /app/node_modules ./node_modules`,
      `COPY --from=build /app ./`,
      `USER app`,
      `EXPOSE 3000`,
      `HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1`,
      `CMD ["npm", "start"]`,
      ``,
      `# branch tip: build on ${branch} CI before pushing images`,
    ].join("\n"),
  };
}

function dockerComposeFix(): FixFile {
  return {
    path: "docker-compose.yml",
    language: "yaml",
    content: [
      `# One-command local stack — generated by ShipOS Full Repo Auditor.`,
      `services:`,
      `  app:`,
      `    build: .`,
      `    ports:`,
      `      - "3000:3000"`,
      `    environment:`,
      `      - NODE_ENV=development`,
      `    env_file:`,
      `      - .env  # never committed — see .env.example`,
      `    depends_on:`,
      `      db:`,
      `        condition: service_healthy`,
      `    restart: unless-stopped`,
      ``,
      `  db:`,
      `    image: postgres:16-alpine`,
      `    environment:`,
      `      POSTGRES_USER: dev`,
      `      POSTGRES_PASSWORD: dev`,
      `      POSTGRES_DB: app`,
      `    ports:`,
      `      - "5432:5432"`,
      `    volumes:`,
      `      - pgdata:/var/lib/postgresql/data`,
      `    healthcheck:`,
      `      test: ["CMD-SHELL", "pg_isready -U dev"]`,
      `      interval: 5s`,
      `      timeout: 3s`,
      `      retries: 10`,
      ``,
      `volumes:`,
      `  pgdata:`,
    ].join("\n"),
    note: "Swap the db service for your real database",
  };
}

function dockerignoreFix(): FixFile {
  return {
    path: ".dockerignore",
    language: "bash",
    content: [
      ".git",
      ".github",
      ".gitignore",
      ".env",
      ".env.*",
      "node_modules",
      "dist",
      ".next",
      "coverage",
      "__pycache__",
      "*.log",
      "Dockerfile",
      "docker-compose*.yml",
      ".dockerignore",
      "README.md",
    ].join("\n"),
  };
}

function codeownersFix(repo: RepoData): FixFile {
  const owner = `@${repo.owner}`;
  return {
    path: ".github/CODEOWNERS",
    language: "text",
    content: [
      "# CODEOWNERS — who reviews what. Paths use gitignore-style patterns.",
      "# Generated by ShipOS Full Repo Auditor — add teammates + team handles as you grow.",
      ``,
      `# Default owner for everything`,
      `*               ${owner}`,
      ``,
      `# CI & security changes need the owner's sign-off`,
      `/.github/        ${owner}`,
      `/Dockerfile      ${owner}`,
    ].join("\n"),
  };
}

function ciWorkflowFile(repo: RepoData, ctx: FixContext): FixFile {
  const branch = defaultBranch(repo);
  const header = [
    `# CI — install, lint (when configured) and test on every push and PR.`,
    `# Generated by ShipOS Full Repo Auditor — tune triggers to taste.`,
    `name: CI`,
    ``,
    `on:`,
    `  push:`,
    `    branches: ["${branch}"]`,
    `  pull_request:`,
    `    branches: ["${branch}"]`,
    ``,
    `concurrency:`,
    `  group: ci-\${{ github.ref }}`,
    `  cancel-in-progress: true`,
    ``,
  ];

  if (ctx.isPython) {
    return {
      path: ".github/workflows/ci.yml",
      language: "yaml",
      content: [
        ...header,
        `jobs:`,
        `  test:`,
        `    name: Test (Python \${{ matrix.python }})`,
        `    runs-on: ubuntu-latest`,
        `    strategy:`,
        `      matrix:`,
        `        python: ["3.10", "3.12"]`,
        `    steps:`,
        `      - uses: actions/checkout@v4`,
        ``,
        `      - uses: actions/setup-python@v5`,
        `        with:`,
        `          python-version: \${{ matrix.python }}`,
        `          cache: pip`,
        ``,
        `      - name: Install dependencies`,
        `        run: |`,
        `          python -m pip install --upgrade pip`,
        `          ${repo.rootFiles.some((f) => /requirements/i.test(f)) ? "pip install -r requirements.txt" : "pip install -e ."}`,
        `          pip install pytest`,
        ``,
        `      - name: Run tests`,
        `        run: pytest -v`,
      ].join("\n") + "\n",
    };
  }

  if (ctx.isGo) {
    return {
      path: ".github/workflows/ci.yml",
      language: "yaml",
      content: [
        ...header,
        `jobs:`,
        `  test:`,
        `    name: Test`,
        `    runs-on: ubuntu-latest`,
        `    steps:`,
        `      - uses: actions/checkout@v4`,
        ``,
        `      - uses: actions/setup-go@v5`,
        `        with:`,
        `          go-version: "stable"`,
        `          cache: true`,
        ``,
        `      - name: Verify build`,
        `        run: go build ./...`,
        ``,
        `      - name: Run tests`,
        `        run: go test -v -race -coverprofile=coverage.out ./...`,
      ].join("\n") + "\n",
    };
  }

  if (ctx.isRust) {
    return {
      path: ".github/workflows/ci.yml",
      language: "yaml",
      content: [
        ...header,
        `jobs:`,
        `  test:`,
        `    name: Test`,
        `    runs-on: ubuntu-latest`,
        `    steps:`,
        `      - uses: actions/checkout@v4`,
        ``,
        `      - uses: dtolnay/rust-toolchain@stable`,
        ``,
        `      - uses: Swatinem/rust-cache@v2`,
        ``,
        `      - name: Build`,
        `        run: cargo build --all-targets`,
        ``,
        `      - name: Run tests`,
        `        run: cargo test --all-features`,
      ].join("\n") + "\n",
    };
  }

  // Node (default)
  const m = pm(repo);
  const setup: string[] = [];
  const install: string[] = [];
  if (m === "pnpm") {
    setup.push(`      - uses: pnpm/action-setup@v4`);
    setup.push(`        with:`, `          version: 9`, ``);
    setup.push(`      - uses: actions/setup-node@v4`, `        with:`, `          node-version: 20`, `          cache: pnpm`, ``);
    install.push(`      - name: Install dependencies`, `        run: pnpm install --frozen-lockfile`, ``);
  } else if (m === "yarn") {
    setup.push(`      - uses: actions/setup-node@v4`, `        with:`, `          node-version: 20`, `          cache: yarn`, ``);
    install.push(`      - name: Install dependencies`, `        run: yarn --frozen-lockfile`, ``);
  } else if (m === "bun") {
    setup.push(`      - uses: oven-sh/setup-bun@v2`, `        with:`, `          bun-version: latest`, ``);
    install.push(`      - name: Install dependencies`, `        run: bun install --frozen-lockfile`, ``);
  } else {
    setup.push(`      - uses: actions/setup-node@v4`, `        with:`, `          node-version: 20`, `          cache: npm`, ``);
    install.push(`      - name: Install dependencies`, `        run: npm ci`, ``);
  }

  const hasBuild = Object.keys(repo.manifest?.scripts ?? {}).includes("build");
  const lintJob =
    ctx.linter && ctx.linter !== "editorconfig"
      ? [
          ``,
          `  lint:`,
          `    name: Lint`,
          `    runs-on: ubuntu-latest`,
          `    steps:`,
          `      - uses: actions/checkout@v4`,
          ``,
          ...setup,
          ...install,
          `      - name: Lint`,
          `        run: ${lintRunCmd(ctx.linter, m)}`,
        ]
      : [];

  const testRun = ctx.testCmd ?? "npm test";
  return {
    path: ".github/workflows/ci.yml",
    language: "yaml",
    content:
      [
        ...header,
        `jobs:`,
        `  test:`,
        `    name: Test`,
        `    runs-on: ubuntu-latest`,
        `    steps:`,
        `      - uses: actions/checkout@v4`,
        ``,
        ...setup,
        ...install,
        ...(hasBuild
          ? [`      - name: Build`, `        run: ${runScript(repo, "build")}`, ``]
          : []),
        `      - name: Run tests`,
        `        run: ${testRun}`,
        ...lintJob,
      ].join("\n") + "\n",
  };
}

function lintRunCmd(linter: LinterKind, m: string): string {
  const npx = m === "bun" ? "bunx" : m === "pnpm" ? "pnpm exec" : m === "yarn" ? "yarn" : "npx";
  switch (linter) {
    case "eslint":
      return `${npx} eslint .`;
    case "biome":
      return `${npx} @biomejs/biome check .`;
    case "prettier":
    case "editorconfig":
      return `${npx} prettier --check .`;
    case "ruff":
      return `ruff check .`;
    case "flake8":
      return `flake8 .`;
    case "golangci":
      return `golangci-lint run`;
    case "rustfmt":
      return `cargo fmt --check && cargo clippy -- -D warnings`;
  }
}

function lintWorkflowFile(repo: RepoData, ctx: FixContext): FixFile {
  const linter = ctx.linter ?? (ctx.isPython ? "ruff" : ctx.isGo ? "golangci" : ctx.isRust ? "rustfmt" : "eslint");
  const jobName = "Lint";
  const lines: string[] = [
    `# Lint — enforce style on every push and PR.`,
    `name: Lint`,
    ``,
    `on:`,
    `  push:`,
    `    branches: ["${defaultBranch(repo)}"]`,
    `  pull_request:`,
    ``,
    `concurrency:`,
    `  group: lint-\${{ github.ref }}`,
    `  cancel-in-progress: true`,
    ``,
    `jobs:`,
    `  lint:`,
    `    name: ${jobName}`,
    `    runs-on: ubuntu-latest`,
    `    steps:`,
    `      - uses: actions/checkout@v4`,
    ``,
  ];
  if (linter === "eslint" || linter === "biome" || linter === "prettier" || linter === "editorconfig") {
    const m = pm(repo);
    lines.push(
      ...(m === "bun"
        ? [`      - uses: oven-sh/setup-bun@v2`, ``]
        : [`      - uses: actions/setup-node@v4`, `        with:`, `          node-version: 20`, ``]),
      `      - run: ${installCmd(repo)}`,
      ``,
      `      - name: Lint`,
      `        run: ${lintRunCmd(linter, m)}`
    );
  } else if (linter === "ruff") {
    lines.push(
      `      - uses: actions/setup-python@v5`,
      `        with:`,
      `          python-version: "3.12"`,
      ``,
      `      - run: pipx install ruff`,
      ``,
      `      - name: Lint`,
      `        run: ruff check .`
    );
  } else if (linter === "golangci") {
    lines.push(
      `      - uses: actions/setup-go@v5`,
      `        with:`,
      `          go-version: "stable"`,
      ``,
      `      - uses: golangci/golangci-lint-action@v6`,
      `        with:`,
      `          version: latest`
    );
  } else {
    lines.push(
      `      - uses: dtolnay/rust-toolchain@stable`,
      `        with:`,
      `          components: rustfmt, clippy`,
      ``,
      `      - name: Format check`,
      `        run: cargo fmt --check`,
      ``,
      `      - name: Clippy`,
      `        run: cargo clippy -- -D warnings`
    );
  }
  return { path: ".github/workflows/lint.yml", language: "yaml", content: lines.join("\n") + "\n" };
}

function coverageFix(repo: RepoData, ctx: FixContext): FixFile[] {
  const files: FixFile[] = [
    {
      path: "codecov.yml",
      language: "yaml",
      content: [
        `# Codecov — coverage thresholds and ignore rules.`,
        `# Runs automatically once the token is configured (free for public repos).`,
        `coverage:`,
        `  status:`,
        `    project:`,
        `      default:`,
        `        target: 70% # raise as coverage grows`,
        `        threshold: 5%`,
        `    patch:`,
        `      default:`,
        `        target: 80% # new code should start well covered`,
        `comment:`,
        `  layout: "reach, diff, flags, files"`,
      ].join("\n") + "\n",
    },
  ];
  if (ctx.isPython) {
    files.push({
      path: ".github/workflows/coverage.yml",
      language: "yaml",
      content: [
        `name: Coverage`,
        ``,
        `on:`,
        `  push:`,
        `    branches: ["${defaultBranch(repo)}"]`,
        `  pull_request:`,
        ``,
        `jobs:`,
        `  coverage:`,
        `    runs-on: ubuntu-latest`,
        `    steps:`,
        `      - uses: actions/checkout@v4`,
        `      - uses: actions/setup-python@v5`,
        `        with:`,
        `          python-version: "3.12"`,
        `      - run: pip install -r requirements.txt pytest pytest-cov`,
        `      - run: pytest --cov=. --cov-report=xml`,
        `      - uses: codecov/codecov-action@v4`,
        `        with:`,
        `          files: coverage.xml`,
      ].join("\n") + "\n",
    });
  } else if (ctx.isGo) {
    files.push({
      path: ".github/workflows/coverage.yml",
      language: "yaml",
      content: [
        `name: Coverage`,
        ``,
        `on:`,
        `  push:`,
        `    branches: ["${defaultBranch(repo)}"]`,
        `  pull_request:`,
        ``,
        `jobs:`,
        `  coverage:`,
        `    runs-on: ubuntu-latest`,
        `    steps:`,
        `      - uses: actions/checkout@v4`,
        `      - uses: actions/setup-go@v5`,
        `        with:`,
        `          go-version: "stable"`,
        `      - run: go test -race -coverprofile=coverage.out ./...`,
        `      - uses: codecov/codecov-action@v4`,
        `        with:`,
        `          files: coverage.out`,
      ].join("\n") + "\n",
    });
  } else if (ctx.isRust) {
    files.push({
      path: ".github/workflows/coverage.yml",
      language: "yaml",
      content: [
        `name: Coverage`,
        ``,
        `on:`,
        `  push:`,
        `    branches: ["${defaultBranch(repo)}"]`,
        `  pull_request:`,
        ``,
        `jobs:`,
        `  coverage:`,
        `    runs-on: ubuntu-latest`,
        `    steps:`,
        `      - uses: actions/checkout@v4`,
        `      - uses: dtolnay/rust-toolchain@stable`,
        `      - run: cargo install cargo-tarpaulin`,
        `      - run: cargo tarpaulin --out Xml`,
        `      - uses: codecov/codecov-action@v4`,
        `        with:`,
        `          files: cobertura.xml`,
      ].join("\n") + "\n",
    });
  } else {
    const m = pm(repo);
    const runner = m === "bun" ? "bun" : m === "pnpm" ? "pnpm" : m === "yarn" ? "yarn" : "npx";
    files.push({
      path: ".github/workflows/coverage.yml",
      language: "yaml",
      content: [
        `name: Coverage`,
        ``,
        `on:`,
        `  push:`,
        `    branches: ["${defaultBranch(repo)}"]`,
        `  pull_request:`,
        ``,
        `jobs:`,
        `  coverage:`,
        `    runs-on: ubuntu-latest`,
        `    steps:`,
        `      - uses: actions/checkout@v4`,
        `      - uses: actions/setup-node@v4`,
        `        with:`,
        `          node-version: 20`,
        `      - run: ${installCmd(repo)}`,
        `      - run: ${runner} vitest run --coverage # or: jest --coverage`,
        `      - uses: codecov/codecov-action@v4`,
        `        with:`,
        `          files: coverage/lcov.info`,
      ].join("\n") + "\n",
    });
  }
  files.push({
    path: "README.md",
    language: "markdown",
    note: "Add to the badge row under the title:",
    content: `[![Coverage](https://codecov.io/gh/${repo.owner}/${repo.repo}/graph/badge.svg)](https://codecov.io/gh/${repo.owner}/${repo.repo})`,
  });
  return files;
}

function releaseWorkflowFix(repo: RepoData, ctx: FixContext): FixFile[] {
  const common = [
    `# Release — cut a GitHub Release on every version tag.`,
    `name: Release`,
    ``,
    `on:`,
    `  push:`,
    `    tags:`,
    `      - "v*"`,
    ``,
    `permissions:`,
    `  contents: write`,
    ``,
    `jobs:`,
    `  release:`,
    `    name: Release`,
    `    runs-on: ubuntu-latest`,
    `    steps:`,
    `      - uses: actions/checkout@v4`,
    ``,
  ];
  if (ctx.isNode) {
    return [
      {
        path: ".github/workflows/release.yml",
        language: "yaml",
        content: [
          ...common,
          `      - uses: actions/setup-node@v4`,
          `        with:`,
          `          node-version: 20`,
          `          registry-url: https://registry.npmjs.org`,
          ``,
          `      - run: ${installCmd(repo)}`,
          ``,
          ...(Object.keys(repo.manifest?.scripts ?? {}).includes("build")
            ? [`      - run: ${runScript(repo, "build")}`, ``]
            : []),
          `      - name: Publish to npm`,
          `        run: npm publish --access public`,
          `        env:`,
          `          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}`,
          ``,
          `      - name: GitHub Release`,
          `        uses: softprops/action-gh-release@v2`,
          `        with:`,
          `          generate_release_notes: true`,
        ].join("\n") + "\n",
      },
      {
        path: "README.md",
        language: "markdown",
        note: "Secrets → repo Settings → Secrets and variables → Actions, add NPM_TOKEN:",
        content: `# 1. Create an npm automation token: https://www.npmjs.com/settings/<user>/tokens\n# 2. Repo Settings → Secrets and variables → Actions → New repository secret\n#    Name: NPM_TOKEN   Value: <the token>`,
      },
    ];
  }
  if (ctx.isPython) {
    return [
      {
        path: ".github/workflows/release.yml",
        language: "yaml",
        content: [
          ...common,
          `      - uses: actions/setup-python@v5`,
          `        with:`,
          `          python-version: "3.12"`,
          ``,
          `      - run: pip install build`,
          ``,
          `      - run: python -m build`,
          ``,
          `      - name: Publish to PyPI`,
          `        uses: pypa/gh-action-pypi-publish@release/v1`,
          ``,
          `      - name: GitHub Release`,
          `        uses: softprops/action-gh-release@v2`,
          `        with:`,
          `          generate_release_notes: true`,
        ].join("\n") + "\n",
      },
    ];
  }
  if (ctx.isRust) {
    return [
      {
        path: ".github/workflows/release.yml",
        language: "yaml",
        content: [
          ...common,
          `      - uses: dtolnay/rust-toolchain@stable`,
          ``,
          `      - name: Publish to crates.io`,
          `        run: cargo publish`,
          `        env:`,
          `          CARGO_REGISTRY_TOKEN: \${{ secrets.CARGO_REGISTRY_TOKEN }}`,
          ``,
          `      - name: GitHub Release`,
          `        uses: softprops/action-gh-release@v2`,
          `        with:`,
          `          generate_release_notes: true`,
        ].join("\n") + "\n",
      },
    ];
  }
  return [
    {
      path: ".github/workflows/release.yml",
      language: "yaml",
      content: [
        ...common,
        `      - name: GitHub Release`,
        `        uses: softprops/action-gh-release@v2`,
        `        with:`,
        `          generate_release_notes: true`,
      ].join("\n") + "\n",
    },
  ];
}

function dependabotFix(repo: RepoData): FixFile {
  const eco = repo.rootFiles.some((f) => /package(-lock)?\.json|yarn\.lock|pnpm-lock/i.test(f))
    ? "npm"
    : repo.rootFiles.some((f) => /requirements|pyproject|setup\.py/i.test(f))
      ? "pip"
      : repo.rootFiles.includes("Cargo.toml")
        ? "cargo"
        : repo.rootFiles.includes("go.mod")
          ? "gomod"
          : repo.rootFiles.some((f) => /pom\.xml/i.test(f))
            ? "maven"
            : repo.rootFiles.some((f) => /build\.gradle/i.test(f))
              ? "gradle"
              : "npm";
  return {
    path: ".github/dependabot.yml",
    language: "yaml",
    content: [
      `# Dependabot — weekly dependency + action version bumps.`,
      `version: 2`,
      `updates:`,
      `  - package-ecosystem: "${eco}"`,
      `    directory: "/"`,
      `    schedule:`,
      `      interval: "weekly"`,
      `    commit-message:`,
      `      prefix: "chore"`,
      `    labels:`,
      `      - "dependencies"`,
      `    open-pull-requests-limit: 5`,
      ``,
      `  - package-ecosystem: "github-actions"`,
      `    directory: "/"`,
      `    schedule:`,
      `      interval: "weekly"`,
      `    labels:`,
      `      - "ci"`,
    ].join("\n") + "\n",
  };
}

function issueTemplatesFix(repo: RepoData): FixFile[] {
  return [
    {
      path: ".github/ISSUE_TEMPLATE/bug_report.yml",
      language: "yaml",
      content: [
        `name: 🐛 Bug report`,
        `description: Report something that is broken or incorrect`,
        `labels: ["bug"]`,
        `body:`,
        `  - type: textarea`,
        `    id: description`,
        `    attributes:`,
        `      label: Description`,
        `      description: What happened, and what did you expect to happen?`,
        `    validations:`,
        `      required: true`,
        `  - type: textarea`,
        `    id: repro`,
        `    attributes:`,
        `      label: Steps to reproduce`,
        `      placeholder: |`,
        `        1. Run '...'`,
        `        2. See error`,
        `    validations:`,
        `      required: true`,
        `  - type: dropdown`,
        `    id: version`,
        `    attributes:`,
        `      label: Version`,
        `      description: Which version are you running?`,
        `    validations:`,
        `      required: true`,
        `  - type: textarea`,
        `    id: logs`,
        `    attributes:`,
        `      label: Relevant log output`,
        `      render: shell`,
      ].join("\n") + "\n",
    },
    {
      path: ".github/ISSUE_TEMPLATE/feature_request.yml",
      language: "yaml",
      content: [
        `name: ✨ Feature request`,
        `description: Suggest an idea for this project`,
        `labels: ["enhancement"]`,
        `body:`,
        `  - type: textarea`,
        `    id: problem`,
        `    attributes:`,
        `      label: Problem`,
        `      description: What are you trying to do that currently is not possible?`,
        `    validations:`,
        `      required: true`,
        `  - type: textarea`,
        `    id: proposal`,
        `    attributes:`,
        `      label: Proposed solution`,
        `    validations:`,
        `      required: true`,
        `  - type: checkboxes`,
        `    id: checklist`,
        `    attributes:`,
        `      label: Checklist`,
        `      options:`,
        `        - label: I searched existing issues before opening this one`,
        `          required: true`,
      ].join("\n") + "\n",
    },
    {
      path: ".github/ISSUE_TEMPLATE/config.yml",
      language: "yaml",
      content: [
        `blank_issues_enabled: false`,
        `contact_links:`,
        `  - name: Questions & discussions`,
        `    url: https://github.com/${repo.owner}/${repo.repo}/discussions`,
        `    about: Please ask and answer questions here.`,
      ].join("\n") + "\n",
    },
  ];
}

function prTemplateFix(): FixFile {
  return {
    path: ".github/pull_request_template.md",
    language: "markdown",
    content: [
      `## What does this PR do?`,
      ``,
      `<!-- Describe the change. Link the issue: Fixes #123 -->`,
      ``,
      `## Type of change`,
      ``,
      `- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)`,
      `- [ ] ✨ New feature (non-breaking change that adds functionality)`,
      `- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to change)`,
      `- [ ] 📝 Documentation update`,
      ``,
      `## Checklist`,
      ``,
      `- [ ] Tests added/updated and passing (\`npm test\` / project equivalent)`,
      `- [ ] Lint and format pass`,
      `- [ ] Documentation updated where needed`,
      `- [ ] I have searched for similar PRs before opening this one`,
    ].join("\n") + "\n",
  };
}

function codeOfConductFix(): FixFile {
  return {
    path: "CODE_OF_CONDUCT.md",
    language: "markdown",
    content: [
      `# Contributor Covenant Code of Conduct`,
      ``,
      `## Our Pledge`,
      ``,
      `We as members, contributors, and leaders pledge to make participation in our`,
      `community a harassment-free experience for everyone, regardless of age, body`,
      `size, visible or invisible disability, ethnicity, sex characteristics, gender`,
      `identity and expression, level of experience, education, socio-economic status,`,
      `nationality, personal appearance, race, religion, or sexual identity`,
      `and orientation.`,
      ``,
      `## Our Standards`,
      ``,
      `Examples of behavior that contributes to a positive environment include:`,
      ``,
      `- Demonstrating empathy and kindness toward other people`,
      `- Being respectful of differing opinions, viewpoints, and experiences`,
      `- Giving and gracefully accepting constructive feedback`,
      `- Accepting responsibility and apologizing to those affected by our mistakes,`,
      `  and learning from the experience`,
      `- Focusing on what is best not just for us as individuals, but for the overall`,
      `  community`,
      ``,
      `Examples of unacceptable behavior include:`,
      ``,
      `- The use of sexualized language or imagery, and sexual attention or advances of any kind`,
      `- Trolling, insulting or derogatory comments, and personal or political attacks`,
      `- Public or private harassment`,
      `- Publishing others' private information without their explicit permission`,
      `- Other conduct which could reasonably be considered inappropriate in a professional setting`,
      ``,
      `## Enforcement Responsibilities`,
      ``,
      `Community leaders are responsible for clarifying and enforcing our standards of`,
      `acceptable behavior and will take appropriate and fair corrective action in`,
      `response to any behavior that they deem inappropriate, threatening, offensive,`,
      `or harmful.`,
      ``,
      `## Scope`,
      ``,
      `This Code of Conduct applies within all community spaces, and also applies when`,
      `an individual is officially representing the community in public spaces.`,
      ``,
      `## Enforcement`,
      ``,
      `Instances of abusive, harassing, or otherwise unacceptable behavior may be`,
      `reported to the community leaders responsible for enforcement via the repository's`,
      `issue tracker (or privately via GitHub). All complaints will be reviewed and`,
      `investigated promptly and fairly.`,
      ``,
      `## Attribution`,
      ``,
      `This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org),`,
      `version 2.1, available at`,
      `https://www.contributor-covenant.org/version/2/1/code_of_conduct.html.`,
    ].join("\n") + "\n",
  };
}

function securityPolicyFix(repo: RepoData): FixFile {
  return {
    path: "SECURITY.md",
    language: "markdown",
    content: [
      `# Security Policy`,
      ``,
      `## Supported Versions`,
      ``,
      `| Version | Supported          |`,
      `| ------- | ------------------ |`,
      `| latest  | ✅                 |`,
      `| older   | ❌ upgrade first   |`,
      ``,
      `## Reporting a Vulnerability`,
      ``,
      `**Please do not report security vulnerabilities through public GitHub issues.**`,
      ``,
      `Instead, use GitHub's private vulnerability reporting:`,
      ``,
      `1. Go to **Security → Advisories → Report a vulnerability** at`,
      `   https://github.com/${repo.owner}/${repo.repo}/security/advisories/new`,
      `2. Include steps to reproduce, affected versions, and impact.`,
      `3. You will receive a response within 72 hours.`,
      ``,
      `We will credit reporters in the fix release notes unless they prefer to remain anonymous.`,
    ].join("\n") + "\n",
  };
}

function fundingFix(repo: RepoData): FixFile {
  return {
    path: ".github/FUNDING.yml",
    language: "yaml",
    content: [
      `# Funding — the "💚 Sponsor" button on the repo page.`,
      `# Keep the platforms you actually use; delete the rest.`,
      `github: [${repo.owner}]`,
      `# patreon: your-patreon`,
      `# open_collective: your-collective`,
      `# ko-fi: your-kofi`,
      `# buy_me_a_coffee: your-handle`,
    ].join("\n") + "\n",
  };
}

function repoMetaFix(repo: RepoData, ctx: FixContext): FixFile {
  const description = firstSentence(
    repo.manifest?.description || repo.description,
    "<one line: what this project does and for whom>"
  );
  const topics = ctx.keywords.map((k) => `--add-topic ${k}`).join(" ");
  return {
    path: "bash",
    language: "bash",
    note: "Requires the GitHub CLI (one-time: `gh auth login`). Run from anywhere:",
    content: [
      `# Set the description (shown on the repo page, search results and embeds)`,
      `gh repo edit ${repo.owner}/${repo.repo} --description "${description.replace(/"/g, "")}"`,
      ``,
      `# Set topics (drive GitHub/Google discovery — up to 20 allowed)`,
      `gh repo edit ${repo.owner}/${repo.repo} ${topics}`,
    ].join("\n") + "\n",
  };
}

function licenseFileFix(repo: RepoData, ctx: FixContext): FixFile {
  const spdx = ctx.licenseSpdx;
  const holder = repo.owner;
  const mit = [
    `MIT License`,
    ``,
    `Copyright (c) ${ctx.year} ${holder}`,
    ``,
    `Permission is hereby granted, free of charge, to any person obtaining a copy`,
    `of this software and associated documentation files (the "Software"), to deal`,
    `in the Software without restriction, including without limitation the rights`,
    `to use, copy, modify, merge, publish, distribute, sublicense, and/or sell`,
    `copies of the Software, and to permit persons to whom the Software is`,
    `furnished to do so, subject to the following conditions:`,
    ``,
    `The above copyright notice and this permission notice shall be included in all`,
    `copies or substantial portions of the Software.`,
    ``,
    `THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR`,
    `IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,`,
    `FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE`,
    `AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER`,
    `LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,`,
    `OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE`,
    `SOFTWARE.`,
  ].join("\n") + "\n";

  if (spdx && spdx !== "MIT" && spdx !== "NOASSERTION") {
    return {
      path: "LICENSE",
      language: "text",
      note: `Repo metadata declares ${spdx}. Commit its official text (linked below) — an MIT draft is provided only as a fallback if you intend to relicense:`,
      content: `MIT License\n\nCopyright (c) ${ctx.year} ${holder}\n\n${mit.split("\n").slice(4).join("\n")}\n# NOTE: metadata declares ${spdx}. If you intend ${spdx}, replace this file with the\n# official text: https://spdx.org/licenses/${spdx}.html`,
    };
  }
  return { path: "LICENSE", language: "text", content: mit };
}

function contributingFileFix(repo: RepoData, ctx: FixContext): FixFile {
  return {
    path: "CONTRIBUTING.md",
    language: "markdown",
    content: [
      `# Contributing to ${repo.repo}`,
      ``,
      `First off — thank you. Every issue report, doc fix and PR makes this project better.`,
      ``,
      `## Development setup`,
      ``,
      `Prerequisites:`,
      ctx.isNode
        ? `- **Node.js ≥ 20** and the **${pm(repo)}** package manager`
        : ctx.isPython
          ? `- **Python ≥ 3.10** and **pip**`
          : ctx.isGo
            ? `- **Go ≥ 1.21**`
            : ctx.isRust
              ? `- **Rust (stable, via rustup)**`
              : `- The toolchain for this language`,
      ``,
      "```bash",
      `git clone ${repo.url}.git`,
      `cd ${repo.repo}`,
      ctx.installCmd,
      ...(ctx.testCmd ? [``, `# run the test suite`, ctx.testCmd] : []),
      "```",
      ``,
      `## How to contribute`,
      ``,
      `1. **Open an issue first** for anything non-trivial — we would rather align before you invest hours.`,
      `2. Fork the repo and create a branch: \`git checkout -b feat/my-feature\`.`,
      `3. Make your change, with tests.`,
      `4. Run the test suite and linter locally — CI will run them again.`,
      `5. Open a pull request using the PR template.`,
      ``,
      `## Commit convention`,
      ``,
      `We follow [Conventional Commits](https://www.conventionalcommits.org):`,
      ``,
      "- `feat: add X` — new feature",
      "- `fix: correct Y` — bug fix",
      "- `docs: improve Z` — documentation",
      "- `chore: bump deps` — maintenance",
      ``,
      `## Pull request checklist`,
      ``,
      `- [ ] Tests pass locally`,
      `- [ ] New behavior is documented (README / docs/)`,
      `- [ ] No secrets or large binaries committed`,
      ``,
      `## Code of Conduct`,
      ``,
      `By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).`,
    ].filter(Boolean).join("\n") + "\n",
  };
}

function changelogFileFix(repo: RepoData): FixFile {
  const added = repo.commits.filter((c) => c.type === "feat").slice(0, 8).map((c) => `- ${c.message} (${c.sha.slice(0, 7)})`);
  const fixed = repo.commits.filter((c) => c.type === "fix").slice(0, 8).map((c) => `- ${c.message} (${c.sha.slice(0, 7)})`);
  const changed = repo.commits
    .filter((c) => ["refactor", "perf", "chore"].includes(c.type))
    .slice(0, 5)
    .map((c) => `- ${c.message} (${c.sha.slice(0, 7)})`);
  return {
    path: "CHANGELOG.md",
    language: "markdown",
    note: "Seeded from the real commit history — keep it updated per release:",
    content: [
      `# Changelog`,
      ``,
      `All notable changes to this project are documented in this file.`,
      ``,
      `The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),`,
      `and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).`,
      ``,
      `## [Unreleased]`,
      ...(added.length ? [``, `### Added`, ...added] : []),
      ...(fixed.length ? [``, `### Fixed`, ...fixed] : []),
      ...(changed.length ? [``, `### Changed`, ...changed] : []),
      ...(added.length || fixed.length || changed.length
        ? []
        : [``, `### Added`, `- Initial public release (seed this section from your git history)`]),
    ].join("\n") + "\n",
  };
}

function docsFolderFix(repo: RepoData): FixFile {
  return {
    path: "docs/ARCHITECTURE.md",
    language: "markdown",
    content: [
      `# Architecture`,
      ``,
      `A short tour of how ${repo.repo} is organized, for contributors who want the 5-minute version.`,
      ``,
      `## High-level flow`,
      ``,
      "```mermaid",
      `graph LR`,
      `  A[Input] --> B[Core]`,
      `  B --> C[Output]`,
      "```",
      ``,
      `## Repository layout`,
      ``,
      `| Path | Responsibility |`,
      `| --- | --- |`,
      ...(repo.detected.frameworks.length ? [`| app/ or src/ | ${repo.detected.frameworks.join(", ")} application code |`] : ["| src/ | application code |"]),
      `| tests/ | automated test suite |`,
      `| docs/ | you are here — long-form documentation |`,
      ``,
      `## Key design decisions`,
      ``,
      `- Record important decisions here (an "ADR": Decision, Context, Consequences).`,
      ``,
      `## More docs`,
      ``,
      `- [README](../README.md) — quickstart`,
      `- [CONTRIBUTING](../CONTRIBUTING.md) — how to ship a change`,
    ].join("\n") + "\n",
  };
}

function testSetupFix(repo: RepoData, ctx: FixContext): FixFile[] {
  if (ctx.isPython) {
    return [
      {
        path: "tests/test_smoke.py",
        language: "python",
        note: "First real test — replace the placeholder assertion with a real import from your package:",
        content: [
          `"""Smoke test: the package imports and its public API is discoverable."""`,
          `import importlib`,
          ``,
          `def test_package_imports():`,
          `    module = importlib.import_module("${repo.repo.replace(/-/g, "_")}")`,
          `    assert module is not None`,
          ``,
          `def test_placeholder():`,
          `    # TODO: replace with real behavior tests`,
          `    assert sum([1, 2, 3]) == 6`,
        ].join("\n") + "\n",
      },
      {
        path: "pytest.ini",
        language: "ini",
        content: [`[pytest]`, `testpaths = tests`, `addopts = -ra --strict-markers`].join("\n") + "\n",
      },
      {
        path: "README.md",
        language: "markdown",
        note: "Document the command:",
        content: "```bash\npip install pytest\npytest\n```",
      },
    ];
  }
  if (ctx.isGo) {
    return [
      {
        path: "main_test.go",
        language: "go",
        note: "Go's test runner is built in — this gives CI something real to run:",
        content: [
          `package main`,
          ``,
          `import "testing"`,
          ``,
          `func TestPlaceholder(t *testing.T) {`,
          `     // TODO: replace with real behavior tests`,
          `     if 1+1 != 2 {`,
          `             t.Fatal("math is broken")`,
          `     }`,
          `}`,
        ].join("\n") + "\n",
      },
      {
        path: "README.md",
        language: "markdown",
        note: "Document the command:",
        content: "```bash\ngo test ./...\n```",
      },
    ];
  }
  if (ctx.isRust) {
    return [
      {
        path: "tests/integration_test.rs",
        language: "rust",
        note: "Integration test — `cargo test` picks it up automatically:",
        content: [
          `// Integration tests live in tests/ and use the library as an external crate.`,
          `// TODO: replace with real behavior tests against your public API.`,
          `#[test]`,
          `fn placeholder() {`,
          `    assert_eq!(2 + 2, 4);`,
          `}`,
        ].join("\n") + "\n",
      },
    ];
  }
  const devInstall = installCmd(repo) === "bun install"
    ? "bun add -d vitest"
    : pm(repo) === "pnpm"
      ? "pnpm add -D vitest"
      : pm(repo) === "yarn"
        ? "yarn add -D vitest"
        : "npm install --save-dev vitest";
  return [
    {
      path: "tests/example.test.ts",
      language: "typescript",
      note: "First real test with Vitest — point the import at a real exported function:",
      content: [
        `import { describe, expect, it } from "vitest";`,
        ``,
        `describe("smoke", () => {`,
        `  it("runs the suite", () => {`,
        `    // TODO: import a real exported function and assert its behavior`,
        `    expect(1 + 1).toBe(2);`,
        `  });`,
        `});`,
      ].join("\n") + "\n",
    },
    {
      path: "vitest.config.ts",
      language: "typescript",
      content: [
        `import { defineConfig } from "vitest/config";`,
        ``,
        `export default defineConfig({`,
        `  test: {`,
        `    include: ["tests/**/*.test.{ts,tsx,js,jsx}"],`,
        `    environment: "node",`,
        `  },`,
        `});`,
      ].join("\n") + "\n",
    },
    {
      path: "bash",
      language: "bash",
      note: "Install the runner and wire the script:",
      content: [devInstall, `# then merge into package.json scripts:`, `"test": "vitest run"`].join("\n"),
    },
  ];
}

function testScriptFix(repo: RepoData, ctx: FixContext): FixFile {
  if (ctx.isNode) {
    return {
      path: "package.json",
      language: "json",
      note: "Merge into the existing scripts block (runner name matches your detected tooling):",
      content: JSON.stringify(
        {
          scripts: {
            test: ctx.testCmd ? ctx.testCmd.replace(/^(npm run|yarn|pnpm|bun run)\s+/, "") || "vitest run" : "vitest run",
          },
        },
        null,
        2
      ),
    };
  }
  return {
    path: "Makefile",
    language: "makefile",
    note: "One command (`make test`) that CI and contributors both use:",
    content: [
      `.PHONY: test`,
      ``,
      `test:`,
      ctx.isPython ? `\tpytest -v` : ctx.isGo ? `\tgo test ./...` : `\tcargo test`,
    ].join("\n") + "\n",
  };
}

function ciBadgeFix(repo: RepoData, ctx: FixContext): FixFile {
  return {
    path: "README.md",
    language: "markdown",
    note: "Add to the badge row under the title (workflow file must exist first):",
    content: [
      `[![CI](https://github.com/${repo.owner}/${repo.repo}/actions/workflows/${ctx.workflowFile}/badge.svg)](https://github.com/${repo.owner}/${repo.repo}/actions/workflows/${ctx.workflowFile})`,
    ].join("\n") + "\n",
  };
}

function readmeScaffoldFix(repo: RepoData, ctx: FixContext): FixFile {
  const name = repo.repo;
  const desc = firstSentence(repo.description || repo.manifest?.description, "<one line: what this does and for whom>");
  const badges = [
    `[![License](https://img.shields.io/github/license/${repo.owner}/${name})](LICENSE)`,
    `[![Stars](https://img.shields.io/github/stars/${repo.owner}/${name})](https://github.com/${repo.owner}/${name}/stargazers)`,
    `[![CI](https://github.com/${repo.owner}/${name}/actions/workflows/${ctx.workflowFile}/badge.svg)](https://github.com/${repo.owner}/${name}/actions/workflows/${ctx.workflowFile})`,
  ].join(" ");
  const install = ctx.isPython ? "pip install <package>" : ctx.isGo ? "go get github.com/" + repo.owner + "/" + name : ctx.isRust ? "cargo add " + name : runScript(repo, "install").replace(/run install/, "install");
  return {
    path: "README.md",
    language: "markdown",
    content: [
      `# ${name}`,
      ``,
      `> ${desc}`,
      ``,
      badges,
      ``,
      `## About`,
      ``,
      `${desc}. This README covers what it is, how to install it, and how to run it — everything else lives in [docs/](docs/).`,
      ``,
      `## Installation`,
      ``,
      "```bash",
      ctx.isNode ? `# from a published release:` : `# clone and install:`,
      `git clone ${repo.url}.git`,
      `cd ${name}`,
      ctx.isNode ? installCmd(repo) : install,
      "```",
      ``,
      `## Usage`,
      ``,
      "```bash",
      ctx.testCmd && Object.keys(repo.manifest?.scripts ?? {}).includes("dev")
        ? runScript(repo, "dev")
        : ctx.isPython
          ? "python main.py"
          : ctx.isGo
            ? "go run ."
            : ctx.isRust
              ? "cargo run"
              : "<start command>",
      "```",
      ``,
      `## Testing`,
      ``,
      "```bash",
      ctx.testCmd ?? "<test command>",
      "```",
      ``,
      `## Contributing`,
      ``,
      `PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup and conventions.`,
      ``,
      `## License`,
      ``,
      `${ctx.licenseSpdx ?? "MIT"} — see [LICENSE](LICENSE).`,
    ].join("\n") + "\n",
  };
}

function readmeUpgradeFix(repo: RepoData, ctx: FixContext): FixFile {
  const name = repo.repo;
  const desc = firstSentence(repo.description || repo.manifest?.description, "<one line: what this does and for whom>");
  return {
    path: "README.md",
    language: "markdown",
    note: "A 400+ word expansion skeleton — or switch to the README Upgrader mode for the LLM-forged 100/100 version:",
    content: [
      `# ${name}`,
      ``,
      `> ${desc}`,
      ``,
      `[![License](https://img.shields.io/github/license/${repo.owner}/${name})](LICENSE)`,
      ``,
      `## The Problem`,
      ``,
      `<2-4 sentences: the concrete pain your users hit today, with an example. Name the tool they currently duct-tape together instead.>`,
      ``,
      `## The Solution`,
      ``,
      `<2-4 sentences: what ${name} does differently, stated as outcomes ("X in one command", "no config required").>`,
      ``,
      `## Features`,
      ``,
      `| Feature | What it means for you |`,
      `| --- | --- |`,
      `| <feature 1> | <benefit, not implementation> |`,
      `| <feature 2> | <benefit> |`,
      `| <feature 3> | <benefit> |`,
      ``,
      `## Tech Stack`,
      ``,
      `| Layer | Technology |`,
      `| --- | --- |`,
      `| Language | ${repo.detected.languages.map((l) => l.name).join(", ") || "<language>"} |`,
      ...(repo.detected.frameworks.length ? [`| Frameworks | ${repo.detected.frameworks.join(", ")} |`] : []),
      ...(repo.detected.databases.length ? [`| Data | ${repo.detected.databases.join(", ")} |`] : []),
      ``,
      `## Quick Start`,
      ``,
      "```bash",
      `git clone ${repo.url}.git`,
      `cd ${name}`,
      ctx.installCmd,
      ...(ctx.testCmd ? [ctx.testCmd] : []),
      "```",
      ``,
      `## Usage`,
      ``,
      `<copy-paste runnable example + expected output>`,
      ``,
      `## Environment Variables`,
      ``,
      `| Variable | Required | Description |`,
      `| --- | --- | --- |`,
      `| \`<VAR>\` | no | <what it controls> |`,
      ``,
      `## Testing`,
      ``,
      "```bash",
      ctx.testCmd ?? "<test command>",
      "```",
      ``,
      `## FAQ`,
      ``,
      `**Q: <question users actually search?>**  `,
      `A: <40-60 word direct answer.>`,
      ``,
      `## Roadmap`,
      ``,
      `- [ ] <next step>`,
      `- [ ] <next step>`,
      ``,
      `## Contributing`,
      ``,
      `See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome!`,
      ``,
      `## License`,
      ``,
      `${ctx.licenseSpdx ?? "MIT"} — see [LICENSE](LICENSE).`,
    ].join("\n") + "\n",
  };
}

function lintConfigFix(repo: RepoData, ctx: FixContext): FixFile[] {
  if (ctx.isPython) {
    return [
      {
        path: "ruff.toml",
        language: "toml",
        content: [
          `# Ruff — Python lint + format in one tool.`,
          `line-length = 120`,
          `target-version = "py310"`,
          ``,
          `[lint]`,
          `select = ["E", "F", "I", "UP", "B", "SIM"]`,
          `ignore = ["E501"]`,
        ].join("\n") + "\n",
      },
      {
        path: "bash",
        language: "bash",
        note: "Run it:",
        content: "pipx install ruff\nruff check .\nruff format .",
      },
    ];
  }
  if (ctx.isGo) {
    return [
      {
        path: ".golangci.yml",
        language: "yaml",
        content: [
          `# golangci-lint — aggregate Go linter.`,
          `linters:`,
          `  enable:`,
          `    - govet`,
          `    - errcheck`,
          `    - staticcheck`,
          `    - unused`,
          `    - misspell`,
          `    - revive`,
        ].join("\n") + "\n",
      },
    ];
  }
  if (ctx.isRust) {
    return [
      {
        path: "rustfmt.toml",
        language: "toml",
        content: [`edition = "2021"`, `max_width = 120`].join("\n") + "\n",
      },
      {
        path: "bash",
        language: "bash",
        note: "Run it:",
        content: "cargo fmt\ncargo clippy --fix --allow-dirty",
      },
    ];
  }
  const ts = repo.rootFiles.includes("tsconfig.json");
  return [
    {
      path: "eslint.config.mjs",
      language: "javascript",
      content: [
        `// ESLint flat config — run with: npx eslint .`,
        `import js from "@eslint/js";${ts ? `\nimport tseslint from "typescript-eslint";` : ""}`,
        ``,
        `export default [`,
        `  js.configs.recommended,`,
        ...(ts ? [`  ...tseslint.configs.recommended,`] : []),
        `  {`,
        `    ignores: ["node_modules/", "dist/", "build/", "coverage/"],`,
        `    rules: {`,
        `      "no-unused-vars": "error",`,
        `      eqeqeq: ["error", "smart"],`,
        `    },`,
        `  },`,
        `];`,
      ].join("\n") + "\n",
    },
    {
      path: ".prettierrc.json",
      language: "json",
      content: JSON.stringify({ semi: true, singleQuote: false, printWidth: 120, trailingComma: "all" }, null, 2),
    },
  ];
}

function typingConfigFix(repo: RepoData, ctx: FixContext): FixFile[] {
  if (ctx.isPython) {
    return [
      {
        path: "mypy.ini",
        language: "ini",
        content: [`[mypy]`, `python_version = 3.10`, `warn_unused_ignores = True`, `warn_redundant_casts = True`, `disallow_untyped_defs = False # tighten to True when annotations land`].join("\n") + "\n",
      },
      {
        path: "bash",
        language: "bash",
        note: "Run it:",
        content: "pipx install mypy\nmypy .",
      },
    ];
  }
  return [
    {
      path: "tsconfig.json",
      language: "json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "bundler",
            strict: true,
            noUncheckedIndexedAccess: true,
            noEmit: true,
            skipLibCheck: true,
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
          },
          include: ["src", "tests"],
        },
        null,
        2
      ),
    },
  ];
}

function metadataPatchFix(repo: RepoData, ctx: FixContext): FixFile[] {
  const name = repo.manifest?.name ?? repo.repo;
  const desc = firstSentence(repo.manifest?.description || repo.description, "<one-line description>");
  const keywords = (repo.manifest?.keywords?.length ? repo.manifest.keywords : ctx.keywords).slice(0, 8);
  if (ctx.isNode) {
    return [
      {
        path: "package.json",
        language: "json",
        note: "Merge these fields into your existing package.json (missing ones are prefilled from repo facts):",
        content: JSON.stringify(
          {
            name,
            version: repo.manifest?.version ?? "1.0.0",
            description: desc,
            keywords,
            license: ctx.licenseSpdx ?? "MIT",
            repository: { type: "git", url: `git+https://github.com/${repo.owner}/${repo.repo}.git` },
            bugs: { url: `https://github.com/${repo.owner}/${repo.repo}/issues` },
            homepage: repo.homepage ?? `https://github.com/${repo.owner}/${repo.repo}#readme`,
            author: repo.manifest?.author ?? repo.owner,
            engines: { node: ">=20" },
          },
          null,
          2
        ),
      },
    ];
  }
  if (ctx.isPython) {
    return [
      {
        path: "pyproject.toml",
        language: "toml",
        content: [
          `[project]`,
          `name = "${name}"`,
          `version = "1.0.0"`,
          `description = "${desc.replace(/"/g, "'")}"`,
          `license = { text = "${ctx.licenseSpdx ?? "MIT"}" }`,
          `authors = [{ name = "${repo.owner}" }]`,
          `readme = "README.md"`,
          `requires-python = ">=3.10"`,
          ``,
          `[project.urls]`,
          `Repository = "${repo.url}"`,
          `Issues = "${repo.url}/issues"`,
        ].join("\n") + "\n",
      },
    ];
  }
  return [
    {
      path: "Cargo.toml",
      language: "toml",
      content: [
        `[package]`,
        `name = "${name}"`,
        `version = "1.0.0"`,
        `description = "${desc.replace(/"/g, "'")}"`,
        `license = "${ctx.licenseSpdx ?? "MIT"}"`,
        `repository = "${repo.url}"`,
        `authors = ["${repo.owner}"]`,
        `readme = "README.md"`,
      ].join("\n") + "\n",
    },
  ];
}

function examplesStarterFix(repo: RepoData): FixFile {
  const name = repo.repo;
  if (repo.rootFiles.map((f) => f.toLowerCase()).includes("go.mod")) {
    return {
      path: "examples/basic/main.go",
      language: "go",
      note: "Runnable with `go run ./examples/basic` — point the import at your real package:",
      content: [
        `package main`,
        ``,
        `import (`,
        `\t"fmt"`,
        ``,
        `\t// TODO: import your real package:`,
        `\t// "github.com/${repo.owner}/${repo.repo}"`,
        `)`,
        ``,
        `func main() {`,
        `\tfmt.Println("basic ${name} example")`,
        `}`,
      ].join("\n") + "\n",
    };
  }
  if (repo.rootFiles.map((f) => f.toLowerCase()).includes("cargo.toml")) {
    return {
      path: "examples/basic.rs",
      language: "rust",
      note: "Runnable with `cargo run --example basic` — use your real crate API:",
      content: [
        `fn main() {`,
        `    // TODO: use your real crate API:`,
        `    println!("basic ${name} example");`,
        `}`,
      ].join("\n") + "\n",
    };
  }
  if (repo.rootFiles.some((f) => /requirements|pyproject|setup\.py/i.test(f))) {
    return {
      path: "examples/basic.py",
      language: "python",
      note: "Runnable with `python examples/basic.py` — point the import at your real module:",
      content: [
        `"""Minimal ${name} example."""`,
        ``,
        `# TODO: import your real package:`,
        `# from ${name.replace(/-/g, "_")} import ...`,
        ``,
        `def main() -> None:`,
        `    print("basic ${name} example")`,
        ``,
        `if __name__ == "__main__":`,
        `    main()`,
      ].join("\n") + "\n",
    };
  }
  return {
    path: "examples/basic.mjs",
    language: "javascript",
    note: "Runnable with `node examples/basic.mjs` — point the import at your real module:",
    content: [
      `// Minimal ${name} example.`,
      `// TODO: import your real package:`,
      `// import { ... } from "${name}";`,
      ``,
      `console.log("basic ${name} example");`,
    ].join("\n") + "\n",
  };
}

function gitignoreFix(ctx: FixContext): FixFile {
  const sections: string[] = [
    `# Dependencies`,
    ...(ctx.isNode ? [`node_modules/`, ``] : ctx.isPython ? [`.venv/`, `venv/`, `__pycache__/`, `*.egg-info/`, ``] : ctx.isGo ? [`vendor/`, ``] : ctx.isRust ? [`/target`, ``] : []),
  ];
  if (ctx.isNode) sections.push(`# Build output`, `dist/`, `build/`, `*.tsbuildinfo`, ``);
  if (ctx.isPython) sections.push(`# Build output`, `dist/`, `build/`, ``);
  sections.push(
    `# Test & coverage`,
    `coverage/`,
    `.nyc_output/`,
    ``,
    `# Environment & secrets`,
    `.env`,
    `.env.*`,
    `!.env.example`,
    ``,
    `# Logs`,
    `*.log`,
    `logs/`,
    ``,
    `# Editor & OS`,
    `.idea/`,
    `.vscode/`,
    `!.vscode/extensions.json`,
    `.DS_Store`,
    `Thumbs.db`
  );
  return { path: ".gitignore", language: "gitignore", content: sections.join("\n") + "\n" };
}

// ── Builder registry ─────────────────────────────────────────────────────────

export const FIX_BUILDERS: Record<string, FixBuilder> = {
  "ci-workflow": (repo, ctx) => [ciWorkflowFile(repo, ctx)],
  "test-ci": (repo, ctx) => [ciWorkflowFile(repo, ctx)],
  "auto-ci": (repo, ctx) => [ciWorkflowFile(repo, ctx)],
  "lint-enforcement": (repo, ctx) => [lintWorkflowFile(repo, ctx)],
  coverage: coverageFix,
  "release-workflow": releaseWorkflowFix,
  dependabot: (repo) => [dependabotFix(repo)],
  "issue-templates": issueTemplatesFix,
  "pr-template": () => [prTemplateFix()],
  "code-of-conduct": () => [codeOfConductFix()],
  "security-policy": (repo) => [securityPolicyFix(repo)],
  funding: (repo) => [fundingFix(repo)],
  "repo-meta": (repo, ctx) => {
    const f = repoMetaFix(repo, ctx);
    return Array.isArray(f) ? f : [f];
  },
  "license-file": (repo, ctx) => [licenseFileFix(repo, ctx)],
  "contributing-file": (repo, ctx) => [contributingFileFix(repo, ctx)],
  "changelog-file": (repo) => [changelogFileFix(repo)],
  "docs-folder": (repo) => [docsFolderFix(repo)],
  "test-setup": testSetupFix,
  "test-script": (repo, ctx) => [testScriptFix(repo, ctx)],
  "ci-badge": (repo, ctx) => [ciBadgeFix(repo, ctx)],
  "readme-scaffold": (repo, ctx) => [readmeScaffoldFix(repo, ctx)],
  "readme-upgrade": (repo, ctx) => [readmeUpgradeFix(repo, ctx)],
  "lint-config": lintConfigFix,
  "typing-config": typingConfigFix,
  "metadata-patch": metadataPatchFix,
  "examples-starter": (repo) => [examplesStarterFix(repo)],
  gitignore: (_repo, ctx) => [gitignoreFix(ctx)],
  // ── New rubric builders (security · devops · hygiene) ──────────────────────
  "env-example": (repo) => [envExampleFix(repo)],
  "env-protection": (repo) => [envProtectionFix(repo)],
  editorconfig: () => [editorconfigFix()],
  "node-version": () => [nodeVersionFix()],
  codeql: (repo) => [codeqlWorkflowFix(repo)],
  "dockerfile-hardening": (repo) => [dockerfileFix(repo)],
  "docker-compose": () => [dockerComposeFix()],
  dockerignore: () => [dockerignoreFix()],
  codeowners: (repo) => [codeownersFix(repo)],
  // secrets-cleanup / lockfile-guidance / workflow-pinning / audit-script are
  // manual-guidance fixes (FIX_META.manualSteps) — no file templates.
};

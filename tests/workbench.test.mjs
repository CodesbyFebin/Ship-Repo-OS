import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { auditWorkbench, CHECKS } from "../src/lib/shipos/workbench/checks.mjs";
import { makeSnapshot, normalizePath, parseIdentity, readmePath, resolveLink } from "../src/lib/shipos/workbench/evidence.mjs";
import { buildPack } from "../src/lib/shipos/workbench/pack.mjs";
import { runTool, TOOLS } from "../src/lib/shipos/workbench/tools.mjs";

const identity = parseIdentity("https://github.com/octocat/Hello-World.git");
const cli = new URL("../scripts/workbench.mjs", import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
const finding = (audit, id) => audit.findings.find((entry) => entry.id === id);

test("all three catalogs have distinct, usable entries", () => {
  assert.equal(new Set(CHECKS.map(({ id }) => id)).size, 40);
  const pack = buildPack(identity, "A practical release tool");
  assert.equal(new Set(pack.map(({ path }) => path)).size, 30);
  assert.ok(pack.every(({ content }) => content.length > 30));
  assert.equal(new Set(TOOLS.map(({ id }) => id)).size, 30);
  for (const { id, example } of TOOLS) assert.ok(runTool(id, example).trim(), id);
});

test("missing evidence never passes and missing inventory differs from an empty repo", () => {
  const partial = auditWorkbench(makeSnapshot());
  assert.equal(partial.score, 0);
  assert.equal(partial.coverage, 0);
  assert.equal(partial.unverified, 40);
  const empty = auditWorkbench(makeSnapshot({ complete: true }));
  assert.equal(finding(empty, "readme").status, "fail");
  assert.equal(finding(empty, "pinned-actions").status, "n/a");
  assert.equal(finding(empty, "social-preview").status, "unknown");
});

test("a complete set of supported signals can earn a measured 100", () => {
  const workflow = "on:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  ci:\n    steps:\n      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683\n        with:\n          persist-credentials: false\n";
  const audit = auditWorkbench(makeSnapshot({
    complete: true,
    paths: ["LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SUPPORT.md", ".github/CODEOWNERS",
      ".github/ISSUE_TEMPLATE/bug.yml", ".github/ISSUE_TEMPLATE/feature.yml", ".github/pull_request_template.md",
      "SECURITY.md", ".github/dependabot.yml", ".env.example", "tests/basic.test.js", "bun.lock", ".editorconfig",
      "media/banner.svg", "media/preview.gif", "media/demo.mp4", "media/demo.vtt"],
    files: {
      "README.md": "# Title\n\n## Overview\n\n## Quick start\n\n## Usage\n\n## Architecture\n\n## License\n\n![Project banner](media/banner.svg)\n",
      ".github/workflows/check.yml": workflow,
    },
    metadata: {
      description: "A useful example project for maintainers", topics: ["example", "developer-tools", "github"],
      homepage: "https://example.org", protectedBranch: true, releaseCount: 1, profileReadme: true, socialPreview: true,
    },
  }));
  assert.deepEqual([audit.score, audit.coverage, audit.passed], [100, 100, 40]);
});

test("README precedence, relative links, action pins and permissions use supplied evidence", () => {
  const workflow = "on:\n  pull_request:\npermissions: write-all\njobs:\n  ci:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n      - run: echo ok\n";
  const files = {
    ".github/README.md": "# Effective\n\n[OK](../guide.md) [Bad](missing.md)",
    "README.md": "# Root\n\n## Quick start",
    ".github/workflows/test.yml": workflow,
  };
  const snapshot = makeSnapshot({ paths: ["guide.md"], files, complete: true });
  assert.equal(readmePath(snapshot.inventory), ".github/README.md");
  const audit = auditWorkbench(snapshot);
  for (const id of ["relative-links", "install", "pinned-actions", "workflow-permissions", "checkout-credentials"]) assert.equal(finding(audit, id).status, "fail");
  assert.equal(finding(audit, "pr-trigger").status, "pass");
  assert.equal(resolveLink("README.md", "../outside"), "");
  assert.equal(resolveLink("docs/README.md", "../media/my%20image.png"), "media/my image.png");
  assert.equal(normalizePath("C:\\outside"), "");
});

test("pack flags collisions and escapes user text in SVG and Markdown", () => {
  const pack = buildPack(identity, "<script> & [link](javascript:evil)", ["readme.md"]);
  assert.equal(pack.find(({ id }) => id === "repository-readme").conflict, true);
  const svg = pack.find(({ id }) => id === "banner").content;
  assert.ok(svg.includes("&lt;script&gt; &amp;"));
  assert.ok(!svg.includes("<script>"));
  assert.match(pack.find(({ id }) => id === "profile-readme").content, /&lt;script&gt;/);
  assert.throws(() => parseIdentity("https://github.com.evil.example/owner/repo"), /owner\/repo/);
});

test("utilities validate inputs and preserve sensitive-value redaction", () => {
  assert.equal(runTool("semver-bump", "1.2.3 minor"), "1.3.0");
  assert.throws(() => runTool("semver-bump", "1.02.3 patch"), /semantic version/);
  assert.throws(() => runTool("compare-url", "a/b main ;touch"), /branch/);
  assert.equal(runTool("dotenv-example", "TOKEN=secret\nexport PORT=3"), "TOKEN=\nPORT=");
  assert.deepEqual(JSON.parse(runTool("dotenv-diff", "TOKEN=one\n---\nPORT=two")), { missing: ["TOKEN"], extra: ["PORT"] });
  assert.match(runTool("vtt", "3\n<test>"), /00:00:03\.000\n&lt;test&gt;/);
});

test("CLI audits working-tree files and never overwrites an existing export", () => {
  const root = mkdtempSync(join(tmpdir(), "shipos-test-"));
  try {
    const repo = join(root, "repo");
    mkdirSync(repo);
    execFileSync("git", ["init", "-q", repo]);
    writeFileSync(join(repo, "README.md"), "# Title\n\n## Quick start\n");
    const scored = run("audit", repo, "--minimum", "100");
    assert.equal(scored.status, 2, scored.stderr);
    assert.equal(finding(JSON.parse(scored.stdout), "install").status, "pass");
    const out = join(root, "pack");
    const params = ["pack", "--repo", identity.slug, "--out", out, "--against", repo];
    assert.equal(run(...params).status, 0);
    assert.ok(readFileSync(join(out, "README.md"), "utf8").startsWith("# Hello-World"));
    assert.equal(JSON.parse(readFileSync(join(out, "SHIPOS-MANIFEST.json"), "utf8")).artifacts.length, 30);
    writeFileSync(join(out, "README.md"), "retain me");
    assert.equal(run(...params).status, 1);
    assert.equal(readFileSync(join(out, "README.md"), "utf8"), "retain me");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

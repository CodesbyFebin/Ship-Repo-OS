import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ACCEPTANCE_GATES,
  ENGINEERING_INDEX_WEIGHTS,
  HMAC_KEY_ENV,
  applyHardGates,
  buildQualityProfile,
  createReceipt,
  evaluateG0,
  gateStatusReport,
  hasValidEvidence,
  makeFinding,
  pointsForFinding,
  runEvidenceSuite,
  scanSecrets,
  sha256Hex,
  verifyReceipt,
  verifySha256Sums,
} from "../src/lib/shipos/evidence-engine/index.mjs";

const PINNED_WORKFLOW = `on: [push]
permissions:
  contents: read
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: github/codeql-action/analyze@0123456780abcdef0123456780abcdef01234567
      - uses: actions/dependency-review-action@abcdefabcdefabcdefabcdefabcdefabcdefabcd
`;

function sampleFiles(overrides = {}) {
  return {
    "README.md": "# Demo\n",
    "LICENSE": "MIT\n",
    "CONTRIBUTING.md": "Please open a PR.\n",
    "SECURITY.md": "Report privately.\n",
    "CODEOWNERS": "* @owner\n",
    ".github/CODEOWNERS": "* @owner\n",
    ".github/ISSUE_TEMPLATE/bug.md": "## Bug\n",
    ".github/dependabot.yml": "version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n    schedule:\n      interval: weekly\n",
    ".github/workflows/ci.yml": PINNED_WORKFLOW,
    "package.json": JSON.stringify({ name: "demo", description: "A demo package" }, null, 2),
    "tsconfig.json": "{}\n",
    "eslint.config.mjs": "export default [];\n",
    "bun.lock": "{}\n",
    "agents.txt": "ShipOS agent notes\n",
    "tests/demo.test.mjs": "test('ok', () => {});\n",
    ...overrides,
  };
}

function passingSnapshot(overrides = {}) {
  return {
    files: sampleFiles(),
    testReport: {
      passed: true,
      locator: "tests/output/junit.xml",
      sha256: sha256Hex("ok"),
      kind: "workflow_run",
    },
    performanceEvidence: { passed: true, locator: "https://example.test/lighthouse", sha256: sha256Hex("perf") },
    accessibilityEvidence: { passed: true, locator: "https://example.test/axe", sha256: sha256Hex("a11y") },
    ...overrides,
  };
}

test("Engineering Index weights sum to 100 and match the V3 proposal", () => {
  const values = Object.values(ENGINEERING_INDEX_WEIGHTS);
  assert.equal(values.reduce((sum, value) => sum + value, 0), 100);
  assert.equal(ENGINEERING_INDEX_WEIGHTS.security_supply_chain, 20);
  assert.equal(ENGINEERING_INDEX_WEIGHTS.code_quality_maintainability, 15);
  assert.equal(ENGINEERING_INDEX_WEIGHTS.testing_reliability, 15);
  assert.equal(ENGINEERING_INDEX_WEIGHTS.cicd_release, 12);
  assert.equal(ENGINEERING_INDEX_WEIGHTS.documentation_dx, 10);
  assert.equal(ENGINEERING_INDEX_WEIGHTS.performance_accessibility, 10);
  assert.equal(ENGINEERING_INDEX_WEIGHTS.github_discoverability, 8);
  assert.equal(ENGINEERING_INDEX_WEIGHTS.community_governance, 5);
  assert.equal(ENGINEERING_INDEX_WEIGHTS.reproducibility_provenance, 5);
});

test("missing or invalid evidence is never awarded points, even if a check is labeled PASS", () => {
  const bare = makeFinding({
    id: "x",
    ruleId: "docs.readme",
    title: "README",
    status: "PASS",
    summary: "claimed",
    evidence: [],
    dimension: "documentation_dx",
  });
  assert.equal(bare.status, "UNKNOWN");
  assert.equal(pointsForFinding(bare, 10), 0);
  assert.equal(hasValidEvidence(bare), false);

  const unknown = makeFinding({
    id: "y",
    ruleId: "docs.readme",
    title: "README",
    status: "UNKNOWN",
    summary: "missing",
    evidence: [],
  });
  assert.equal(pointsForFinding(unknown, 10), 0);

  const failed = makeFinding({
    id: "z",
    ruleId: "docs.readme",
    title: "README",
    status: "FAIL",
    summary: "missing file",
    evidence: [{ kind: "file", locator: "README.md", sha256: sha256Hex(""), observedAt: "2026-11-11T00:00:00.000Z" }],
  });
  assert.equal(pointsForFinding(failed, 10), 0);
});

test("documentation and discoverability points cannot offset a critical security or credential gate", () => {
  const secretFile = "config/secrets.env";
  const snapshot = passingSnapshot({
    files: sampleFiles({
      [secretFile]: "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n",
    }),
  });
  const profile = buildQualityProfile(snapshot);
  const docs = profile.dimensions.find((dimension) => dimension.id === "documentation_dx");
  const discover = profile.dimensions.find((dimension) => dimension.id === "github_discoverability");
  assert.ok(docs.score > 0);
  assert.ok(discover.score > 0);
  assert.equal(profile.gates.publicationBlocked, true);
  assert.equal(profile.gates.releaseBlocked, true);
  assert.equal(profile.gates.verifiedReady, false);
  assert.ok(profile.gates.blockedBy.some((item) => item.id === "exposed_credential"));
  assert.ok(profile.gates.blockedBy.some((item) => item.id === "critical_security"));
  assert.ok(scanSecrets(snapshot.files).some((finding) => finding.ruleId === "secret.aws-access-key"));
});

test("failing required tests and untrusted workflows block verified-ready without converting unknown tests into failures", () => {
  const unpinned = passingSnapshot({
    files: sampleFiles({
      ".github/workflows/ci.yml": "on: push\njobs:\n  ci:\n    steps:\n      - uses: acme/tool@v2\n",
    }),
    testReport: { passed: false, locator: "ci/tests", sha256: sha256Hex("fail") },
  });
  const blocked = buildQualityProfile(unpinned);
  assert.equal(blocked.findings.find((finding) => finding.ruleId === "tests.required_report").status, "FAIL");
  assert.equal(blocked.findings.find((finding) => finding.ruleId === "workflow.unpinned_third_party").status, "FAIL");
  assert.equal(blocked.findings.find((finding) => finding.ruleId === "workflow.permissions").status, "FAIL");
  assert.equal(blocked.gates.verifiedReady, false);
  assert.ok(blocked.gates.requiresReview);
  assert.ok(blocked.gates.blockedBy.some((item) => item.id === "failing_required_tests"));
  assert.ok(blocked.gates.blockedBy.some((item) => item.id === "untrusted_workflow_review"));

  const missingTests = buildQualityProfile({ files: sampleFiles(), workflowReview: { reviewed: true, locator: "review-1" } });
  const required = missingTests.findings.find((finding) => finding.ruleId === "tests.required_report");
  assert.equal(required.status, "UNKNOWN");
  assert.equal(missingTests.gates.verifiedReady, false);
  assert.ok(missingTests.gates.blockedBy.some((item) => item.id === "missing_required_test_evidence"));
  assert.equal(missingTests.gates.blockedBy.some((item) => item.id === "failing_required_tests"), false);
});

test("a complete evidenced snapshot can be verified-ready and is deterministic", () => {
  const snapshot = passingSnapshot({ workflowReview: { reviewed: true, locator: "review-1", reviewer: "owner" } });
  const first = buildQualityProfile(snapshot, { observedAt: "2026-11-11T00:00:00.000Z" });
  const second = buildQualityProfile(snapshot, { observedAt: "2026-11-11T00:00:00.000Z" });
  assert.deepEqual(first, second);
  assert.equal(first.gates.verifiedReady, true);
  assert.equal(first.gates.releaseBlocked, false);
  const settings = first.findings.find((finding) => finding.ruleId === "github.settings_api");
  assert.equal(settings.status, "UNKNOWN");
  assert.ok(first.score < 100);
  assert.ok(first.score >= 80);
  assert.equal(pointsForFinding(settings, 5), 0);
});

test("applyHardGates keeps reviewed workflow risk from blocking when other gates are clear", () => {
  const findings = buildQualityProfile(passingSnapshot({
    files: sampleFiles({
      ".github/workflows/ci.yml": "on: push\npermissions:\n  contents: read\njobs:\n  ci:\n    steps:\n      - uses: acme/tool@v2\n",
    }),
    workflowReview: { reviewed: true, locator: "ticket-9" },
  })).findings;
  const gates = applyHardGates(findings, { workflowReview: { reviewed: true } });
  assert.equal(gates.requiresReview, false);
});

test("G0 fetches both the repository and live URLs and records hashes", async () => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(req.url);
    if (req.url === "/repo") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("repository-ok");
      return;
    }
    if (req.url === "/app") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html>live</html>");
      return;
    }
    res.writeHead(404);
    res.end("missing");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const pass = await evaluateG0({ repoUrl: `${base}/repo`, liveUrl: `${base}/app` });
    assert.equal(pass.status, "PASS");
    assert.equal(pass.repo.evidence[0].sha256, sha256Hex("repository-ok"));
    assert.equal(pass.live.evidence[0].sha256, sha256Hex("<html>live</html>"));

    const missingLive = await evaluateG0({ repoUrl: `${base}/repo` });
    assert.equal(missingLive.status, "UNKNOWN");
    assert.equal(missingLive.live.status, "UNKNOWN");

    const notFound = await evaluateG0({ repoUrl: `${base}/repo`, liveUrl: `${base}/gone` });
    assert.equal(notFound.status, "FAIL");
    assert.equal(notFound.live.httpStatus, 404);

    const transport = await evaluateG0({
      repoUrl: `${base}/repo`,
      liveUrl: `http://127.0.0.1:${port + 30}/nope`,
    });
    assert.equal(transport.status, "UNKNOWN");
    assert.equal(transport.live.status, "UNKNOWN");
  } finally {
    server.close();
  }
  assert.ok(seen.includes("/repo"));
  assert.ok(seen.includes("/app"));
});

test("G6 verifies SHA-256 manifests and fails on mismatch or missing artifacts", () => {
  const payload = "hello-artifact";
  const digest = sha256Hex(payload);
  const manifest = `${digest}  demo.txt\n# comment\n`;
  const pass = verifySha256Sums(manifest, { "demo.txt": payload });
  assert.equal(pass.status, "PASS");
  assert.equal(pass.results[0].actual, digest);

  const mismatch = verifySha256Sums(manifest, { "demo.txt": "tampered" });
  assert.equal(mismatch.status, "FAIL");

  const missing = verifySha256Sums(manifest, {});
  assert.equal(missing.status, "FAIL");

  const dir = mkdtempSync(join(tmpdir(), "shipos-g6-"));
  writeFileSync(join(dir, "demo.txt"), payload);
  writeFileSync(join(dir, "SHA256SUMS"), manifest);
  const fromDisk = verifySha256Sums(manifest, { "demo.txt": payload }, { manifestPath: join(dir, "SHA256SUMS") });
  assert.equal(fromDisk.status, "PASS");
});

test("G7 receipts have a schema and content hash, re-validate, and optionally HMAC-sign", () => {
  const receipt = createReceipt({ hello: "world", nested: { b: 2, a: 1 } });
  const verified = verifyReceipt(receipt);
  assert.equal(verified.status, "PASS");
  assert.equal(verified.hashValid, true);
  assert.equal(verified.signatureValid, null);

  const tampered = { ...receipt, payload: { hello: "mutated" } };
  assert.equal(verifyReceipt(tampered).status, "FAIL");

  const signed = createReceipt({ ok: true }, { hmacKey: "super-secret" });
  assert.equal(verifyReceipt(signed, { hmacKey: "super-secret" }).status, "PASS");
  assert.equal(verifyReceipt(signed, { hmacKey: "wrong" }).status, "FAIL");
  assert.equal(verifyReceipt(signed).status, "UNKNOWN");
  assert.equal(verifyReceipt({ schemaVersion: "nope" }).status, "FAIL");
  assert.equal(HMAC_KEY_ENV, "SHIPOS_EVIDENCE_HMAC_KEY");
});

test("untested acceptance gates remain NOT_VERIFIED; G0, G6, and G7 are marked VERIFIED by test", () => {
  const report = gateStatusReport();
  assert.equal(report.length, ACCEPTANCE_GATES.length);
  const byId = Object.fromEntries(report.map((gate) => [gate.id, gate]));
  assert.equal(byId.G0.status, "VERIFIED");
  assert.equal(byId.G6.status, "VERIFIED");
  assert.equal(byId.G7.status, "VERIFIED");
  assert.equal(byId.G0.verifiedBy, "tests/evidence-engine.test.mjs");
  for (const id of ["G1", "G2", "G3", "G4", "G5", "G8"]) {
    assert.equal(byId[id].status, "NOT_VERIFIED");
  }
});

test("runEvidenceSuite composes the quality profile with implemented gates and a re-checkable receipt", async () => {
  const artifact = "bundle";
  const manifest = `${sha256Hex(artifact)}  app.bin\n`;
  const result = await runEvidenceSuite({
    snapshot: passingSnapshot({ workflowReview: { reviewed: true, locator: "review-1" } }),
    manifest,
    artifacts: { "app.bin": artifact },
    hmacKey: "suite-key",
  });
  assert.equal(result.profile.gates.verifiedReady, true);
  assert.equal(result.g6.status, "PASS");
  assert.equal(result.g7.status, "PASS");
  assert.equal(verifyReceipt(result.receipt, { hmacKey: "suite-key" }).status, "PASS");
  const g0 = result.gates.find((gate) => gate.id === "G0");
  assert.equal(g0.status, "VERIFIED");
  assert.equal(g0.lastResult, null);
});

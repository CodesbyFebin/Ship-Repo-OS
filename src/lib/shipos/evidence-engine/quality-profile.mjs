import { ENGINEERING_INDEX_DIMENSIONS, ENGINEERING_INDEX_VERSION } from "./weights.mjs";
import { dimensionScore, fileEvidence, makeFinding, nowIso, roundScore } from "./findings.mjs";
import { analyzeSecurity } from "./security.mjs";

const TEST_FILE = /(?:^|\/)(?:tests?|__tests__)\/|(?:^|\/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const LOCKFILE = /(?:^|\/)(?:bun\.lock|bun\.lockb|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;
const ESLINT = /(?:^|\/)(?:eslint\.config\.\w+|eslintrc(?:\.\w+)?)$/i;
const TSCONFIG = /(?:^|\/)tsconfig(?:\.\w+)?\.json$/i;
const README = /(?:^|\/)readme(?:\.\w+)?$/i;
const CONTRIBUTING = /(?:^|\/)contributing(?:\.\w+)?$/i;
const LICENSE = /(?:^|\/)(?:license|copying)(?:\.\w+)?$/i;
const SECURITY_POLICY = /(?:^|\/)security(?:\.\w+)?$/i;
const CODEOWNERS = /(?:^|\/)codeowners$/i;
const ISSUE_TEMPLATE = /(?:^|\/)\.github\/(?:ISSUE_TEMPLATE(?:\/|$)|issue_template(?:\.\w+)?)/i;

function firstMatch(files, regex) {
  return Object.keys(files).sort().find((path) => regex.test(path));
}

function presence(files, regex, { id, ruleId, title, dimension, observedAt, failIfMissing = true }) {
  const path = firstMatch(files, regex);
  if (!path) {
    return makeFinding({
      id,
      ruleId,
      dimension,
      title,
      status: failIfMissing ? "FAIL" : "UNKNOWN",
      severity: "low",
      summary: failIfMissing ? `${title} was not found in the snapshot.` : `${title} was not evidenced in the snapshot.`,
      evidence: [],
    });
  }
  return makeFinding({
    id,
    ruleId,
    dimension,
    title,
    status: "PASS",
    severity: "low",
    summary: `${title} is evidenced by ${path}.`,
    evidence: [fileEvidence(path, files[path], observedAt)],
  });
}

function measuredEvidenceFinding({ id, ruleId, title, dimension, record, observedAt }) {
  if (!record) {
    return makeFinding({
      id,
      ruleId,
      dimension,
      title,
      status: "UNKNOWN",
      severity: "low",
      summary: `No measured ${title.toLowerCase()} evidence was supplied.`,
      evidence: [],
      limitations: ["Unknown measurements are not converted into a pass."],
    });
  }
  const evidence = record.evidence ?? (record.locator ? [{
    kind: record.kind ?? "api_resource",
    locator: record.locator,
    sha256: record.sha256,
    observedAt: record.observedAt ?? observedAt,
  }] : []);
  return makeFinding({
    id,
    ruleId,
    dimension,
    title,
    status: record.passed === true ? "PASS" : record.passed === false ? "FAIL" : "UNKNOWN",
    severity: "medium",
    summary: record.summary ?? `${title} was reported as ${record.passed === true ? "passing" : record.passed === false ? "failing" : "unknown"}.`,
    evidence,
  });
}

export function collectQualityFindings(snapshot, { observedAt = nowIso() } = {}) {
  const files = snapshot.files ?? {};
  const findings = [];

  findings.push(...analyzeSecurity(files, { observedAt, workflowReview: snapshot.workflowReview }));

  findings.push(presence(files, TSCONFIG, {
    id: "code:tsconfig",
    ruleId: "code.tsconfig",
    title: "TypeScript configuration",
    dimension: "code_quality_maintainability",
    observedAt,
    failIfMissing: false,
  }));
  findings.push(presence(files, ESLINT, {
    id: "code:eslint",
    ruleId: "code.eslint",
    title: "ESLint configuration",
    dimension: "code_quality_maintainability",
    observedAt,
    failIfMissing: false,
  }));

  const testPath = firstMatch(files, TEST_FILE);
  findings.push(makeFinding({
    id: "tests:files",
    ruleId: "tests.files",
    dimension: "testing_reliability",
    title: "Test files present",
    status: testPath ? "PASS" : "UNKNOWN",
    severity: "medium",
    summary: testPath ? `Test files include ${testPath}.` : "No test files were supplied, so test coverage is unknown.",
    evidence: testPath ? [fileEvidence(testPath, files[testPath], observedAt)] : [],
  }));

  const report = snapshot.testReport;
  findings.push(makeFinding({
    id: "tests:required-report",
    ruleId: "tests.required_report",
    dimension: "testing_reliability",
    title: "Required test report",
    status: !report ? "UNKNOWN" : report.passed === true ? "PASS" : report.passed === false ? "FAIL" : "UNKNOWN",
    severity: "critical",
    summary: !report
      ? "No required test report was supplied, so verified-ready status cannot be granted."
      : report.passed === true
        ? "The required test report indicates a passing run."
        : report.passed === false
          ? "The required test report indicates a failing run."
          : "The required test report did not include a pass/fail result.",
    evidence: report?.locator || report?.sha256 ? [{
      kind: report.kind ?? "workflow_run",
      locator: report.locator ?? "testReport",
      sha256: report.sha256,
      observedAt: report.observedAt ?? observedAt,
    }] : [],
    limitations: ["A missing test report is unknown, not a failed test."],
  }));

  const workflowPath = firstMatch(files, /^\.github\/workflows\/[^/]+\.ya?ml$/i);
  findings.push(makeFinding({
    id: "cicd:workflow",
    ruleId: "cicd.workflow",
    dimension: "cicd_release",
    title: "CI workflow present",
    status: workflowPath ? "PASS" : "UNKNOWN",
    severity: "medium",
    summary: workflowPath ? `A workflow is evidenced by ${workflowPath}.` : "No CI workflow files were supplied.",
    evidence: workflowPath ? [fileEvidence(workflowPath, files[workflowPath], observedAt)] : [],
  }));

  findings.push(presence(files, README, {
    id: "docs:readme",
    ruleId: "docs.readme",
    title: "README",
    dimension: "documentation_dx",
    observedAt,
  }));
  findings.push(presence(files, CONTRIBUTING, {
    id: "docs:contributing",
    ruleId: "docs.contributing",
    title: "Contributing guide",
    dimension: "documentation_dx",
    observedAt,
    failIfMissing: false,
  }));

  findings.push(measuredEvidenceFinding({
    id: "perf:budget",
    ruleId: "perf.measurement",
    title: "Performance measurement",
    dimension: "performance_accessibility",
    record: snapshot.performanceEvidence,
    observedAt,
  }));
  findings.push(measuredEvidenceFinding({
    id: "a11y:measurement",
    ruleId: "a11y.measurement",
    title: "Accessibility measurement",
    dimension: "performance_accessibility",
    record: snapshot.accessibilityEvidence,
    observedAt,
  }));

  findings.push(presence(files, /(?:^|\/)(?:agents\.txt|llms\.txt)$/i, {
    id: "discover:machine-docs",
    ruleId: "discover.machine_docs",
    title: "Machine-readable project context",
    dimension: "github_discoverability",
    observedAt,
    failIfMissing: false,
  }));
  const pkg = files["package.json"];
  let pkgFinding;
  if (pkg) {
    let description = "";
    try { description = JSON.parse(pkg).description ?? ""; } catch { description = ""; }
    pkgFinding = makeFinding({
      id: "discover:description",
      ruleId: "discover.description",
      dimension: "github_discoverability",
      title: "Package description",
      status: description.trim() ? "PASS" : "FAIL",
      severity: "low",
      summary: description.trim() ? "package.json includes a description." : "package.json has no description.",
      evidence: [fileEvidence("package.json", pkg, observedAt)],
    });
  } else {
    pkgFinding = makeFinding({
      id: "discover:description",
      ruleId: "discover.description",
      dimension: "github_discoverability",
      title: "Package description",
      status: "UNKNOWN",
      severity: "low",
      summary: "package.json was not supplied.",
      evidence: [],
    });
  }
  findings.push(pkgFinding);

  findings.push(presence(files, SECURITY_POLICY, {
    id: "community:security",
    ruleId: "community.security_policy",
    title: "Security policy",
    dimension: "community_governance",
    observedAt,
    failIfMissing: false,
  }));
  findings.push(presence(files, CODEOWNERS, {
    id: "community:codeowners",
    ruleId: "community.codeowners",
    title: "CODEOWNERS",
    dimension: "community_governance",
    observedAt,
    failIfMissing: false,
  }));
  findings.push(presence(files, ISSUE_TEMPLATE, {
    id: "community:issue-templates",
    ruleId: "community.issue_templates",
    title: "Issue templates",
    dimension: "community_governance",
    observedAt,
    failIfMissing: false,
  }));

  findings.push(presence(files, LOCKFILE, {
    id: "repro:lockfile",
    ruleId: "repro.lockfile",
    title: "Dependency lockfile",
    dimension: "reproducibility_provenance",
    observedAt,
  }));
  findings.push(presence(files, LICENSE, {
    id: "repro:license",
    ruleId: "repro.license",
    title: "License",
    dimension: "reproducibility_provenance",
    observedAt,
  }));

  return findings;
}

export function applyHardGates(findings, snapshot = {}) {
  const blockedBy = [];
  const critical = findings.filter((finding) => finding.severity === "critical" && finding.status === "FAIL" && finding.ruleId !== "tests.required_report");
  if (critical.length) {
    blockedBy.push({
      id: "critical_security",
      effect: "block_release",
      summary: "A critical security finding blocks release.",
      findingIds: critical.map((finding) => finding.id),
    });
  }

  const credentials = findings.filter((finding) => finding.ruleId.startsWith("secret.") && finding.ruleId !== "secret.pattern_scan" && finding.status === "FAIL");
  if (credentials.length) {
    blockedBy.push({
      id: "exposed_credential",
      effect: "block_publication",
      summary: "An exposed-credential signal blocks publication until the value is rotated or removed.",
      findingIds: credentials.map((finding) => finding.id),
    });
  }

  const requiredTest = findings.find((finding) => finding.ruleId === "tests.required_report");
  if (requiredTest?.status === "FAIL") {
    blockedBy.push({
      id: "failing_required_tests",
      effect: "block_verified_ready",
      summary: "Required tests failed, so verified-ready status is not granted.",
      findingIds: [requiredTest.id],
    });
  } else if (!requiredTest || requiredTest.status === "UNKNOWN") {
    blockedBy.push({
      id: "missing_required_test_evidence",
      effect: "block_verified_ready",
      summary: "Required test evidence is unknown, so verified-ready status is not granted.",
      findingIds: requiredTest ? [requiredTest.id] : [],
    });
  }

  const untrusted = findings.filter((finding) => (
    finding.ruleId === "workflow.unpinned_third_party" || finding.ruleId === "workflow.permissions"
  ) && finding.status === "FAIL");
  const reviewed = snapshot.workflowReview?.reviewed === true;
  if (untrusted.length && !reviewed) {
    blockedBy.push({
      id: "untrusted_workflow_review",
      effect: "require_review",
      summary: "Untrusted workflow permissions or unpinned third-party Actions require review.",
      findingIds: untrusted.map((finding) => finding.id),
    });
  }

  const releaseBlocked = blockedBy.some((item) => item.effect === "block_release" || item.effect === "block_publication");
  const publicationBlocked = blockedBy.some((item) => item.effect === "block_publication");
  const requiresReview = blockedBy.some((item) => item.effect === "require_review");
  const verifiedReady = blockedBy.length === 0;

  return {
    releaseBlocked,
    publicationBlocked,
    requiresReview,
    verifiedReady,
    blockedBy,
  };
}

export function buildQualityProfile(snapshot = {}, options = {}) {
  const observedAt = options.observedAt ?? nowIso();
  const findings = collectQualityFindings(snapshot, { observedAt });
  const dimensions = ENGINEERING_INDEX_DIMENSIONS.map((dimension) => {
    const items = findings.filter((finding) => finding.dimension === dimension.id);
    return {
      id: dimension.id,
      name: dimension.name,
      weight: dimension.weight,
      ...dimensionScore(items, dimension.weight),
      findingIds: items.map((finding) => finding.id),
    };
  });
  const score = roundScore(dimensions.reduce((sum, dimension) => sum + dimension.score, 0));
  const gates = applyHardGates(findings, snapshot);
  return {
    version: ENGINEERING_INDEX_VERSION,
    observedAt,
    score,
    max: 100,
    dimensions,
    findings,
    gates,
    note: "Proposed Engineering Index weights. Points are awarded only for PASS results with evidence. Marketing or documentation points cannot offset hard gates.",
  };
}

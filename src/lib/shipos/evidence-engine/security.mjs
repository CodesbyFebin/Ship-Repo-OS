import { fileEvidence, makeFinding, nowIso } from "./findings.mjs";

const WORKFLOW_DIR = /^\.github\/workflows\/[^/]+\.ya?ml$/i;
const FIRST_PARTY_ACTIONS = /^(?:actions|github)\//;

export const SECRET_PATTERNS = Object.freeze([
  { id: "pem-private-key", title: "PEM private key", severity: "critical", confidence: 0.95, regex: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/ },
  { id: "aws-access-key", title: "AWS access key ID", severity: "critical", confidence: 0.9, regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "github-pat", title: "GitHub personal access token", severity: "critical", confidence: 0.9, regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/ },
  { id: "github-fine-grained-pat", title: "GitHub fine-grained PAT", severity: "critical", confidence: 0.9, regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { id: "slack-token", title: "Slack token", severity: "critical", confidence: 0.85, regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { id: "stripe-secret", title: "Stripe secret key", severity: "critical", confidence: 0.9, regex: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/ },
]);

const SKIP_SECRET_SCAN = /(?:^|\/)(?:bun\.lock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|node_modules\/|\.git\/|\.next\/)/i;

export function scanSecrets(files, { observedAt = nowIso() } = {}) {
  const hits = [];
  for (const [path, content] of Object.entries(files)) {
    if (SKIP_SECRET_SCAN.test(path) || typeof content !== "string") continue;
    for (const pattern of SECRET_PATTERNS) {
      if (!pattern.regex.test(content)) continue;
      hits.push(makeFinding({
        id: `secret:${pattern.id}:${path}`,
        ruleId: `secret.${pattern.id}`,
        engine: "security-intelligence",
        dimension: "security_supply_chain",
        title: `${pattern.title} pattern in ${path}`,
        status: "FAIL",
        severity: pattern.severity,
        confidence: pattern.confidence,
        summary: `A ${pattern.title} pattern matched ${path}. This is a high-confidence signal, not a confirmed live credential; rotate if the value is real.`,
        evidence: [fileEvidence(path, content, observedAt)],
        limitations: ["Pattern matches can include fixtures, examples, or revoked material."],
      }));
    }
  }
  if (!hits.length) {
    const scanned = Object.keys(files).filter((path) => !SKIP_SECRET_SCAN.test(path) && typeof files[path] === "string");
    if (!scanned.length) {
      return [makeFinding({
        id: "secret:scan",
        ruleId: "secret.pattern_scan",
        engine: "security-intelligence",
        dimension: "security_supply_chain",
        title: "Secret pattern scan",
        status: "UNKNOWN",
        severity: "high",
        summary: "No scannable file contents were provided, so secret exposure is unknown.",
        evidence: [],
        limitations: ["Missing evidence is never treated as a pass."],
      })];
    }
    return [makeFinding({
      id: "secret:scan",
      ruleId: "secret.pattern_scan",
      engine: "security-intelligence",
      dimension: "security_supply_chain",
      title: "Secret pattern scan",
      status: "PASS",
      severity: "high",
      summary: `No high-confidence credential patterns were found in ${scanned.length} scanned file(s).`,
      evidence: scanned.slice(0, 8).map((path) => fileEvidence(path, files[path], observedAt)),
      limitations: ["Absence of a regex match does not prove a repository is free of secrets."],
    })];
  }
  return hits;
}

export function listWorkflowPaths(files) {
  return Object.keys(files).filter((path) => WORKFLOW_DIR.test(path)).sort();
}

export function parseActionRefs(content) {
  const refs = [];
  for (const line of String(content).split(/\r?\n/)) {
    const match = /^\s*-?\s*uses:\s*["']?([^"'\s#]+)/.exec(line);
    if (match) refs.push(match[1]);
  }
  return refs;
}

export function classifyActionRef(ref) {
  if (ref.startsWith("./") || ref.startsWith(".\\")) {
    return { ref, kind: "local", firstParty: false, pinned: true };
  }
  if (ref.startsWith("docker://")) {
    return { ref, kind: "docker", firstParty: false, pinned: /@sha256:[a-f0-9]{64}$/i.test(ref) };
  }
  const at = ref.lastIndexOf("@");
  const name = at === -1 ? ref : ref.slice(0, at);
  const version = at === -1 ? "" : ref.slice(at + 1);
  const firstParty = FIRST_PARTY_ACTIONS.test(name);
  return {
    ref,
    kind: firstParty ? "first_party" : "third_party",
    firstParty,
    pinned: /^[a-f0-9]{40}$/i.test(version),
    version,
  };
}

export function inspectWorkflowPermissions(content) {
  const writeAll = /permissions:\s*write-all\b/i.test(content);
  const explicit = /(?:^|\n)[ \t]*permissions\s*:/m.test(content);
  return { writeAll, explicit };
}

export function inspectWorkflows(files, { observedAt = nowIso(), workflowReview } = {}) {
  const paths = listWorkflowPaths(files);
  const findings = [];
  if (!paths.length) {
    findings.push(makeFinding({
      id: "workflow:present",
      ruleId: "workflow.present",
      engine: "security-intelligence",
      dimension: "cicd_release",
      title: "GitHub Actions workflows",
      status: "UNKNOWN",
      severity: "medium",
      summary: "No workflow files were supplied, so workflow policy could not be reviewed.",
      evidence: [],
    }));
    return findings;
  }

  const unpinnedThirdParty = [];
  let anyWriteAll = false;
  let anyMissingPermissions = false;
  for (const path of paths) {
    const content = files[path];
    const permissions = inspectWorkflowPermissions(content);
    if (permissions.writeAll) anyWriteAll = true;
    if (!permissions.explicit) anyMissingPermissions = true;
    for (const ref of parseActionRefs(content)) {
      const info = classifyActionRef(ref);
      if (info.kind === "third_party" && !info.pinned) unpinnedThirdParty.push({ path, ref });
    }
  }

  const permissionStatus = anyWriteAll || anyMissingPermissions ? "FAIL" : "PASS";
  findings.push(makeFinding({
    id: "workflow:permissions",
    ruleId: "workflow.permissions",
    engine: "security-intelligence",
    dimension: "security_supply_chain",
    title: "Workflow permissions",
    status: permissionStatus,
    severity: anyWriteAll ? "critical" : "high",
    summary: anyWriteAll
      ? "At least one workflow sets permissions: write-all."
      : anyMissingPermissions
        ? "At least one workflow omits an explicit permissions block, so default token rights need review."
        : "Inspected workflows declare explicit permissions and do not use write-all.",
    evidence: paths.map((path) => fileEvidence(path, files[path], observedAt)),
    limitations: ["This inspects workflow YAML text only; it does not read repository or organization settings."],
  }));

  findings.push(makeFinding({
    id: "workflow:unpinned-third-party",
    ruleId: "workflow.unpinned_third_party",
    engine: "security-intelligence",
    dimension: "security_supply_chain",
    title: "Third-party Actions pinning",
    status: unpinnedThirdParty.length ? "FAIL" : "PASS",
    severity: "high",
    summary: unpinnedThirdParty.length
      ? `Unpinned third-party Actions require review: ${unpinnedThirdParty.map((item) => `${item.ref} (${item.path})`).join("; ")}.`
      : "No unpinned third-party Actions were found in the supplied workflows.",
    evidence: paths.map((path) => fileEvidence(path, files[path], observedAt)),
    limitations: ["First-party actions/* and github/* references are not treated as the untrusted-workflow hard gate."],
  }));

  if (workflowReview?.reviewed === true) {
    findings.push(makeFinding({
      id: "workflow:review",
      ruleId: "workflow.untrusted_review",
      engine: "security-intelligence",
      dimension: "security_supply_chain",
      title: "Untrusted workflow review",
      status: "PASS",
      severity: "high",
      summary: `Workflow risk was marked reviewed${workflowReview.reviewer ? ` by ${workflowReview.reviewer}` : ""}.`,
      evidence: [{
        kind: "human_attestation",
        locator: workflowReview.locator ?? "workflowReview",
        observedAt: workflowReview.observedAt ?? observedAt,
      }],
    }));
  }

  return findings;
}

function presenceFinding({ id, ruleId, title, pathAliases, files, observedAt, dimension, settingsNote }) {
  const path = pathAliases.find((candidate) => Object.prototype.hasOwnProperty.call(files, candidate));
  if (!path) {
    return makeFinding({
      id,
      ruleId,
      engine: "security-intelligence",
      dimension,
      title,
      status: "FAIL",
      severity: "medium",
      summary: `${title} file was not present in the snapshot.`,
      evidence: [],
      limitations: [settingsNote],
    });
  }
  return makeFinding({
    id,
    ruleId,
    engine: "security-intelligence",
    dimension,
    title,
    status: "PASS",
    severity: "medium",
    summary: `${title} is evidenced by ${path}. This does not prove the matching GitHub setting is enabled.`,
    evidence: [fileEvidence(path, files[path], observedAt)],
    limitations: [settingsNote],
  });
}

export function inspectGithubSecurityFiles(files, { observedAt = nowIso() } = {}) {
  const settingsNote = "A configuration file is not evidence that a GitHub account or repository setting is enabled.";
  const findings = [
    presenceFinding({
      id: "github:dependabot",
      ruleId: "github.dependabot",
      title: "Dependabot configuration",
      pathAliases: [".github/dependabot.yml", ".github/dependabot.yaml"],
      files,
      observedAt,
      dimension: "security_supply_chain",
      settingsNote,
    }),
  ];

  const workflowPaths = listWorkflowPaths(files);
  const codeqlPath = workflowPaths.find((path) => /codeql/i.test(path) || /codeql-action/.test(files[path] ?? ""));
  const depReviewPath = workflowPaths.find((path) => /dependency-review/i.test(path) || /dependency-review-action/.test(files[path] ?? ""));

  findings.push(makeFinding({
    id: "github:codeql",
    ruleId: "github.codeql",
    engine: "security-intelligence",
    dimension: "security_supply_chain",
    title: "CodeQL workflow presence",
    status: codeqlPath ? "PASS" : workflowPaths.length ? "FAIL" : "UNKNOWN",
    severity: "medium",
    summary: codeqlPath
      ? `CodeQL is referenced in ${codeqlPath}. This does not prove code scanning is enabled on GitHub.`
      : workflowPaths.length
        ? "No CodeQL workflow or github/codeql-action reference was found."
        : "No workflows were supplied, so CodeQL presence is unknown.",
    evidence: codeqlPath ? [fileEvidence(codeqlPath, files[codeqlPath], observedAt)] : workflowPaths.slice(0, 4).map((path) => fileEvidence(path, files[path], observedAt)),
    limitations: [settingsNote],
  }));

  findings.push(makeFinding({
    id: "github:dependency-review",
    ruleId: "github.dependency_review",
    engine: "security-intelligence",
    dimension: "security_supply_chain",
    title: "Dependency review workflow presence",
    status: depReviewPath ? "PASS" : workflowPaths.length ? "FAIL" : "UNKNOWN",
    severity: "medium",
    summary: depReviewPath
      ? `Dependency review is referenced in ${depReviewPath}. This does not prove the GitHub setting is enabled.`
      : workflowPaths.length
        ? "No dependency-review Action reference was found."
        : "No workflows were supplied, so dependency review presence is unknown.",
    evidence: depReviewPath ? [fileEvidence(depReviewPath, files[depReviewPath], observedAt)] : workflowPaths.slice(0, 4).map((path) => fileEvidence(path, files[depReviewPath] ?? files[path], observedAt)),
    limitations: [settingsNote],
  }));

  findings.push(makeFinding({
    id: "github:settings",
    ruleId: "github.settings_api",
    engine: "security-intelligence",
    dimension: "security_supply_chain",
    title: "GitHub security settings",
    status: "UNKNOWN",
    severity: "medium",
    summary: "Secret scanning, push protection, Dependabot alerts, and code scanning enablement were not queried from the GitHub API.",
    evidence: [],
    limitations: [settingsNote],
  }));

  return findings;
}

export function analyzeSecurity(files, options = {}) {
  return [
    ...scanSecrets(files, options),
    ...inspectWorkflows(files, options),
    ...inspectGithubSecurityFiles(files, options),
  ];
}

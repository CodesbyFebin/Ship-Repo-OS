import { sha256Hex } from "./hash.mjs";

export const STATUSES = Object.freeze(["PASS", "FAIL", "UNKNOWN"]);

export function nowIso(clock = () => new Date()) {
  return new Date(clock()).toISOString();
}

export function fileEvidence(path, content, observedAt) {
  return {
    kind: "file",
    locator: path,
    sha256: sha256Hex(content ?? ""),
    observedAt,
  };
}

export function urlEvidence(url, content, observedAt) {
  return {
    kind: "api_resource",
    locator: url,
    sha256: content == null ? undefined : sha256Hex(content),
    observedAt,
  };
}

export function hasValidEvidence(finding) {
  return Array.isArray(finding?.evidence) && finding.evidence.some((item) => {
    if (!item || !item.locator) return false;
    if (item.sha256) return true;
    if (item.kind === "human_attestation") return Boolean(item.locator);
    return /^https?:\/\//i.test(item.locator);
  });
}

export function makeFinding({
  id,
  ruleId,
  ruleVersion = "1.0.0",
  engine = "evidence",
  title,
  status,
  severity = "info",
  confidence = 1,
  summary,
  evidence = [],
  limitations = [],
  dimension,
}) {
  if (!STATUSES.includes(status)) {
    throw new Error(`Invalid finding status: ${status}`);
  }
  const finding = {
    id,
    ruleId,
    ruleVersion,
    engine,
    title,
    status,
    severity,
    confidence,
    summary,
    evidence,
    limitations,
    dimension,
  };
  if (finding.status === "PASS" && !hasValidEvidence(finding)) {
    finding.status = "UNKNOWN";
    finding.summary = `${summary} Missing verifiable evidence; status downgraded from PASS to UNKNOWN.`;
    finding.limitations = [...limitations, "A PASS without evidence is never awarded."];
  }
  return finding;
}

export function pointsForFinding(finding, maxPoints) {
  if (finding.status !== "PASS" || !hasValidEvidence(finding) || !(maxPoints > 0)) return 0;
  return maxPoints;
}

export function dimensionScore(findings, weight) {
  if (!findings.length || !(weight > 0)) {
    return { score: 0, max: weight, status: "UNKNOWN" };
  }
  const share = weight / findings.length;
  let score = 0;
  for (const finding of findings) score += pointsForFinding(finding, share);
  const statuses = new Set(findings.map((finding) => finding.status));
  let status = "FAIL";
  if (statuses.size === 1) status = findings[0].status;
  else if (statuses.has("FAIL")) status = "FAIL";
  else if (statuses.has("UNKNOWN")) status = "UNKNOWN";
  else status = "PASS";
  return { score: roundScore(score), max: weight, status };
}

export function roundScore(value) {
  return Math.round(value * 100) / 100;
}

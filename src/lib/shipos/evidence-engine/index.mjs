export { sha256Hex, hmacSha256Hex, canonicalJson } from "./hash.mjs";
export { ENGINEERING_INDEX_VERSION, ENGINEERING_INDEX_WEIGHTS, ENGINEERING_INDEX_DIMENSIONS, ACCEPTANCE_GATES } from "./weights.mjs";
export { makeFinding, hasValidEvidence, pointsForFinding, fileEvidence } from "./findings.mjs";
export { analyzeSecurity, scanSecrets, inspectWorkflows, inspectGithubSecurityFiles } from "./security.mjs";
export { buildQualityProfile, applyHardGates, collectQualityFindings } from "./quality-profile.mjs";
export {
  evaluateG0,
  verifySha256Sums,
  verifySha256SumsInDirectory,
  createReceipt,
  verifyReceipt,
  gateStatusReport,
  RECEIPT_SCHEMA_VERSION,
  HMAC_KEY_ENV,
  VERIFIED_GATES,
} from "./gates.mjs";
export { loadSnapshotFromRoot } from "./snapshot.mjs";

import { buildQualityProfile } from "./quality-profile.mjs";
import { createReceipt, evaluateG0, gateStatusReport, HMAC_KEY_ENV, verifyReceipt, verifySha256Sums } from "./gates.mjs";

/**
 * @param {{
 *   snapshot?: Record<string, unknown>,
 *   repoUrl?: string,
 *   liveUrl?: string,
 *   artifacts?: Record<string, string | Uint8Array | Buffer>,
 *   manifest?: string,
 *   manifestPath?: string,
 *   fetchImpl?: typeof fetch,
 *   hmacKey?: string,
 * }} [input]
 */
export async function runEvidenceSuite({
  snapshot = {},
  repoUrl,
  liveUrl,
  artifacts,
  manifest,
  manifestPath,
  fetchImpl,
  hmacKey = process.env[HMAC_KEY_ENV],
} = {}) {
  const profile = buildQualityProfile(snapshot);
  const g0 = repoUrl || liveUrl ? await evaluateG0({ repoUrl, liveUrl, fetchImpl }) : null;
  const g6 = manifest != null ? verifySha256Sums(manifest, artifacts ?? {}, { manifestPath }) : null;
  const receipt = createReceipt({
    profile,
    g0,
    g6,
    repoUrl: repoUrl ?? snapshot.repoUrl ?? null,
    liveUrl: liveUrl ?? snapshot.liveUrl ?? null,
  }, { hmacKey });
  const g7 = verifyReceipt(receipt, { hmacKey });
  const executed = {};
  if (g0) executed.G0 = g0;
  if (g6) executed.G6 = g6;
  executed.G7 = g7;
  return {
    profile,
    g0,
    g6,
    g7,
    receipt,
    gates: gateStatusReport(executed),
  };
}

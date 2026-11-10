import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ACCEPTANCE_GATES } from "./weights.mjs";
import { canonicalJson, hmacSha256Hex, safeEqualHex, sha256Hex } from "./hash.mjs";
import { nowIso, urlEvidence } from "./findings.mjs";

export const RECEIPT_SCHEMA_VERSION = "shipos.evidence-receipt.v1";
export const HMAC_KEY_ENV = "SHIPOS_EVIDENCE_HMAC_KEY";
export const VERIFIED_GATES = Object.freeze({
  G0: "tests/evidence-engine.test.mjs",
  G6: "tests/evidence-engine.test.mjs",
  G7: "tests/evidence-engine.test.mjs",
});

export function gateStatusReport(executed = {}) {
  return ACCEPTANCE_GATES.map((gate) => {
    const verifiedBy = VERIFIED_GATES[gate.id];
    if (!verifiedBy) {
      return { ...gate, status: "NOT_VERIFIED", detail: "No automated acceptance test covers this gate yet." };
    }
    const result = executed[gate.id];
    return {
      ...gate,
      status: "VERIFIED",
      verifiedBy,
      lastResult: result?.status ?? null,
      detail: result
        ? `Implemented and covered by ${verifiedBy}. Last evaluation: ${result.status}.`
        : `Implemented and covered by ${verifiedBy}.`,
    };
  });
}

async function fetchTarget(role, url, fetchImpl, observedAt) {
  if (!url) {
    return {
      role,
      url: null,
      status: "UNKNOWN",
      error: `No ${role} URL was provided.`,
      evidence: [],
    };
  }
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      headers: { "user-agent": "ShipOS-EvidenceEngine/1.0" },
    });
    const body = await response.text();
    const evidence = [urlEvidence(url, body, observedAt)];
    if (response.ok) {
      return { role, url, status: "PASS", httpStatus: response.status, evidence };
    }
    return {
      role,
      url,
      status: "FAIL",
      httpStatus: response.status,
      error: `HTTP ${response.status}`,
      evidence,
    };
  } catch (error) {
    return {
      role,
      url,
      status: "UNKNOWN",
      error: error instanceof Error ? error.message : String(error),
      evidence: [{ kind: "api_resource", locator: url, observedAt }],
    };
  }
}

/**
 * @param {{ repoUrl?: string, liveUrl?: string, fetchImpl?: typeof fetch, observedAt?: string }} [input]
 */
export async function evaluateG0({ repoUrl, liveUrl, fetchImpl = globalThis.fetch, observedAt = nowIso() } = {}) {
  const repo = await fetchTarget("repo", repoUrl, fetchImpl, observedAt);
  const live = await fetchTarget("live", liveUrl, fetchImpl, observedAt);
  let status = "UNKNOWN";
  if (repo.status === "PASS" && live.status === "PASS") status = "PASS";
  else if (repo.status === "FAIL" || live.status === "FAIL") status = "FAIL";
  return {
    gate: "G0",
    status,
    repo,
    live,
    summary: status === "PASS"
      ? "Repository and live URLs were fetched successfully."
      : "Repository and live URL validation did not pass. Missing or unreachable URLs stay unknown; HTTP errors fail the gate.",
  };
}

export function parseSha256Sums(manifestText) {
  const entries = [];
  for (const raw of String(manifestText).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([a-fA-F0-9]{64}) [ *](.+)$/.exec(line);
    if (!match) {
      entries.push({ raw, error: "Malformed SHA256SUMS line." });
      continue;
    }
    entries.push({ sha256: match[1].toLowerCase(), file: match[2].trim(), binary: raw.includes(" *") });
  }
  return entries;
}

/**
 * @param {string} manifestText
 * @param {Record<string, string | Uint8Array | Buffer>} files
 * @param {{ manifestPath?: string }} [options]
 */
export function verifySha256Sums(manifestText, files, { manifestPath = "SHA256SUMS" } = {}) {
  const observedAt = nowIso();
  const parsed = parseSha256Sums(manifestText);
  const results = [];
  if (!parsed.length) {
    return {
      gate: "G6",
      status: "FAIL",
      summary: "The checksum manifest was empty or unreadable.",
      results,
      evidence: manifestText != null ? [{ kind: "file", locator: manifestPath, sha256: sha256Hex(manifestText), observedAt }] : [],
    };
  }
  let status = "PASS";
  for (const entry of parsed) {
    if (entry.error) {
      status = "FAIL";
      results.push({ file: entry.raw, status: "FAIL", error: entry.error });
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(files, entry.file)) {
      status = "FAIL";
      results.push({ file: entry.file, expected: entry.sha256, status: "FAIL", error: "Artifact listed in the manifest was not provided." });
      continue;
    }
    const actual = sha256Hex(files[entry.file]);
    const ok = actual === entry.sha256;
    if (!ok) status = "FAIL";
    results.push({
      file: entry.file,
      expected: entry.sha256,
      actual,
      status: ok ? "PASS" : "FAIL",
      error: ok ? undefined : "SHA-256 mismatch.",
    });
  }
  return {
    gate: "G6",
    status,
    summary: status === "PASS"
      ? `All ${results.length} listed artifact hash(es) verified.`
      : "One or more artifact hashes did not verify.",
    results,
    evidence: [
      { kind: "file", locator: manifestPath, sha256: sha256Hex(manifestText), observedAt },
      ...results.filter((item) => item.actual).map((item) => ({
        kind: "file",
        locator: item.file,
        sha256: item.actual,
        observedAt,
      })),
    ],
  };
}

export function verifySha256SumsInDirectory(manifestPath, directory) {
  const manifestText = readFileSync(manifestPath, "utf8");
  const parsed = parseSha256Sums(manifestText);
  const files = {};
  for (const entry of parsed) {
    if (entry.file) {
      try {
        files[entry.file] = readFileSync(join(directory, entry.file));
      } catch {
        // verifySha256Sums reports the missing file.
      }
    }
  }
  return verifySha256Sums(manifestText, files, { manifestPath: basename(manifestPath) });
}

function receiptCore(receipt) {
  return {
    schemaVersion: receipt.schemaVersion,
    issuedAt: receipt.issuedAt,
    payload: receipt.payload,
  };
}

export function validateReceiptSchema(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return { ok: false, error: "Receipt must be an object." };
  }
  if (receipt.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported receipt schema: ${receipt.schemaVersion ?? "(missing)"}.` };
  }
  if (typeof receipt.issuedAt !== "string" || Number.isNaN(Date.parse(receipt.issuedAt))) {
    return { ok: false, error: "Receipt issuedAt must be an ISO timestamp." };
  }
  if (!Object.prototype.hasOwnProperty.call(receipt, "payload")) {
    return { ok: false, error: "Receipt payload is required." };
  }
  if (typeof receipt.contentHash !== "string" || !/^[a-f0-9]{64}$/i.test(receipt.contentHash)) {
    return { ok: false, error: "Receipt contentHash must be a SHA-256 hex digest." };
  }
  if (receipt.signature != null) {
    if (typeof receipt.signature !== "object" || receipt.signature.alg !== "HMAC-SHA256" || !/^[a-f0-9]{64}$/i.test(receipt.signature.value ?? "")) {
      return { ok: false, error: "Receipt signature must be HMAC-SHA256 with a hex digest." };
    }
  }
  return { ok: true };
}

/**
 * @param {unknown} payload
 * @param {{ hmacKey?: string, issuedAt?: string, schemaVersion?: string }} [options]
 */
export function createReceipt(payload, { hmacKey, issuedAt = nowIso(), schemaVersion = RECEIPT_SCHEMA_VERSION } = {}) {
  const core = { schemaVersion, issuedAt, payload };
  const contentHash = sha256Hex(canonicalJson(core));
  const receipt = { ...core, contentHash };
  if (hmacKey) {
    receipt.signature = { alg: "HMAC-SHA256", value: hmacSha256Hex(hmacKey, contentHash) };
  }
  return receipt;
}

/**
 * @param {any} receipt
 * @param {{ hmacKey?: string }} [options]
 */
export function verifyReceipt(receipt, { hmacKey } = {}) {
  const schema = validateReceiptSchema(receipt);
  if (!schema.ok) {
    return { gate: "G7", status: "FAIL", summary: schema.error, schemaValid: false };
  }
  const expectedHash = sha256Hex(canonicalJson(receiptCore(receipt)));
  if (!safeEqualHex(expectedHash, receipt.contentHash)) {
    return {
      gate: "G7",
      status: "FAIL",
      schemaValid: true,
      hashValid: false,
      summary: "Receipt content hash did not match the canonical payload.",
    };
  }
  if (receipt.signature) {
    if (!hmacKey) {
      return {
        gate: "G7",
        status: "UNKNOWN",
        schemaValid: true,
        hashValid: true,
        signatureValid: null,
        summary: "Receipt has an HMAC signature, but no verification key was provided.",
      };
    }
    const expectedMac = hmacSha256Hex(hmacKey, expectedHash);
    if (!safeEqualHex(expectedMac, receipt.signature.value)) {
      return {
        gate: "G7",
        status: "FAIL",
        schemaValid: true,
        hashValid: true,
        signatureValid: false,
        summary: "Receipt HMAC signature did not verify.",
      };
    }
    return {
      gate: "G7",
      status: "PASS",
      schemaValid: true,
      hashValid: true,
      signatureValid: true,
      summary: "Receipt schema, content hash, and HMAC signature verified.",
    };
  }
  return {
    gate: "G7",
    status: "PASS",
    schemaValid: true,
    hashValid: true,
    signatureValid: null,
    summary: "Receipt schema and content hash verified. The receipt is unsigned because no HMAC key was used.",
  };
}

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_TOKEN_ENV = "SHIPOS_ADMIN_TOKEN";
export const ADMIN_TOKEN_HEADER = "x-shipos-admin-token";

const KEY_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KEY_CORE_LENGTH = 32;

export function sha256Hex(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function hashApiKey(secret) {
  return sha256Hex(secret);
}

export function isHashedApiKey(stored) {
  return typeof stored === "string" && /^[a-f0-9]{64}$/i.test(stored);
}

export function isPlainApiKey(stored) {
  return typeof stored === "string" && stored.startsWith("skos_") && stored.length > 9;
}

export function safeEqualString(left, right) {
  const a = Buffer.from(sha256Hex(left ?? ""), "hex");
  const b = Buffer.from(sha256Hex(right ?? ""), "hex");
  return timingSafeEqual(a, b);
}

export function readAdminToken(headers) {
  const get = (name) => {
    if (!headers) return "";
    if (typeof headers.get === "function") return headers.get(name) ?? "";
    const direct = headers[name] ?? headers[name.toLowerCase()];
    return direct ?? "";
  };
  const dedicated = String(get(ADMIN_TOKEN_HEADER)).trim();
  if (dedicated) return dedicated;
  const match = /^Bearer\s+(\S+)/i.exec(String(get("authorization")).trim());
  return match ? match[1] : "";
}

export function authorizeAdmin(envToken, providedToken) {
  if (!envToken || !String(envToken).trim()) {
    return {
      ok: false,
      status: 503,
      error: "API key administration is disabled until SHIPOS_ADMIN_TOKEN is set.",
    };
  }
  if (!providedToken || !safeEqualString(String(envToken).trim(), String(providedToken))) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}

export function authorizeAdminFromRequest(request, env = process.env) {
  return authorizeAdmin(env[ADMIN_TOKEN_ENV], readAdminToken(request.headers));
}

export function newApiKey() {
  const chars = [];
  const limit = 256 - (256 % KEY_ALPHABET.length);
  while (chars.length < KEY_CORE_LENGTH) {
    const bytes = randomBytes(KEY_CORE_LENGTH - chars.length);
    for (const byte of bytes) {
      if (byte < limit) chars.push(KEY_ALPHABET[byte % KEY_ALPHABET.length]);
      if (chars.length === KEY_CORE_LENGTH) break;
    }
  }
  return `skos_${chars.join("")}`;
}

export function describeApiKey(secret) {
  if (!isPlainApiKey(secret)) {
    return { keyPrefix: "skos_", keyLast4: "" };
  }
  return {
    keyPrefix: secret.slice(0, 9),
    keyLast4: secret.slice(-4),
  };
}

export function maskApiKey(record) {
  const prefix = record?.keyPrefix;
  const last4 = record?.keyLast4;
  if (prefix && last4) return `${prefix}…${last4}`;
  if (isPlainApiKey(record?.key)) {
    const parts = describeApiKey(record.key);
    return `${parts.keyPrefix}…${parts.keyLast4}`;
  }
  return "skos_…";
}

export function storedApiKeyFields(secret) {
  const { keyPrefix, keyLast4 } = describeApiKey(secret);
  return {
    key: hashApiKey(secret),
    keyPrefix,
    keyLast4,
  };
}

export function needsApiKeyMigration(record) {
  return isPlainApiKey(record?.key);
}

export function migratedApiKeyFields(record) {
  if (!needsApiKeyMigration(record)) return null;
  return storedApiKeyFields(record.key);
}

export function lookupApiKeyHash(secret) {
  return hashApiKey(secret);
}

export function toPublicApiKey(record) {
  return {
    id: record.id,
    key: maskApiKey(record),
    masked: maskApiKey(record),
    label: record.label,
    usageCount: record.usageCount,
    lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt).toISOString() : null,
    createdAt: new Date(record.createdAt).toISOString(),
  };
}

export function toCreatedApiKey(record, secret) {
  return {
    ok: true,
    ...toPublicApiKey(record),
    key: secret,
  };
}

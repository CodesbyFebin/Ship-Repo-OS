import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function sha256Hex(value) {
  const data = typeof value === "string" ? value : value;
  return createHash("sha256").update(data).digest("hex");
}

export function hmacSha256Hex(key, value) {
  return createHmac("sha256", key).update(value).digest("hex");
}

export function safeEqualHex(left, right) {
  const a = Buffer.from(String(left ?? ""), "hex");
  const b = Buffer.from(String(right ?? ""), "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
    return out;
  }
  return value;
}

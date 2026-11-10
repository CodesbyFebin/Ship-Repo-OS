import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_TOKEN_HEADER,
  authorizeAdmin,
  authorizeAdminFromRequest,
  describeApiKey,
  hashApiKey,
  isHashedApiKey,
  isPlainApiKey,
  maskApiKey,
  migratedApiKeyFields,
  needsApiKeyMigration,
  newApiKey,
  readAdminToken,
  safeEqualString,
  storedApiKeyFields,
  toCreatedApiKey,
  toPublicApiKey,
} from "../src/lib/shipos/api-keys.mjs";

test("admin authorization fails closed when the token is unset and rejects mismatches in constant time", () => {
  assert.equal(authorizeAdmin(undefined, "anything").status, 503);
  assert.equal(authorizeAdmin("", "anything").status, 503);
  assert.equal(authorizeAdmin("   ", "secret").status, 503);
  assert.equal(authorizeAdmin("secret", "").status, 401);
  assert.equal(authorizeAdmin("secret", "Secret").status, 401);
  assert.equal(authorizeAdmin("secret", "secret").ok, true);
  assert.equal(safeEqualString("abc", "abc"), true);
  assert.equal(safeEqualString("abc", "abd"), false);
});

test("admin tokens are accepted from the dedicated header or a Bearer token", () => {
  assert.equal(readAdminToken({ [ADMIN_TOKEN_HEADER]: " from-header " }), "from-header");
  assert.equal(readAdminToken({ authorization: "Bearer tok-1" }), "tok-1");
  const headers = new Headers({ authorization: "Bearer ignored", [ADMIN_TOKEN_HEADER]: "preferred" });
  assert.equal(readAdminToken(headers), "preferred");
  const request = { headers: new Headers({ authorization: "Bearer env-ok" }) };
  assert.equal(authorizeAdminFromRequest(request, { SHIPOS_ADMIN_TOKEN: "env-ok" }).ok, true);
  assert.equal(authorizeAdminFromRequest({ headers: new Headers() }, {}).status, 503);
});

test("new keys are hashed for storage and masked to a prefix plus last four in listings", () => {
  const secret = newApiKey();
  assert.match(secret, /^skos_[a-hj-km-np-zA-HJ-NP-Z2-9]{32}$/);
  assert.equal(isPlainApiKey(secret), true);
  const stored = storedApiKeyFields(secret);
  assert.equal(isHashedApiKey(stored.key), true);
  assert.equal(stored.key, hashApiKey(secret));
  assert.notEqual(stored.key, secret);
  assert.equal(stored.keyPrefix, secret.slice(0, 9));
  assert.equal(stored.keyLast4, secret.slice(-4));
  const masked = maskApiKey(stored);
  assert.equal(masked, `${stored.keyPrefix}…${stored.keyLast4}`);
  assert.equal(masked.includes(secret.slice(9, -4)), false);
  assert.equal(maskApiKey({ key: stored.key }), "skos_…");
});

test("legacy plaintext rows are detected and can be migrated without changing /api/v1/audit lookup", () => {
  const secret = "skos_abcdefghijkmnpqrstuvwxyz234567";
  const record = { key: secret, keyPrefix: "", keyLast4: "" };
  assert.equal(needsApiKeyMigration(record), true);
  assert.deepEqual(migratedApiKeyFields(record), storedApiKeyFields(secret));
  assert.equal(needsApiKeyMigration({ key: hashApiKey(secret) }), false);
  assert.equal(maskApiKey(record), `${describeApiKey(secret).keyPrefix}…${secret.slice(-4)}`);
});

test("public listings never include the raw secret; creation responses include it once", () => {
  const secret = newApiKey();
  const record = {
    id: "key_1",
    ...storedApiKeyFields(secret),
    label: "ci-bot",
    usageCount: 2,
    lastUsedAt: "2026-11-11T00:00:00.000Z",
    createdAt: "2026-11-10T00:00:00.000Z",
  };
  const listed = toPublicApiKey(record);
  assert.equal(listed.key, maskApiKey(record));
  assert.equal(listed.masked, listed.key);
  assert.equal(Object.values(listed).includes(secret), false);
  const created = toCreatedApiKey(record, secret);
  assert.equal(created.ok, true);
  assert.equal(created.key, secret);
  assert.equal(created.masked, maskApiKey(record));
});

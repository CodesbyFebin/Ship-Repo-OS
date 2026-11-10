# Security

This repository includes an offline Workbench and a single-instance demo application. Keep the demo application behind local or trusted access. Its shared project, job, and demo license APIs are not designed for multi-tenant hosting.

If GitHub private vulnerability reporting is enabled for the repository, use its Security tab. Otherwise, contact the repository maintainer through a private channel before disclosing details.

Include the affected version or commit, impact, prerequisites, and minimal reproduction steps. Keep credentials, personal data, and exploit details out of public issues.

## API key administration

`GET`, `POST`, and `DELETE` `/api/apikeys` require `SHIPOS_ADMIN_TOKEN`. The server fails closed with HTTP 503 if that variable is unset, and HTTP 401 if the token does not match. Send the token in the `x-shipos-admin-token` header or as `Authorization: Bearer <token>`.

Stored keys are SHA-256 hashes. List responses show only a prefix and the last four characters. The full `skos_` secret is returned once, in the `POST` response at creation. `/api/v1/audit` still accepts the original secret in `x-api-key` and looks it up by hash. Existing plaintext rows are hashed on first successful use or by running `node scripts/migrate-apikeys.mjs` after `bun run db:push`.
## Evidence receipts

The P0 evidence engine can issue a receipt with a schema version, canonical content hash, and optional HMAC-SHA256 signature when `SHIPOS_EVIDENCE_HMAC_KEY` is set. A hash or signature only attests to the receipt bytes, not to the authenticity of an upstream website or GitHub setting that was not fetched.

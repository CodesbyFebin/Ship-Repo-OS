# Security

This repository includes an offline Workbench and a single-instance demo application. Keep the demo application behind local or trusted access. Its shared project, job, and demo license APIs are not designed for multi-tenant hosting.

If GitHub private vulnerability reporting is enabled for the repository, use its Security tab. Otherwise, contact the repository maintainer through a private channel before disclosing details.

Include the affected version or commit, impact, prerequisites, and minimal reproduction steps. Keep credentials, personal data, and exploit details out of public issues.

## Evidence receipts

The P0 evidence engine can issue a receipt with a schema version, canonical content hash, and optional HMAC-SHA256 signature when `SHIPOS_EVIDENCE_HMAC_KEY` is set. A hash or signature only attests to the receipt bytes, not to the authenticity of an upstream website or GitHub setting that was not fetched.

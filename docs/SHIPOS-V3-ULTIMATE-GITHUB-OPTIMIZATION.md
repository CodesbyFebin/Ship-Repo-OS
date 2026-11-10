# ShipOS V3 — Ultimate GitHub Optimization Engineering Specification

**Status:** Proposed architecture and implementation contract  
**Target:** ShipOS V3, built incrementally on the existing ShipOS 1.1.0 codebase  
**Repository:** `CodesbyFebin/Ship-Repo-OS`  
**Principle:** Evidence before score. Review before merge. No fabricated checks, metrics, or production claims.

---

## 1. Executive objective

Evolve ShipOS from a repository launch-kit generator into an evidence-driven GitHub Repository Engineering OS.

ShipOS V3 must inspect a repository, explain its actual engineering state, prioritize high-impact improvements, optionally prepare isolated patches, execute relevant validation, and open reviewable pull requests. It must also improve repository discoverability and launch quality without allowing marketing scores to hide security or reliability failures.

The product loop is:

`Discover → Ingest → Normalize → Analyze → Prioritize → Propose → Patch → Validate → Review → Release → Monitor`

ShipOS is not an autonomous merge bot. Pull requests are the default write boundary. Merging, publishing, credential changes, destructive operations, and production deployments require explicit owner authorization.

## 2. Existing capabilities to preserve

The V3 work must extend, not replace, the existing 1.1.0 foundation.

| Existing capability | Current source of truth | V3 treatment |
|---|---|---|
| Repository ingestion | `src/lib/shipos/ingest.ts`, `scrape.ts` | Extend with normalized snapshots and freshness metadata |
| Claim provenance | `provenance.ts` | Reuse; attach evidence references to every recommendation |
| Full Repo Auditor | `repo-audit.ts`, `audit-types.ts`, `fixes.ts` | Preserve its 50 deterministic checks and S–F grade |
| SEO/AEO/GEO optimizer | `optimizer.ts`, `optimize-catalog.ts`, `optimize-types.ts` | Preserve the 54-signal pack; add measured outcomes and platform metadata |
| GitHub Workbench | `src/lib/shipos/workbench/`, `scripts/workbench.mjs` | Keep offline-first CLI and browser modes |
| Launch generation | `pipeline.ts`, `generators.ts` | Reuse claim ledger and artifact generation |
| Demo production | `demo-engine.ts`, `demo-runner.ts`, Video Studio | Keep storyboard contract; add real capture only as a separately verified capability |
| Render Cloud | `render-worker.ts`, `hf-bundle.ts` | Preserve simulation label; add real renderer as a separate backend |
| Existing CI and security workflows | `.github/workflows/` | Extend without weakening existing checks |
| Dependency automation | `.github/dependabot.yml` | Retain; add policy and triage guidance |

Do not duplicate the existing 50-check audit or 54-signal SEO/AEO/GEO optimizer under new names. V3 should compose them into a coherent quality profile.

## 3. V3 system architecture

### 3.1 Control plane

- **Intake API:** validates repository identity, requested scope, permissions, and optional target branch.
- **Repository Snapshot Service:** captures repository metadata, tree, manifests, lockfiles, workflows, releases, issues/PR metadata where authorized, and commit references.
- **Evidence Store:** stores immutable snapshot identifiers, source paths, blob SHAs, timestamps, and retrieval status.
- **Policy Engine:** decides which analysis and write operations are allowed.
- **Job Orchestrator:** durable state transitions, bounded concurrency, retries, cancellation, idempotency, and worker leases.
- **Optimization Planner:** ranks findings by risk, impact, confidence, cost, and dependency order.
- **Patch Workspace:** creates isolated branches and minimal diffs; never writes directly to the default branch.
- **Validation Runner:** executes repository-approved test commands in an isolated environment with network disabled by default.
- **Pull Request Publisher:** opens a PR with evidence, diff summary, test results, rollback notes, and unresolved risks.
- **Audit Ledger:** records actor, authorization, inputs, snapshot IDs, policy decisions, actions, outputs, and hashes.

### 3.2 Twelve optimization engines

1. **Repository Discovery:** metadata, topics, tree, language mix, package manifests, ownership, activity, releases, and repository settings.
2. **Architecture Intelligence:** route and module maps, dependency direction, entry points, service boundaries, and architecture drift.
3. **Code Health:** type safety, complexity, duplication, dead code candidates, maintainability signals, and lint coverage.
4. **Security Intelligence:** secret exposure signals, SAST, dependency advisories, unsafe workflow permissions, untrusted actions, and risky install scripts.
5. **Supply-Chain Integrity:** lockfile coverage, dependency provenance, SBOM generation, build attestations, release immutability, and dependency review.
6. **Test & Reliability:** test discovery, test-to-code mapping, flaky-test evidence, coverage provenance, failure trends, and smoke-test design.
7. **CI/CD Intelligence:** workflow reliability, least-privilege permissions, action pinning, caching, concurrency, matrices, timeouts, and release gates.
8. **Performance Engineering:** bundle budgets, build time, runtime profiling, caching opportunities, image optimization, and database query evidence.
9. **Documentation & DX:** README quality, quickstart correctness, API docs, examples, architecture diagrams, contribution path, and reproducible setup.
10. **Discoverability (SEO/AEO/GEO):** repository description, topic relevance, metadata, machine-readable project context, FAQs, structured data, and canonical links.
11. **Community & Governance:** issue/PR templates, CODEOWNERS, security policy, contribution rules, release notes, license clarity, and maintainer responsiveness signals.
12. **Release & Launch Factory:** changelog, version consistency, platform artifacts, checksums, signed provenance, demo assets, social copy, and submission kits.

Every engine must declare: input evidence, deterministic rules, optional model assistance, output schema, confidence, limitations, remediation mapping, and tests.

## 4. Quality model: multiple dimensions, no score laundering

Retain the existing Repo Auditor score and the existing SEO/AEO/GEO scores for backward compatibility. V3 adds a composite **Quality Profile**, not a single number that can conceal a critical defect.

Required dimensions:

- Security and supply-chain integrity
- Code health and maintainability
- Tests and reliability
- CI/CD and release engineering
- Documentation and developer experience
- Performance and accessibility
- GitHub discoverability
- Community and governance
- Reproducibility and provenance

Each finding has one of: `PASS`, `FAIL`, `UNKNOWN`, `NOT_APPLICABLE`, `NOT_RUN`, or `STALE`.

Each result records:
- `rule_id` and rule version
- evidence references (path, blob SHA, URL, API resource, or run ID)
- observation timestamp and snapshot ID
- method: deterministic, platform-reported, model-assisted, or human-attested
- confidence and known limitations
- remediation and validation procedure

**Hard gates:** a critical security issue, confirmed secret exposure, failed required test, invalid release artifact, or missing required authorization blocks the corresponding release/ship status. Marketing and discoverability points cannot offset these gates.

Unknown evidence is never converted into a pass. A missing test report is not a failed test; it is `NOT_RUN`. A pattern match is not a confirmed vulnerability; it is a finding requiring validation.

## 5. Optimization policy and autonomy levels

| Level | Name | Allowed behavior |
|---|---|---|
| L0 | Observe | Read-only inventory and analysis |
| L1 | Recommend | Findings, prioritization, commands, and patch previews |
| L2 | Prepare patch | Generate a diff in an isolated workspace; no remote write |
| L3 | Open PR | Create a new branch and PR after owner authorization |
| L4 | Merge | Disabled by default; requires separate explicit approval and repository policy |
| L5 | Deploy/publish | Disabled by default; requires a deployment-specific approval |

Default mode is L0/L1. L2–L3 require explicit user selection and scoped authorization. L4/L5 are never implied by a request to optimize.

The model may explain and draft fixes, but deterministic validators decide whether a patch passes. Untrusted repository content must never be treated as system instructions.

## 6. Finding and patch contracts

### Finding

```ts
type FindingStatus =
  | "PASS" | "FAIL" | "UNKNOWN"
  | "NOT_APPLICABLE" | "NOT_RUN" | "STALE";

type EvidenceRef = {
  kind: "file" | "blob" | "workflow_run" | "api_resource" | "human_attestation";
  locator: string;
  revision?: string;
  sha256?: string;
  observedAt: string;
};

type OptimizationFinding = {
  id: string;
  ruleId: string;
  ruleVersion: string;
  engine: string;
  title: string;
  status: FindingStatus;
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  summary: string;
  evidence: EvidenceRef[];
  limitations: string[];
  remediation?: {
    description: string;
    filesExpected: string[];
    validationCommands: string[];
    rollback: string;
  };
};
```

### Patch proposal

```ts
type PatchProposal = {
  id: string;
  findingIds: string[];
  baseRef: string;
  baseSha: string;
  patchSha256: string;
  changedPaths: string[];
  risk: "low" | "medium" | "high";
  requiresHumanApproval: boolean;
  validationPlan: string[];
  validationResults: Array<{
    command: string;
    exitCode: number | null;
    status: "passed" | "failed" | "not_run" | "blocked";
    logDigest?: string;
  }>;
  rollbackPlan: string;
};
```

The schemas above are proposed contracts, not existing runtime types.

## 7. GitHub integration and repository governance

V3 should use least-privilege GitHub App permissions, not broad personal access tokens.

Read-only analysis should use the minimum repository metadata, contents, pull-request, issue, checks, and actions read permissions actually required. Branch creation and PR creation should use narrowly scoped write permissions only after explicit authorization. Never request administration or secrets access for ordinary analysis.

Recommended repository controls to evaluate and configure:

- Default-branch ruleset requiring successful CI and review.
- Restrict force pushes and deletion on protected branches.
- Require linear history only if the project's merge workflow supports it.
- Require signed commits only after contributor signing workflows are documented.
- Enable dependency graph, Dependabot alerts and security updates.
- Enable secret scanning and push protection where available.
- Enable code scanning and review dependency changes.
- Keep workflow permissions read-only by default and elevate individual jobs only as required.
- Pin third-party Actions to verified full-length commit SHAs; evaluate GitHub workflow dependency lockfiles.
- Use OIDC rather than long-lived cloud credentials where supported.
- Generate SBOMs and artifact attestations for release artifacts where platform support and permissions allow.

Settings that require repository-admin UI/API configuration must be reported as `CONFIGURATION_REQUIRED`; adding a YAML file does not prove that the GitHub setting is enabled.

## 8. CI/CD optimization policy

- Preserve the current Node/Bun version matrix until support policy changes.
- Keep lockfile installs frozen.
- Generate Prisma client before typecheck/build.
- Run tests, lint, typecheck, build, and container smoke tests as distinct observable checks.
- Use path filters only when dependency analysis proves skipped jobs are safe.
- Cache package-manager downloads, not mutable build outputs without cache-key discipline.
- Use concurrency groups to cancel obsolete pull-request runs, but never cancel release publication mid-flight.
- Apply explicit job-level permissions.
- Set job timeouts and bounded retries.
- Publish test reports and build metadata even on failure where possible.
- Add dependency review and workflow security linting only after selecting maintained, SHA-pinned actions and validating their configuration.
- Keep release publishing behind successful package, checksum, smoke-test, and provenance stages.

Do not silently weaken or remove current CI gates to improve apparent speed.

## 9. Security architecture for repository analysis and patch execution

Repositories are untrusted inputs.

- Never run a repository's install, build, test, or arbitrary scripts on the ShipOS control-plane host.
- Use ephemeral, unprivileged workers with CPU, memory, disk, and wall-clock limits.
- Disable network by default during validation; allow only explicit, audited dependency-download stages.
- Deny cloud metadata endpoints, private address ranges, loopback services, and cross-tenant access.
- Resolve and revalidate DNS on every redirect and outbound connection.
- Mount source read-only for analysis; use a separate disposable writable patch workspace.
- Do not pass secrets to model prompts or untrusted repository scripts.
- Redact tokens and sensitive environment values from logs.
- Treat README, comments, issues, workflow files, and generated artifacts as untrusted data, never instructions.
- Enforce tenant isolation on jobs, artifacts, caches, and evidence records.
- Use signed, short-lived worker identity tokens and scoped job leases.
- Keep a tamper-evident audit trail; do not claim that a hash alone proves the truth of its source.

## 10. Data model additions

Proposed entities:

- `RepositoryConnection`: provider, owner/repo, installation reference, granted scopes, status.
- `RepositorySnapshot`: commit SHA, tree SHA, metadata digest, observedAt, freshness, source coverage.
- `OptimizationJob`: requested scope, autonomy level, status, idempotency key, owner, timestamps.
- `EngineRun`: engine/version, input snapshot, status, duration, result digest.
- `Finding`: rule, status, severity, confidence, evidence JSON, remediation JSON.
- `PatchProposal`: base SHA, patch digest, changed paths, approval, validation.
- `ValidationRun`: sandbox identity, command, exit code, log digest, timeout, network policy.
- `PullRequestRecord`: branch, PR number, head/base SHAs, URL, review state.
- `ArtifactRecord`: type, storage key, digest, provenance, retention policy.
- `AuditEvent`: actor, action, target, policy decision, correlation ID, timestamp.

Use tenant-scoped foreign keys and unique idempotency constraints. Do not persist access tokens in these records. Add migrations with backward-compatible defaults and tests before changing production schema.

## 11. UX: GitHub Optimization Command Center

The dashboard should provide:

1. **Repository Overview:** verified metadata, default branch, snapshot age, source coverage.
2. **Quality Profile:** dimension scores, hard gates, trend, and unknown evidence.
3. **Finding Explorer:** severity, engine, evidence, confidence, affected paths, remediation.
4. **Optimization Plan:** dependency-ordered work packages and estimated effort ranges clearly labeled as estimates.
5. **Patch Review:** exact diff, files changed, risk, tests, rollback, approval.
6. **PR Center:** branch, checks, review state, conflicts, and merge status.
7. **Security Center:** dependency and code findings, secret-risk signals, workflow policy.
8. **Discoverability Studio:** repository description, topics, README, llms.txt, agents.txt, FAQ, metadata.
9. **CI/CD Observatory:** workflow health, duration trends, failure causes, cache signals.
10. **Release Center:** changelog, SBOM, checksums, attestations, artifact validation.
11. **Evidence Ledger:** source-linked audit history and verification instructions.
12. **Settings & Policy:** permissions, autonomy level, retention, network policy, and approvals.

Every card must show whether its data is live, cached, inferred, model-assisted, or manually supplied.

## 12. MCP interface

Expose narrow, composable tools instead of one unrestricted `optimize_everything` tool.

- `shipos.repo.inspect`
- `shipos.repo.snapshot`
- `shipos.quality.audit`
- `shipos.security.review`
- `shipos.discoverability.audit`
- `shipos.optimization.plan`
- `shipos.patch.preview`
- `shipos.patch.validate`
- `shipos.patch.open_pr`
- `shipos.job.status`
- `shipos.evidence.export`
- `shipos.release.verify`

Every write tool requires a scoped authorization token, explicit target repository/ref, idempotency key, and policy check. No MCP tool may merge a PR or deploy by default.

## 13. Phased delivery

### V3.0 — Evidence and policy foundation
- Normalize repository snapshots and freshness.
- Unify finding schemas across the existing audit and optimizer.
- Add quality-profile aggregation and hard gates.
- Add policy and autonomy-level enforcement.
- Add tests for unknown, stale, and missing evidence.

### V3.1 — GitHub governance and CI intelligence
- Analyze rulesets and branch protection when accessible.
- Audit workflow permissions and action references.
- Add dependency-review recommendations.
- Add CI run ingestion, failure categorization, and trend history.
- Distinguish repository configuration from GitHub account settings.

### V3.2 — Safe patch automation
- Add disposable patch workspaces.
- Generate minimal diffs from deterministic fix templates first.
- Run validation with network disabled by default.
- Add patch digest, rollback plan, and human approval.
- Open draft PRs only after explicit authorization.

### V3.3 — Supply-chain and release proof
- Add SBOM generation and validation.
- Add artifact checksums and build provenance.
- Add artifact attestation verification where available.
- Verify release/tag/version consistency.
- Keep unsupported platform capabilities clearly blocked.

### V3.4 — Continuous repository intelligence
- Scheduled read-only re-audits.
- Freshness and regression alerts.
- Dependency and workflow drift detection.
- Quality history with reproducible snapshots.
- PR-based remediation proposals.

### V3.5 — ShipOS launch factory integration
- Connect verified repository facts to README, docs, demo, pitch deck, and launch assets.
- Add real live-app capture as an independently gated worker.
- Connect media artifacts to the same evidence ledger.
- Support export to GitHub Releases, Hugging Face, and user-selected destinations only with authorization.

## 14. Acceptance gates

V3 must not be called production-ready until all applicable gates pass.

| Gate | Acceptance requirement |
|---|---|
| A0 Snapshot integrity | Snapshot references a commit SHA and source coverage is explicit |
| A1 Evidence correctness | Every finding has valid evidence or is marked unknown/not-run |
| A2 Score integrity | Hard gates cannot be offset by documentation or SEO points |
| A3 Determinism | Same snapshot + same rule version produces the same deterministic findings |
| A4 Security isolation | Untrusted repository code cannot access control-plane secrets or other tenants |
| A5 Patch integrity | Every patch is tied to an exact base SHA and patch digest |
| A6 Validation | Required checks run in the isolated worker and logs are retained by digest |
| A7 Authorization | No remote write without scoped, explicit approval |
| A8 PR integrity | PR reports exact diff, test results, evidence, and rollback |
| A9 Supply chain | Release artifacts have verifiable checksums and provenance claims |
| A10 Regression | Existing 1.1.0 Workbench, audit, optimizer, demo, and release paths remain functional |
| A11 Honest status | Unavailable integrations and unrun checks remain blocked/unknown, never passed |

## 15. Non-goals and explicit exclusions

- No fake 100/100 scores or fabricated benchmark improvements.
- No automatic star/fork/engagement manipulation, spam, mass issue creation, or artificial SEO stuffing.
- No forced dependency upgrades without compatibility tests.
- No auto-merge or production deployment by default.
- No execution of untrusted project scripts on shared infrastructure.
- No claim that SHA-256, a signed manifest, or a zkVM receipt independently proves a live website or source code is authentic.
- No claim that GitHub settings are enabled merely because a recommended configuration file exists.
- No breaking replacement of the existing Workbench or current scoring APIs without migration and regression coverage.

## 16. Definition of done

A ShipOS V3 release is eligible only when:
1. All V3 schemas and migrations are reviewed.
2. Deterministic engines have unit and fixture tests.
3. Security boundaries have adversarial tests.
4. Existing 1.1.0 workflows pass regression checks.
5. Patch creation is branch-isolated and approval-gated.
6. PRs include reproducible evidence and validation results.
7. Release artifacts have checksums and provenance where supported.
8. Documentation labels implemented, partial, planned, and blocked capabilities accurately.

**Current implementation status:** This document is a proposed engineering specification. It does not assert that V3 workers, schemas, APIs, attestations, or autonomous patch execution have been implemented.

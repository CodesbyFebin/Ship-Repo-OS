const item = (id, path, title, render, setup = "") => ({ id, path, title, render, setup });
const json = (value) => JSON.stringify(value, null, 2);
const clean = (value) => value.trim().replace(/\s+/g, " ").slice(0, 300);
const markdown = (value) => value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[character])).replace(/[\\`*_\[\]|]/g, "\\$&");

const ARTIFACTS = [
  item("repository-readme", "README.md", "Repository README", ({ repo, summary, url }) => `# ${repo}

${summary || "Describe the problem this repository solves and who uses it."}

![${repo} repository banner](media/banner.svg)

## Quick start

Document prerequisites and the exact installation commands here.

## Usage

Add the smallest runnable example and its expected output.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [issue tracker](${url}/issues).

## License

Identify the project license here after the maintainers have selected it.`, "Replace setup, usage, and license instructions before publishing."),
  item("profile-readme", "profile/README.md", "GitHub profile README", ({ owner, repo, url, summary }) => `# Hi, I’m ${owner}

## Featured project

- [${repo}](${url})${summary ? ` — ${summary}` : ""}

## Around GitHub

- [Public repositories](https://github.com/${owner}?tab=repositories)`, "Place this at README.md in the public username/username repository for a personal account."),
  item("contributing", "CONTRIBUTING.md", "Contributor guide", ({ url }) => `# Contributing

1. Search [open issues](${url}/issues) for related work.
2. Discuss changes that alter public behavior in an issue first.
3. Create a branch and keep the diff focused.
4. Run the checks documented in the README and record the results in the pull request.
5. Include migration notes and a regression test for behavior changes.`),
  item("security", "SECURITY.md", "Vulnerability disclosure policy", ({ url }) => `# Security

Use [private vulnerability reporting](${url}/security/advisories/new) when enabled. Avoid posting exploit details in a public issue.

Include the affected version, prerequisites, reproduction steps, and impact. Remove secrets and personal data before sending evidence.

Maintainers should confirm the supported release branches and enable private vulnerability reporting before publishing this policy.`, "Confirm supported versions and the private reporting route."),
  item("support", "SUPPORT.md", "Support routes", ({ url }) => `# Support

- Search [existing issues](${url}/issues) before opening a bug.
- Include the version, environment, minimal example, and expected result.
- Report vulnerabilities through [SECURITY.md](SECURITY.md).`),
  item("changelog", "CHANGELOG.md", "Changelog", () => `# Changelog

## Unreleased

### Added

### Changed

### Fixed

### Security`),
  item("bug", ".github/ISSUE_TEMPLATE/bug_report.yml", "Bug issue form", () => `name: Bug report
description: Report a reproducible problem
body:
  - type: textarea
    id: reproduction
    attributes:
      label: Steps to reproduce
      description: Include the affected version and environment.
    validations:
      required: true
  - type: textarea
    id: result
    attributes:
      label: Expected and actual behavior
      description: Remove secrets and personal data from logs.
    validations:
      required: true`),
  item("feature", ".github/ISSUE_TEMPLATE/feature_request.yml", "Feature issue form", () => `name: Feature request
description: Propose a change that solves a specific problem
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem and who experiences it
    validations:
      required: true
  - type: textarea
    id: outcome
    attributes:
      label: Desired outcome and acceptance criteria
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered`),
  item("issue-routing", ".github/ISSUE_TEMPLATE/config.yml", "Issue routing", ({ url }) => `blank_issues_enabled: true
contact_links:
  - name: Private vulnerability report
    url: ${url}/security/advisories/new
    about: Report vulnerabilities privately when the repository has enabled this feature.`, "Enable and test the private contact link."),
  item("pr", ".github/pull_request_template.md", "Pull request template", () => `## What changed?

## Linked issue

## Verification

- [ ] I ran the relevant checks and included the results.
- [ ] I updated docs for behavior changes.
- [ ] I reviewed migration and rollback needs.`),
  item("editorconfig", ".editorconfig", "Editor configuration", () => `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[{Makefile,*.mk}]
indent_style = tab`),
  item("git-attributes", ".gitattributes", "Git line endings", () => `* text=auto
*.sh text eol=lf
*.bat text eol=crlf
*.png binary
*.gif binary
*.mp4 binary
*.webm binary`),
  item("codeowners", ".github/CODEOWNERS", "Ownership starter", () => `# Replace the sample with a GitHub user or team that has write access.
# * @your-organization/maintainers
# /.github/ @your-organization/release-team`, "Assign real owners with write access and verify CODEOWNERS in GitHub."),
  item("dependabot", ".github/dependabot.yml", "Actions dependency updates", () => `version: 2
updates:
  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 5`, "Add the package ecosystems and directories used by this repository."),
  item("architecture", "docs/architecture.md", "Architecture guide", () => `# Architecture

## Context

Identify users, inputs, and upstream systems.

## Components

List each component and its responsibility.

## Data flow

Trace a successful request and a failed request.

## Operational boundaries

Record trust boundaries, data retention, and how to recover from partial failure.`),
  item("decision", "docs/adr/0000-template.md", "Decision record", () => `# Decision title

- Status: Proposed
- Date: YYYY-MM-DD
- Owners:

## Context

## Options considered

## Decision

## Consequences and reversal conditions`),
  item("release", "docs/release-checklist.md", "Release checklist", () => `# Release checklist

- [ ] Select the version and update the changelog.
- [ ] Verify the build from a clean checkout.
- [ ] Run tests against migration and rollback paths.
- [ ] Build artifacts and record SHA-256 checksums.
- [ ] Publish the tag and release notes.
- [ ] Smoke-test the published artifacts.
- [ ] Record who can roll back and how.`),
  item("triage", "docs/issue-triage.md", "Issue triage runbook", () => `# Issue triage

1. Check for duplicates and acknowledge the report.
2. Reproduce with a minimal example and record version and impact.
3. Route security issues to private disclosure.
4. Label impact, assign an owner, and document the next step.
5. Close with a fix reference, workaround, or reason.`),
  item("diagnostics", "docs/troubleshooting.md", "Troubleshooting guide", () => `# Troubleshooting

| Symptom | Diagnostic step | Expected signal | Recovery |
| --- | --- | --- | --- |
| Install fails | Compare runtime and lockfile requirements with the README | Versions match | Retry a frozen install from a clean checkout |
| CI fails | Inspect the first failed job | Failure is reproducible locally | Run the same command and capture output |
| Configuration fails | Compare variable names with the example | Names are present | Set missing variables without logging values |`),
  item("metadata", "github/about.json", "GitHub About settings", ({ repo, summary, url }) => json({ description: summary, homepage: "", candidateTopics: [...new Set(repo.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))].slice(0, 20), repository: url }), "Review the candidate topics and apply the settings in GitHub About."),
  item("citation", "CITATION.cff", "Citation metadata", ({ repo, owner, url }) => `cff-version: 1.2.0
message: "If you use this software, please cite it using this metadata."
title: "${repo}"
type: software
authors:
  - name: "${owner}"
repository-code: "${url}"`, "Confirm the authors, release version, and publication details."),
  item("faq", "docs/faq.md", "FAQ starter", ({ repo }) => `# Frequently asked questions

## What problem does ${repo} solve?

Describe the main use case.

## What do I need to get started?

List the prerequisites and link to a verified quick start.

## Where do I report a problem?

Use the repository’s [support guide](../SUPPORT.md).`),
  item("llms", "llms.txt", "Machine-readable project index", ({ repo, url, summary }) => `# ${repo}

${summary ? `> ${summary}\n\n` : ""}## Canonical links

- [Repository](${url}): source code and README
- [Issues](${url}/issues): bugs and requests
- [Releases](${url}/releases): published versions`),
  item("announcement", "launch/announcement.md", "Launch announcement", ({ repo, summary, url }) => `# Introducing ${repo}

${summary || "Add one factual sentence about the problem the project solves."}

- [Explore the source](${url})
- [Send feedback](${url}/issues)`, "Add only verified capabilities and links before publishing."),
  item("media-guide", "media/PUBLISHING.md", "GitHub media publishing guide", () => `# Publishing media

1. Upload a 1280 × 640 PNG under 1 MB under repository Settings → Social preview.
2. Commit the banner or PNG and add descriptive Markdown alt text.
3. Use the GIF as an optional preview with a static fallback.
4. Link to the full MP4 and supply accurate captions or a transcript.
5. View the README in light and dark themes and check narrow layouts.

[Social preview documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)`),
  item("storyboard", "media/storyboard.md", "Demo storyboard", ({ repo }) => `# ${repo} demo storyboard

| Time | Screen | Narration |
| --- | --- | --- |
| 0–5s | Title and project link | Introduce the problem |
| 5–15s | Show initial state | Explain the input and prerequisites |
| 15–30s | Complete one real workflow | Explain the steps and resulting output |
| 30–40s | Show how to reproduce it | Point viewers to the quick start |`),
  item("accessibility", "docs/accessibility-review.md", "Accessibility review sheet", () => `# Accessibility review

- [ ] Critical flows work with keyboard only.
- [ ] Focus remains visible and returns after dismissing a dialog.
- [ ] Controls have accessible names and error messages.
- [ ] Essential images have descriptive alt text.
- [ ] Video has captions and any key visual detail is described.
- [ ] Motion respects reduced-motion preferences.
- [ ] Readable text and controls meet applicable contrast requirements.`),
  item("banner", "media/banner.svg", "Responsive repository banner", (context) => bannerSvg(context)),
  item("branch-policy", "github/branch-rules.md", "Branch rules rollout", () => `# Branch rules rollout

- Require pull requests and reviews for the default branch.
- Require only stable CI checks and confirm their names after a successful run.
- Block forced pushes and deletion of the default branch.
- Test the rules on a sample pull request before enforcement.
- Document authorized emergency bypass and audit its use.`, "Apply the policy in GitHub settings and test it with a pull request."),
  item("workflow", ".github/workflows/repository-check.yml", "Repository hygiene workflow", () => `name: Repository hygiene
on:
  pull_request:
  push:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  hygiene:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
        with:
          persist-credentials: false
          fetch-depth: 2
      - name: Verify Git patch formatting
        run: |
          if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
            git diff --check HEAD^ HEAD
          else
            git show --format= --check HEAD
          fi`, "Add stack-specific build and test commands after choosing the project runtime."),
];

export function bannerSvg({ repo, owner, rawSummary = "", eyebrow = `GITHUB  /  ${owner.toUpperCase()}`, footer = "OPEN THE REPOSITORY  →" }) {
  const xml = (text) => text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]));
  const label = repo.length > 28 ? `${repo.slice(0, 27)}…` : repo;
  const tagline = rawSummary.length > 60 ? `${rawSummary.slice(0, 59)}…` : rawSummary;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640" role="img" aria-labelledby="title description">
  <title id="title">${xml(repo)}</title><desc id="description">${xml(rawSummary || `Repository banner for ${owner}/${repo}`)}</desc>
  <defs>
    <linearGradient id="back" x2="100%" y2="100%"><stop stop-color="#09111f"/><stop offset="1" stop-color="#172744"/></linearGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 44V0H44" fill="none" stroke="#253c58"/></pattern>
  </defs>
  <rect width="1280" height="640" fill="url(#back)"/>
  <rect x="868" width="412" height="640" fill="url(#grid)" opacity=".7"/>
  <path d="M907 392 1000 299 1064 363 1190 237M1130 237h60v60" fill="none" stroke="#6de5c1" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M76 76H1204M76 560H1204" stroke="#31425e" stroke-width="2"/>
  <g font-family="DejaVu Sans, sans-serif">
    <text x="76" y="145" fill="#6de5c1" font-size="25" font-weight="700">${xml(eyebrow)}</text>
    <text x="72" y="314" fill="#f3f7ff" font-size="${Math.min(92, Math.floor(1190 / Math.max(label.length, 1)))}" font-weight="700">${xml(label)}</text>
    <text x="76" y="394" fill="#b3c3da" font-size="23">${xml(tagline)}</text>
    <text x="76" y="520" fill="#6de5c1" font-size="19">${xml(footer)}</text>
  </g>
</svg>\n`;
}

/** @param {{owner: string, repo: string, url: string}} identity @param {string} description @param {string[]} [inventory] */
export function buildPack(identity, description, inventory = []) {
  const rawSummary = clean(description);
  const context = { ...identity, rawSummary, summary: markdown(rawSummary) };
  const known = new Set(inventory.map((path) => path.toLowerCase()));
  return ARTIFACTS.map(({ id, path, title, render, setup }) => ({
    id, path, title, setup, conflict: known.has(path.toLowerCase()),
    content: `${render(id === "metadata" ? { ...context, summary: rawSummary } : context).trimEnd()}\n`,
  }));
}

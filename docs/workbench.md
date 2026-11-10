# GitHub Workbench

Open **GitHub Workbench** in the app to audit pasted evidence, build a launch kit, run utilities, and preview publishing media. Inputs for this mode stay in the browser. The local CLI uses the same audit, pack, and utility catalog.

## Local commands

```bash
node scripts/workbench.mjs audit /path/to/git-checkout
node scripts/workbench.mjs audit . --metadata ./github-settings.json --minimum 70
node scripts/workbench.mjs pack --repo owner/repo --against . --out ./local-launch-pack
node scripts/workbench.mjs tools
node scripts/workbench.mjs tool semver-bump --input "1.4.2 minor"
node scripts/workbench.mjs media --repo owner/repo --out ./local-launch-media
node scripts/workbench.mjs media --brand "Project title" --out ./local-brand-media
```

Node.js 24 and Git are sufficient for the audit, pack, and utility commands. The media command also needs FFmpeg with librsvg and libx264. Supply a new output directory for each export. The launch kit and its conflict manifest are review drafts. Merge changes with existing files before committing them.

## Evidence and scoring

The CLI inventories tracked and non-ignored files that exist in the working tree. It reads the effective README and each workflow up to 512 KiB. The browser accepts paths, README text, workflow contents as a filename-to-text JSON object, and GitHub settings as a JSON object.

Each check has one of four statuses.

| Status | Meaning |
| --- | --- |
| Pass | The supplied evidence matches the rule. |
| Fail | The supplied evidence shows a gap. |
| Unknown | The rule needs evidence that was unavailable. |
| N/A | The rule's prerequisite is absent, such as captions when there is no video. |

Readiness is passed checks divided by applicable checks. Coverage is passed plus failed checks divided by applicable checks. GitHub settings are user-reported evidence and count only when supplied. The score describes this ShipOS rubric. File checks and Markdown or YAML pattern checks are lightweight signals, so deeper security, content quality, runtime behavior, and manual GitHub settings have separate review steps.

```json
{
  "description": "Repository launch tooling for maintainers and small teams.",
  "topics": ["developer-tools", "github", "repository-audit"],
  "homepage": "https://example.org",
  "protectedBranch": true,
  "releaseCount": 1,
  "profileReadme": true,
  "socialPreview": true
}
```

Use values you have verified in GitHub. Omit fields you cannot verify. Exit code 2 from `audit --minimum` means the observed score fell below the threshold.

## Publish the media

- Put the generated profile README at the root of your public `username/username` repository if you are preparing a personal profile.
- Upload the generated 1280 × 640 PNG under repository **Settings → Social preview**.
- Commit the SVG or PNG as a README banner and give it descriptive alt text. Use a static image as the default, with a link to the looping GIF.
- The generated MP4 is a nine-second title-card teaser. Pair it with the WebVTT file. For a workflow demonstration, use ShipOS Demo Maker or Video Studio to create a project-specific video.

[GitHub profile README guide](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme) · [GitHub social preview guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)

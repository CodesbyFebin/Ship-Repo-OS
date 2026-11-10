import { markdownLinks, readmePath, resolveLink } from "./evidence.mjs";

const check = (id, group, title, run, fix) => ({ id, group, title, run, fix });
const result = (status, detail) => ({ status, detail });
const test = (ok, yes, no) => result(ok ? "pass" : "fail", ok ? yes : no);
const unknown = (detail) => result("unknown", detail);
const na = (detail) => result("n/a", detail);
const has = (pattern) => ({ inventory, complete }) => {
  const path = inventory.find((file) => pattern.test(file));
  return path ? result("pass", path) : complete ? result("fail", "No matching path in the inventory.") : unknown("Provide a complete file inventory.");
};
const readme = (inspect) => (snapshot) => {
  const path = readmePath(snapshot.inventory);
  const source = snapshot.contents.get(path);
  if (source !== undefined) return inspect(source, snapshot, path);
  return unknown("Provide the displayed README contents.");
};
const section = (pattern, label) => readme((text) => test(pattern.test(text), label, "No matching Markdown heading."));
const metadata = (field, inspect) => ({ metadata: data }) =>
  Object.hasOwn(data, field) ? inspect(data[field], data) : unknown(`Provide GitHub metadata field ${field}.`);
const workflowPath = /^\.github\/workflows\/[^/]+\.ya?ml$/i;
const workflow = (inspect) => ({ inventory, contents, complete }) => {
  const paths = inventory.filter((path) => workflowPath.test(path));
  if (!paths.length) return complete ? na("No GitHub Actions workflow in the inventory.") : unknown("Provide workflow paths and contents.");
  if (paths.some((path) => !contents.has(path))) return unknown("Provide contents for every GitHub Actions workflow.");
  return inspect(paths.map((path) => [path, contents.get(path)]));
};
const noWorkflowViolations = (violates, good, bad) => workflow((files) => {
  const paths = files.filter(([, text]) => violates(text)).map(([path]) => path);
  return test(!paths.length, good, `${bad} ${paths.join(", ")}`);
});
function hasPersistentCheckoutCredentials(text) {
  const lines = text.split(/\r?\n/);
  return lines.some((line, index) => {
    const checkout = /^( *)(- +)?uses:\s*["']?actions\/checkout@/i.exec(line);
    if (!checkout) return false;
    const stepIndent = checkout[1].length + (checkout[2]?.length ?? 0);
    let withIndent = null;
    for (const next of lines.slice(index + 1)) {
      if (!next.trim() || next.trimStart().startsWith("#")) continue;
      const indent = next.length - next.trimStart().length;
      if (indent < stepIndent) break;
      if (indent === stepIndent) {
        withIndent = /^with:\s*(?:#.*)?$/.test(next.trim()) ? indent : null;
      } else if (withIndent !== null && /^persist-credentials:\s*(?:false|"false"|'false')\s*(?:#.*)?$/.test(next.trim())) {
        return false;
      }
    }
    return true;
  });
}

const licenseFile = /^(?:licen[cs]e|copying)(?:[.-][^/]*)?$/i;

export const CHECKS = [
  check("readme", "Documentation", "Displayed README", (s) => {
    const path = readmePath(s.inventory);
    return path ? result("pass", path) : has(/$a/)(s);
  }, "Add README.md at the repository root."),
  check("readme-title", "Documentation", "README title", readme((text) => test(/^#\s+\S/m.test(text), "Top-level Markdown title found.", "No top-level Markdown title.")), "Add one H1 that names the project."),
  check("overview", "Documentation", "Project overview", readme((text) => test(/^#{2,4}\s+(overview|about|introduction|what is\b).*$/im.test(text) || /^#\s+.+\n\s*[^#<!\n][^\n]{29,}/m.test(text), "Overview heading or opening summary found.", "No overview heading or opening summary detected.")), "Explain what the project does and who it helps."),
  check("install", "Documentation", "Installation or quick start", section(/^#{2,4}\s+(installation|install|getting started|quick ?start)\b/im, "Setup section found."), "Document prerequisites and a verified install command."),
  check("usage", "Documentation", "Usage example", section(/^#{2,4}\s+(usage|examples?|api examples?)\b/im, "Usage or examples section found."), "Show a runnable example and expected output."),
  check("license", "Documentation", "License file", has(licenseFile), "Choose an appropriate license and add the full text."),
  check("changelog", "Documentation", "Changelog", has(/^(?:docs\/)?(?:change[-_ ]?log|history)(?:\.[^/]+)?$/i), "Record release changes and migrations in CHANGELOG.md."),
  check("architecture", "Documentation", "Architecture guide", section(/^#{2,4}\s+(architecture|how it works|system design)\b/im, "Architecture heading found."), "Explain the major components and how data moves."),
  check("readme-license", "Documentation", "License explained in README", section(/^#{2,4}\s+licen[cs]e\b/im, "License section found."), "Link the README to the repository license."),
  check("relative-links", "Documentation", "README relative links", readme((text, s, path) => {
    const targets = markdownLinks(text).map((link) => resolveLink(path, link.target)).filter((target) => target !== null);
    const broken = [...new Set(targets.filter((target) => target && !s.inventory.some((file) => file === target || file.startsWith(`${target}/`))))];
    if (targets.includes("")) return result("fail", "A link escapes the repository root or has invalid encoding.");
    if (!s.complete) return unknown("A complete file inventory is needed to verify relative link targets.");
    return test(!broken.length, `${targets.length} relative link target(s) resolved.`, `Missing paths: ${broken.slice(0, 8).join(", ")}`);
  }), "Fix broken or incorrectly cased relative README links."),
  check("contributing", "Community", "Contributor guide", has(/^(?:\.github\/|docs\/)?contributing(?:\.[^/]+)?$/i), "Document local setup and contribution expectations."),
  check("conduct", "Community", "Code of conduct", has(/^(?:\.github\/|docs\/)?code[-_ ]of[-_ ]conduct(?:\.[^/]+)?$/i), "Publish a code of conduct with a private reporting path."),
  check("support", "Community", "Support routing", has(/^(?:\.github\/|docs\/)?support(?:\.[^/]+)?$/i), "Route questions, bugs, and security issues to the appropriate channels."),
  check("maintainers", "Community", "Ownership file", has(/^(?:\.github\/|docs\/)?codeowners$/i), "Add a CODEOWNERS file using maintainers who have write access."),
  check("bug-template", "Community", "Bug report template", has(/^\.github\/ISSUE_TEMPLATE\/[^/]*(bug|defect)[^/]*\.(md|ya?ml)$/i), "Capture reproduction steps, environment, and expected behavior."),
  check("feature-template", "Community", "Feature request template", has(/^\.github\/ISSUE_TEMPLATE\/[^/]*(feature|enhancement)[^/]*\.(md|ya?ml)$/i), "Ask for the problem, proposed outcome, and alternatives."),
  check("pr-template", "Community", "Pull request template", has(/^(?:(?:\.github|docs)\/)?pull_request_template\.md$|^\.github\/pull_request_template\/[^/]+\.md$/i), "Ask contributors to link issues and record validation."),
  check("security-policy", "Security", "Vulnerability disclosure policy", has(/^(?:\.github\/|docs\/)?security(?:\.[^/]+)?$/i), "Describe private vulnerability reporting and supported versions."),
  check("dependency-updates", "Security", "Dependency update configuration", has(/^\.github\/dependabot\.ya?ml$|^(?:\.github\/)?(?:renovate\.json5?|\.renovaterc(?:\.json5?)?)$/i), "Configure Dependabot or Renovate for applicable ecosystems."),
  check("env-example", "Security", "Environment example", (s) => {
    const available = has(/^(?:\.env\.(?:example|sample|template)|env\.example)$/i)(s);
    const mentions = /\b(?:environment variables?|dotenv|\.env)\b|\.env\b/i.test(s.contents.get(readmePath(s.inventory)) ?? "");
    return available.status === "fail" && !mentions ? unknown("No environment example found. Applicability needs configuration evidence.") : available;
  }, "Provide a redacted .env.example when the project needs environment variables."),
  check("workflow-permissions", "Security", "Explicit workflow token permissions", noWorkflowViolations((text) => !/^permissions\s*:/m.test(text) || /^\s*permissions:\s*write-all\b/m.test(text), "Explicit top-level permissions found and no write-all detected.", "Review token scope in"), "Declare minimal GitHub token permissions at workflow and job level."),
  check("pinned-actions", "Security", "External actions pinned to a SHA", noWorkflowViolations((text) => [...text.matchAll(/^\s*(?:-\s*)?uses:\s*["']?([^\s"'#]+)/gm)].some(([, ref]) => !/^(?:\.\/|docker:)/.test(ref) && !/@[a-f\d]{40}$/i.test(ref)), "External GitHub action references use full commit SHAs.", "Unpinned action reference in"), "Review each external action and pin its full commit SHA."),
  check("checkout-credentials", "Security", "Checkout credential persistence", noWorkflowViolations(hasPersistentCheckoutCredentials, "No checkout step with default credential persistence was found.", "Check checkout credential persistence in"), "Disable persisted checkout credentials for read-only jobs."),
  check("ci", "Delivery", "Continuous integration workflow", has(workflowPath), "Add a workflow for repeatable quality checks."),
  check("pr-trigger", "Delivery", "Pull requests trigger validation", workflow((files) => {
    const paths = files.filter(([, text]) => /^(?: {2,}pull_request\s*:|on:\s*(?:pull_request\s*$|\[.*\bpull_request\b.*\]))/m.test(text)).map(([path]) => path);
    return test(paths.length > 0, paths.join(", "), "No pull_request trigger detected.");
  }), "Run validation on pull_request with read-only permissions."),
  check("tests", "Delivery", "Test files", has(/(?:^|\/)(?:tests?|__tests__|spec|e2e)\/[^/]+|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)test_\w+\.py$|_test\.go$/i), "Add executable tests that cover the critical path."),
  check("lockfile", "Delivery", "Dependency lockfile", (s) => {
    const file = has(/^(?:bun\.lockb?|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json|uv\.lock|poetry\.lock|Pipfile\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|composer\.lock)$/i)(s);
    return file.status === "fail" && !s.inventory.some((path) => /^(package\.json|pyproject\.toml|Cargo\.toml|Gemfile|composer\.json)$/i.test(path))
      ? unknown("No supported package manifest or lockfile found.") : file;
  }, "Commit the lockfile for the package manager used by the project."),
  check("editorconfig", "Delivery", "Editor defaults", has(/^\.editorconfig$/), "Define shared indentation and newline defaults."),
  check("release", "Delivery", "Published GitHub release", metadata("releaseCount", (count) => test(Number.isInteger(count) && count > 0, `${count} release(s) reported.`, "No published release reported.")), "Publish versioned release notes after validation."),
  check("branch-protection", "Delivery", "Default branch protection", metadata("protectedBranch", (value) => test(value === true, "Default branch protection reported.", "Default branch protection is disabled.")), "Protect the default branch with review and required status checks."),
  check("description", "Discovery", "Repository description", metadata("description", (value) => test(typeof value === "string" && value.trim().length >= 20 && value.length <= 350, "Description fits the rubric.", "Add a concrete project description of 20–350 characters.")), "Set a descriptive summary in GitHub About."),
  check("topics", "Discovery", "Searchable repository topics", metadata("topics", (value) => test(Array.isArray(value) && new Set(value.filter((topic) => typeof topic === "string" && /^[a-z0-9][a-z0-9-]{0,49}$/.test(topic))).size >= 3, "At least three distinct GitHub-shaped topics.", "Fewer than three distinct GitHub-shaped topics.")), "Set three or more relevant topics in GitHub About."),
  check("homepage", "Discovery", "HTTPS homepage", metadata("homepage", (value) => {
    try {
      const url = new URL(value);
      return test(url.protocol === "https:" && !url.username && !url.password, "HTTPS URL reported.", "Use an HTTPS homepage URL without credentials.");
    } catch {
      return result("fail", "No valid homepage URL reported.");
    }
  }), "Link to the project docs or hosted demo in GitHub About."),
  check("profile", "Discovery", "GitHub profile README", metadata("profileReadme", (value) => test(value === true, "Owner reports a public same-name repository with a root README.", "Profile README reported absent.")), "For a personal account, publish a profile README in the public username/username repository."),
  check("social-preview", "Discovery", "GitHub social preview", metadata("socialPreview", (value) => test(value === true, "Owner reports a configured social preview.", "Social preview reported absent.")), "Upload a 1280 × 640 PNG under 1 MB in GitHub repository settings."),
  check("banner", "Media", "README banner", has(/(?:^|\/)(?:[^/]*[-_])?(?:banner|hero|social-preview)(?:[-_][^/]*)?\.(?:svg|png|jpe?g|webp)$/i), "Commit an accessible README banner and reference it from the README."),
  check("image-alt", "Media", "Markdown image alt text", readme((text) => {
    const images = markdownLinks(text).filter((link) => link.image);
    if (!images.length) return unknown("No inline Markdown images found. HTML and reference images need manual review.");
    return test(images.every((image) => image.label.trim()), `${images.length} inline Markdown image(s) have alt text.`, "At least one inline Markdown image has empty alt text.");
  }), "Write descriptive alt text for meaningful screenshots and banners."),
  check("demo-gif", "Media", "Animated preview file", has(/\.gif$/i), "Commit a compact GIF preview and provide a static fallback."),
  check("demo-video", "Media", "Demo video file", has(/\.(mp4|webm)$/i), "Publish a short MP4 or WebM demo."),
  check("captions", "Media", "Video captions", (s) => {
    const video = has(/\.(mp4|webm)$/i)(s);
    return video.status === "fail" ? na("No video file is present.") : video.status === "unknown" ? unknown("Provide a video and caption inventory.") : has(/\.(vtt|srt)$/i)(s);
  }, "Ship a VTT or SRT caption track and review synchronization."),
];

export function auditWorkbench(snapshot) {
  const findings = CHECKS.map(({ id, group, title, run, fix }) => ({ id, group, title, fix, ...run(snapshot) }));
  const count = (status) => findings.filter((finding) => finding.status === status).length;
  const passed = count("pass");
  const failed = count("fail");
  const unverified = count("unknown");
  const excluded = count("n/a");
  const applicable = findings.length - excluded;
  return {
    score: applicable ? Math.round(passed * 100 / applicable) : null,
    coverage: applicable ? Math.round((passed + failed) * 100 / applicable) : null,
    passed, failed, unverified, excluded, findings,
  };
}

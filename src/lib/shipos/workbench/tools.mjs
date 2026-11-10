import { markdownLinks, normalizePath, parseIdentity, resolveLink } from "./evidence.mjs";

const tool = (id, group, title, example, run) => ({ id, group, title, example, run });
const lines = (text) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const tokens = (text) => text.split(/[\s,]+/).filter(Boolean);
const unique = (values) => [...new Set(values)];
const pretty = (value) => JSON.stringify(value, null, 2);
const readJson = (text) => JSON.parse(text);
const plain = (text) => text.trim().replace(/\s+/g, " ");
const markdownCell = (text) => text.replace(/\|/g, "\\|");
const parseVersion = (value) => {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) throw new Error("Use a stable semantic version such as 1.4.2.");
  const version = match.slice(1).map(Number);
  if (!version.every(Number.isSafeInteger)) throw new Error("Version components are too large.");
  return version;
};
const dotenvKeys = (text) => unique(lines(text).flatMap((line) => {
  const match = /^(?:export\s+)?([A-Za-z_][A-Za-z\d_]*)\s*=/.exec(line);
  return match ? [match[1]] : [];
}));
const gitRef = (value) => {
  if (!/^[A-Za-z0-9_][A-Za-z0-9._/-]*$/.test(value) || /\.\.|\/\//.test(value) || /[/.]$/.test(value)) {
    throw new Error("Enter a simple tag, branch name, or commit.");
  }
  return value;
};

export const TOOLS = [
  tool("normalize-repo", "GitHub", "Normalize a GitHub repository URL", "https://github.com/octocat/Hello-World.git", (text) => parseIdentity(text).url),
  tool("compare-url", "GitHub", "Build a GitHub compare URL", "octocat/Hello-World v1.0.0 v1.1.0", (text) => {
    const [slug, base, head] = tokens(text);
    return `${parseIdentity(slug ?? "").url}/compare/${encodeURIComponent(gitRef(base ?? ""))}...${encodeURIComponent(gitRef(head ?? ""))}`;
  }),
  tool("issue-url", "GitHub", "Create a prefilled issue URL", "octocat/Hello-World\nDocument setup\nThe setup command needs an example.", (text) => {
    const [slug = "", title = "", ...body] = text.split(/\r?\n/);
    return `${parseIdentity(slug).url}/issues/new?${new URLSearchParams({ title, body: body.join("\n") })}`;
  }),
  tool("profile-target", "GitHub", "Find the profile README repository", "octocat", (text) => {
    const name = text.trim().replace(/^@/, "");
    return `${parseIdentity(`${name}/${name}`).url}\nPublish README.md at the root of this public personal repository.`;
  }),
  tool("clone-commands", "GitHub", "Create HTTPS and SSH clone commands", "octocat/Hello-World", (text) => {
    const { url, slug } = parseIdentity(text);
    return `git clone ${url}.git\ngit clone git@github.com:${slug}.git`;
  }),
  tool("topic-normalize", "GitHub", "Clean and deduplicate GitHub topics", "Next.js, Repo Audit, CI/CD, Next JS", (text) => unique(text.split(/[,\n]+/).map((topic) => topic.toLowerCase().trim().replace(/[^a-z\d]+/g, "-").replace(/^-|-$/g, "").slice(0, 50).replace(/-$/, "")).filter(Boolean)).slice(0, 20).join(", ")),
  tool("description-check", "GitHub", "Validate a repository description", "Offline release tooling for maintainers", (text) => {
    const description = plain(text);
    const length = [...description].length;
    return pretty({ description, length, remaining: 350 - length, rubric: length >= 20 && length <= 350 ? "pass" : "revise" });
  }),
  tool("issue-references", "GitHub", "Extract issue references", "Fixes #18, relates to team/repo#24 and #18", (text) => unique([...text.matchAll(/(?:[\w.-]+\/[\w.-]+)?#\d+\b/g)].map(([value]) => value)).join("\n")),
  tool("headings", "Markdown", "Extract Markdown headings", "# ShipOS\n## Install\n## Run", (text) => [...text.matchAll(/^(#{1,6})\s+(.+?)\s*#*$/gm)].map(([, marks, title]) => `${"  ".repeat(marks.length - 1)}- ${title}`).join("\n")),
  tool("links", "Markdown", "Inventory inline Markdown links", "[Guide](docs/guide.md) and ![Preview](media/banner.png)", (text) => pretty(markdownLinks(text))),
  tool("alt-text", "Markdown", "Find images with missing alt text", "![](media/preview.gif)", (text) => markdownLinks(text).filter(({ image, label }) => image && !label.trim()).map(({ target }) => target).join("\n") || "No empty alt text found in inline Markdown images."),
  tool("relative-link", "Markdown", "Resolve a relative Markdown link", "docs/setup.md\n../media/banner.png", (text) => {
    const [source = "", link = ""] = lines(text);
    if (!normalizePath(source) || !link) throw new Error("Enter a source file and a link on separate lines.");
    const target = resolveLink(source, link);
    return target === null ? "External URL or same-page anchor." : target || "Invalid or outside the repository root.";
  }),
  tool("code-languages", "Markdown", "List fenced code language tags", "```bash\nbun install\n```\n\n```\nplain\n```", (text) => {
    const tags = [];
    let open = "";
    for (const line of text.split(/\r?\n/)) {
      const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (!match) continue;
      const [, fence, info] = match;
      if (!open) { open = fence; tags.push(info.trim().split(/\s+/)[0] || "(unspecified)"); }
      else if (fence[0] === open[0] && fence.length >= open.length && !info.trim()) open = "";
    }
    return unique(tags).join("\n");
  }),
  tool("task-progress", "Markdown", "Count completed checklist items", "- [x] Test\n- [ ] Publish", (text) => {
    const tasks = [...text.matchAll(/^\s*(?:[-*+]|\d+\.)\s+\[([ xX])\]\s+/gm)];
    const done = tasks.filter(([, status]) => status !== " ").length;
    return pretty({ done, total: tasks.length, percent: tasks.length ? Math.round(done * 100 / tasks.length) : null });
  }),
  tool("markdown-table", "Markdown", "Convert TSV to a Markdown table", "Name\tStatus\nCI\tReady\nDocs\tReview", (text) => {
    const rows = text.trimEnd().split(/\r?\n/).filter(Boolean).map((row) => row.split("\t").map(markdownCell));
    if (!rows.length || rows.some((row) => row.length !== rows[0].length)) throw new Error("Provide TSV rows with a consistent number of columns.");
    rows.splice(1, 0, rows[0].map(() => "---"));
    return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  }),
  tool("slug", "Markdown", "Create a heading anchor candidate", "Release notes / v2.0", (text) => `#${plain(text).toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "").replace(/\s/g, "-")}`),
  tool("json-format", "Data", "Validate and format JSON", '{"ready":true,"checks":[1,2]}', (text) => pretty(readJson(text))),
  tool("json-compact", "Data", "Minify JSON", '{"ready": true, "checks": [1, 2]}', (text) => JSON.stringify(readJson(text))),
  tool("package-scripts", "Data", "Extract scripts from package.json", '{"name":"app","scripts":{"test":"node --test","build":"next build"}}', (text) => {
    const value = readJson(text);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("Provide a package.json object.");
    return pretty(value.scripts ?? {});
  }),
  tool("dotenv-example", "Data", "Redact dotenv values", "API_URL=https://example.test\nexport TOKEN=do-not-share", (text) => dotenvKeys(text).map((key) => `${key}=`).join("\n")),
  tool("dotenv-diff", "Data", "Compare dotenv key sets", "API_URL=\nTOKEN=\n---\nAPI_URL=\nPORT=", (text) => {
    const sections = text.split(/^---\s*$/m);
    if (sections.length !== 2) throw new Error("Separate the two dotenv files with a line containing ---.");
    const [expected, actual] = sections.map(dotenvKeys);
    return pretty({ missing: expected.filter((key) => !actual.includes(key)), extra: actual.filter((key) => !expected.includes(key)) });
  }),
  tool("paths", "Data", "Normalize repository paths", "./src/app.ts\nREADME.md\nsrc\\app.ts\n../outside", (text) => unique(lines(text).map(normalizePath).filter(Boolean)).sort().join("\n")),
  tool("extensions", "Data", "Count files by extension", "README.md\nsrc/app.ts\nsrc/types.ts\nLICENSE", (text) => {
    const counts = new Map();
    for (const path of unique(lines(text).map(normalizePath).filter(Boolean))) {
      const extension = /[^/.]+\.([^/.]+)$/.exec(path)?.[1]?.toLowerCase() ?? "(none)";
      counts.set(extension, (counts.get(extension) ?? 0) + 1);
    }
    return pretty(Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))));
  }),
  tool("line-diff", "Data", "Compare inventories", "README.md\nold.txt\n---\nREADME.md\nnew.txt", (text) => {
    const sections = text.split(/^---\s*$/m);
    if (sections.length !== 2) throw new Error("Separate the two inventories with a line containing ---.");
    const [before, after] = sections.map((part) => new Set(lines(part)));
    return pretty({ removed: [...before].filter((line) => !after.has(line)), added: [...after].filter((line) => !before.has(line)) });
  }),
  tool("semver-bump", "Release", "Calculate the next semantic version", "v1.4.2 minor", (text) => {
    const [version = "", bump] = tokens(text);
    const parts = parseVersion(version);
    const index = ["major", "minor", "patch"].indexOf(bump);
    if (index < 0) throw new Error("Choose major, minor, or patch.");
    parts[index]++;
    if (!Number.isSafeInteger(parts[index])) throw new Error("The next version component is too large.");
    return parts.map((part, position) => position > index ? 0 : part).join(".");
  }),
  tool("release-tag", "Release", "Create a local annotated tag command", "1.4.2", (text) => {
    const version = parseVersion(text.trim()).join(".");
    return `git tag -a v${version} -m "Release v${version}"`;
  }),
  tool("conventional-commit", "Release", "Parse a Conventional Commit header", "fix(ci)!: update runner requirements", (text) => {
    const match = /^([a-z][a-z\d-]*)(?:\(([^)\n]+)\))?(!)?: ([^\n]+)$/.exec(text.trim());
    if (!match) throw new Error("Use type(scope): description, optionally with ! before the colon.");
    return pretty({ type: match[1], scope: match[2] ?? null, breaking: Boolean(match[3]), description: match[4] });
  }),
  tool("release-notes", "Release", "Group Conventional Commits into release notes", "feat(ui): add shortcuts\nfix: prevent duplicate exports", (text) => {
    const groups = new Map();
    for (const line of lines(text)) {
      const match = /^(feat|fix|perf|docs|refactor|test|ci|build|chore)(?:\([^)]+\))?(!)?:\s+(.+)$/.exec(line);
      const group = match?.[2] ? "Breaking changes" : ({ feat: "Features", fix: "Fixes", perf: "Performance", docs: "Documentation" }[match?.[1]] ?? "Other changes");
      groups.set(group, [...(groups.get(group) ?? []), match?.[3] ?? line]);
    }
    return [...groups].map(([group, changes]) => `## ${group}\n\n${changes.map((change) => `- ${change}`).join("\n")}`).join("\n\n");
  }),
  tool("vtt", "Media", "Create timed WebVTT captions", "4\nOpen the project.\nRun the example.", (text) => {
    const [duration = "", ...captions] = lines(text);
    const seconds = Number(duration);
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 60 || !captions.length) throw new Error("Enter 1–60 seconds per cue on the first line, then one caption per line.");
    const time = (value) => [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60].map((part) => String(part).padStart(2, "0")).join(":") + ".000";
    return `WEBVTT\n\n${captions.map((caption, index) => `${time(index * seconds)} --> ${time((index + 1) * seconds)}\n${caption.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}`).join("\n\n")}\n`;
  }),
  tool("media-budget", "Media", "Estimate a video bitrate budget", "8 30", (text) => {
    const [megabytes, seconds] = tokens(text).map(Number);
    if (!(megabytes > 0 && seconds > 0 && Number.isFinite(megabytes) && Number.isFinite(seconds))) throw new Error("Enter a positive file size in MB and duration in seconds.");
    const bitrate = megabytes * 8000 / seconds;
    if (!Number.isFinite(bitrate)) throw new Error("The bitrate is outside the supported range.");
    return pretty({ totalKbps: Math.floor(bitrate), targetVideoKbpsWith128KbpsAudioAnd5PercentOverhead: Math.max(0, Math.floor(bitrate * 0.95 - 128)) });
  }),
];

export function runTool(id, input) {
  if (typeof input !== "string" || input.length > 150_000) throw new Error("Input must be text under 150,001 characters.");
  const selected = TOOLS.find((entry) => entry.id === id);
  if (!selected) throw new Error(`Unknown tool: ${id}`);
  return selected.run(input);
}

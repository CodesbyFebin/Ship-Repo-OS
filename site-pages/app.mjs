import JSZip from "jszip";
import { auditWorkbench } from "../src/lib/shipos/workbench/checks.mjs";
import { makeSnapshot, parseIdentity, readmePath } from "../src/lib/shipos/workbench/evidence.mjs";
import { buildPack } from "../src/lib/shipos/workbench/pack.mjs";
import { runTool, TOOLS } from "../src/lib/shipos/workbench/tools.mjs";

const el = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll('[role="tab"]')];
let audit;
let pack = [];

function message(text = "", error = false) {
  const box = el("message");
  box.hidden = !text;
  box.textContent = text;
  box.classList.toggle("error", error);
}

function activate(tab, focus = false) {
  for (const button of tabs) {
    const active = button === tab;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    el(button.getAttribute("aria-controls")).hidden = !active;
  }
  message();
  if (focus) tab.focus();
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activate(tab));
  tab.addEventListener("keydown", (event) => {
    const next = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    activate(tabs[next], true);
  });
});

function bind(id, eventName, action) {
  const control = el(id);
  control.addEventListener(eventName, async (event) => {
    if (eventName === "submit") event.preventDefault();
    const button = eventName === "submit" ? event.submitter : control;
    if (button?.tagName === "BUTTON") button.disabled = true;
    message();
    try {
      await action();
    } catch (error) {
      message(error instanceof Error ? error.message : "Something went wrong.", true);
    } finally {
      if (button?.tagName === "BUTTON") button.disabled = false;
    }
  });
}

function objectInput(id) {
  const value = el(id).value.trim();
  if (!value) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Evidence inputs must be JSON objects.");
  return parsed;
}

function download(name, data, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showFindings() {
  const filter = el("audit-filter").value;
  const list = el("findings");
  list.replaceChildren();
  for (const item of audit.findings.filter((item) => filter === "all" || item.status === filter)) {
    const row = document.createElement("li");
    const status = document.createElement("span");
    status.className = item.status;
    status.textContent = item.status;
    const title = document.createElement("strong");
    title.textContent = item.title;
    const detail = document.createElement("p");
    detail.textContent = item.detail;
    row.append(status, title, detail);
    if (item.status === "fail" || item.status === "unknown") {
      const next = document.createElement("p");
      next.textContent = item.fix;
      row.append(next);
    }
    list.append(row);
  }
  if (!list.children.length) {
    const empty = document.createElement("li");
    empty.textContent = "No findings match this filter.";
    list.append(empty);
  }
}

function runAudit() {
  const paths = el("inventory").value.split(/\r?\n/);
  const files = objectInput("files-json");
  if (Object.values(files).some((value) => typeof value !== "string")) throw new Error("Every file content value must be a string.");
  const readme = el("readme").value;
  if (readme.trim()) files[readmePath([...paths, ...Object.keys(files)]) || "README.md"] = readme;
  const snapshot = makeSnapshot({ paths, files, metadata: objectInput("metadata-json"), complete: el("complete").checked });
  audit = auditWorkbench(snapshot);
  el("audit-score").textContent = `${audit.score ?? "—"}/100 readiness · ${audit.coverage ?? "—"}% evidence coverage`;
  el("audit-counts").textContent = `${audit.passed} passed · ${audit.failed} failed · ${audit.unverified} unknown · ${audit.excluded} not applicable`;
  el("audit-filter").value = "all";
  el("audit-results").hidden = false;
  showFindings();
}

bind("audit-form", "submit", runAudit);
el("audit-filter").addEventListener("change", showFindings);
bind("save-audit", "click", () => download("shipos-audit.json", JSON.stringify(audit, null, 2), "application/json"));
bind("audit-example", "click", () => {
  el("inventory").value = "README.md\nLICENSE\nCONTRIBUTING.md\npackage.json\nbun.lock\ntests/example.test.js";
  el("readme").value = "# Example project\n\n## Overview\n\nA small sample for the ShipOS audit.\n\n## Quick start\n\nRun the project from a checkout.\n\n## Usage\n\nSee the example test.\n\n## License\n\nSee [LICENSE](LICENSE).";
  el("files-json").value = "";
  el("metadata-json").value = "";
  el("complete").checked = true;
  runAudit();
});

async function request(url, text = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: text ? {} : { Accept: "application/vnd.github+json" } });
  if (response.status === 403 || response.status === 429) throw new Error("GitHub limited the public request. Try again later or paste evidence.");
  if (response.status === 404) throw new Error("GitHub could not find this public repository or its files.");
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
  return text ? response.text() : response.json();
}

bind("import-form", "submit", async () => {
  const identity = parseIdentity(el("import-slug").value);
  message(`Importing ${identity.slug} from GitHub…`);
  const base = `https://api.github.com/repos/${identity.slug}`;
  const meta = await request(base);
  const branch = await request(`${base}/branches/${encodeURIComponent(meta.default_branch)}`);
  const data = await request(`${base}/git/trees/${branch.commit.commit.tree.sha}?recursive=1`);
  const all = data.tree.filter(({ type }) => type !== "tree").map(({ path }) => path);
  const paths = all.slice(0, 12000);
  const readme = readmePath(paths);
  const workflows = paths.filter((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path)).slice(0, 8);
  const names = [...new Set([readme, ...workflows].filter(Boolean))];
  const raw = `https://raw.githubusercontent.com/${identity.slug}/${branch.commit.sha}`;
  const replies = await Promise.allSettled([
    ...names.map((name) => request(`${raw}/${name.split("/").map(encodeURIComponent).join("/")}`, true)),
    request(`${base}/releases?per_page=1`),
  ]);
  const files = Object.fromEntries(names.flatMap((name, index) => {
    const result = replies[index];
    return result.status === "fulfilled" && result.value.length <= 150000 ? [[name, result.value]] : [];
  }));
  const metadata = { description: meta.description ?? "", topics: meta.topics ?? [], homepage: meta.homepage ?? "" };
  if (typeof branch.protected === "boolean") metadata.protectedBranch = branch.protected;
  const releases = replies.at(-1);
  if (releases.status === "fulfilled" && Array.isArray(releases.value)) metadata.releaseCount = releases.value.length;
  el("inventory").value = paths.join("\n");
  el("readme").value = files[readme] ?? "";
  delete files[readme];
  el("files-json").value = JSON.stringify(files, null, 2);
  el("metadata-json").value = JSON.stringify(metadata, null, 2);
  el("complete").checked = !data.truncated && paths.length === all.length;
  el("kit-slug").value = identity.slug;
  el("kit-description").value = (meta.description ?? "").slice(0, 300);
  runAudit();
  message(`Imported ${paths.length} paths from ${identity.slug}. Missing evidence stays unverified.`);
});

function selectOption(select, value, label) {
  select.add(new Option(label, value));
}

function activeAsset() {
  return pack.find((file) => file.id === el("asset-select").value);
}

function previewAsset() {
  const file = activeAsset();
  el("asset-info").textContent = [file.path, file.conflict ? "Existing path" : "", file.setup].filter(Boolean).join(" · ");
  el("asset-content").textContent = file.content;
}

bind("kit-form", "submit", () => {
  const identity = parseIdentity(el("kit-slug").value);
  const { inventory } = makeSnapshot({ paths: el("inventory").value.split(/\r?\n/) });
  pack = buildPack(identity, el("kit-description").value, inventory);
  const select = el("asset-select");
  select.replaceChildren();
  for (const file of pack) selectOption(select, file.id, `${file.title}${file.conflict ? " (existing path)" : ""}`);
  el("kit-results").hidden = false;
  previewAsset();
  const banner = pack.find((file) => file.id === "banner");
  el("banner-preview").src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(banner.content)}`;
  el("custom-banner").hidden = false;
});
el("asset-select").addEventListener("change", previewAsset);
bind("save-asset", "click", () => {
  const file = activeAsset();
  download(file.path.split("/").at(-1), file.content, file.id === "banner" ? "image/svg+xml" : "text/plain");
});
bind("save-kit", "click", async () => {
  const zip = new JSZip();
  for (const file of pack) zip.file(file.path, file.content);
  zip.file("SHIPOS-MANIFEST.json", JSON.stringify(pack.map(({ content, ...file }) => file), null, 2));
  download("shipos-launch-kit.zip", await zip.generateAsync({ type: "blob", compression: "DEFLATE" }));
});
bind("save-png", "click", async () => {
  const img = el("banner-preview");
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 640;
  canvas.getContext("2d").drawImage(img, 0, 0);
  const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png || png.size >= 1000000) throw new Error("The generated PNG exceeds the 1 MB preview budget.");
  download("social-preview.png", png);
});

const toolSelect = el("tool-select");
for (const group of new Set(TOOLS.map((tool) => tool.group))) {
  const options = document.createElement("optgroup");
  options.label = group;
  for (const tool of TOOLS.filter((tool) => tool.group === group)) options.append(new Option(tool.title, tool.id));
  toolSelect.append(options);
}
const selectedTool = () => TOOLS.find((tool) => tool.id === toolSelect.value);
function resetTool() {
  el("tool-input").value = "";
  el("tool-input").placeholder = selectedTool().example;
  el("tool-results").hidden = true;
}
toolSelect.addEventListener("change", resetTool);
resetTool();
bind("tool-example", "click", () => { el("tool-input").value = selectedTool().example; });
bind("tool-form", "submit", () => {
  el("tool-output").value = runTool(selectedTool().id, el("tool-input").value);
  el("tool-results").hidden = false;
});
bind("save-tool", "click", () => download(`shipos-${selectedTool().id}.txt`, el("tool-output").value, "text/plain"));

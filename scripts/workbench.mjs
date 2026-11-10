#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { auditWorkbench } from "../src/lib/shipos/workbench/checks.mjs";
import { makeSnapshot, normalizePath, parseIdentity, readmePath } from "../src/lib/shipos/workbench/evidence.mjs";
import { bannerSvg, buildPack } from "../src/lib/shipos/workbench/pack.mjs";
import { runTool, TOOLS } from "../src/lib/shipos/workbench/tools.mjs";

const help = `ShipOS Workbench

  node scripts/workbench.mjs audit [directory] [--metadata metadata.json] [--minimum 70]
  node scripts/workbench.mjs pack --repo owner/repo --out new-directory [--description "text"] [--against git-directory]
  node scripts/workbench.mjs media (--repo owner/repo | --brand "Project title") --out new-directory [--description "text"]
  node scripts/workbench.mjs tools
  node scripts/workbench.mjs tool <tool-id> [--input "text" | --file path]

Audit reads a Git working tree and writes JSON to stdout. Media requires FFmpeg with librsvg and libx264.
Pack and media require a new output directory. Input to tool defaults to stdin.`;

const arg = { type: "string" };
const commands = {
  audit: { metadata: arg, minimum: arg },
  pack: { repo: arg, out: arg, description: arg, against: arg },
  media: { repo: arg, brand: arg, out: arg, description: arg },
  tools: {},
  tool: { input: arg, file: arg },
};

function repoInventory(directory) {
  const root = realpathSync(execFileSync("git", ["-C", directory, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  const raw = execFileSync("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const present = raw.split("\0").filter((path) => {
    if (!path || normalizePath(path) !== path) return false;
    try {
      lstatSync(join(root, path));
      return true;
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
      throw error;
    }
  });
  return { root, paths: [...new Set(present)] };
}

function loadEvidence(root, paths) {
  const files = Object.create(null);
  const wanted = [readmePath(paths), ...paths.filter((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path))];
  for (const path of wanted.filter(Boolean)) {
    const filename = join(root, path);
    const stat = lstatSync(filename);
    if (!stat.isFile() || stat.size > 512 * 1024) continue;
    const inside = relative(root, realpathSync(filename));
    if (isAbsolute(inside) || inside === ".." || inside.startsWith("../") || inside.startsWith("..\\")) continue;
    files[path] = readFileSync(filename, "utf8");
  }
  return files;
}

function writeNewDirectory(destination, fill) {
  if (!destination) throw new Error("--out must name a new directory.");
  const out = resolve(destination);
  // Create the final directory exclusively after preparing every file.
  const staging = mkdtempSync(join(dirname(out), ".shipos-"));
  try {
    const files = fill(staging);
    mkdirSync(out);
    try {
      for (const [path, content] of files) {
        const target = join(out, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content, { flag: "wx" });
      }
    } catch (error) {
      rmSync(out, { recursive: true, force: true });
      throw error;
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  console.log(out);
}

function mediaFiles(work, identity, description) {
  const ffmpeg = (...args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-filter_threads", "1", "-filter_complex_threads", "1", ...args], { cwd: work, stdio: ["ignore", "ignore", "pipe"] });
  const summary = description.trim().replace(/\s+/g, " ").slice(0, 300);
  const cards = [
    { title: identity.repo, summary },
    { title: "Explore the code", summary: "Open the README for setup and usage." },
    { title: identity.slug ? "Visit on GitHub" : "Get started", summary: identity.slug || "Open the project guide to get started." },
  ];
  for (const [index, card] of cards.entries()) {
    const input = `card-${index}.svg`;
    writeFileSync(join(work, input), bannerSvg({ ...identity, repo: card.title, rawSummary: card.summary, eyebrow: identity.slug ? undefined : "REPOSITORY WORKBENCH", footer: identity.slug ? undefined : "AUDIT  /  BUILD  /  SHIP" }));
    ffmpeg("-i", input, "-frames:v", "1", `card-${index}.png`);
  }
  writeFileSync(join(work, "sequence.txt"), cards.map((_, index) => `file 'card-${index}.png'\nduration 3`).join("\n") + "\nfile 'card-2.png'\n");
  const sequence = ["-f", "concat", "-safe", "1", "-i", "sequence.txt", "-t", "9"];
  ffmpeg(...sequence, "-vf", "fps=24,format=yuv420p", "-c:v", "libx264", "-threads", "2", "-movflags", "+faststart", "repo-teaser.mp4");
  ffmpeg(...sequence, "-filter_complex", "fps=6,scale=640:-1:flags=lanczos,split[frames][palette_input];[palette_input]palettegen=max_colors=96[palette];[frames][palette]paletteuse=dither=none", "-loop", "0", "repo-preview.gif");
  const png = readFileSync(join(work, "card-0.png"));
  if (png.length >= 1_000_000) throw new Error("The rendered social preview exceeds the 1 MB size budget.");
  return [
    ["banner.svg", readFileSync(join(work, "card-0.svg"))],
    ["social-preview.png", png],
    ["repo-preview.gif", readFileSync(join(work, "repo-preview.gif"))],
    ["repo-teaser.mp4", readFileSync(join(work, "repo-teaser.mp4"))],
    ["repo-teaser.vtt", runTool("vtt", `3\n${cards.map((card) => [card.title, card.summary].filter(Boolean).join(". ")).join("\n")}`)],
  ];
}

function main([command, ...args]) {
  if (!command || ["help", "--help", "-h"].includes(command)) { console.log(help); return; }
  if (!Object.hasOwn(commands, command)) throw new Error(`Unknown command: ${command}`);
  const { values, positionals } = parseArgs({ args, options: commands[command], allowPositionals: true });
  const [target] = positionals;
  const maxPositionals = ["audit", "tool"].includes(command) ? 1 : 0;
  if (positionals.length > maxPositionals) throw new Error("Unexpected positional argument.");
  switch (command) {
    case "audit": {
      const { root, paths } = repoInventory(target ?? ".");
      const metadata = values.metadata ? JSON.parse(readFileSync(values.metadata, "utf8")) : {};
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Metadata must be a JSON object.");
      const minimum = values.minimum === undefined ? 0 : Number(values.minimum);
      if (!Number.isInteger(minimum) || minimum < 0 || minimum > 100) throw new Error("--minimum must be an integer between 0 and 100.");
      const audit = auditWorkbench(makeSnapshot({ paths, files: loadEvidence(root, paths), complete: true, metadata }));
      console.log(JSON.stringify(audit, null, 2));
      if ((audit.score ?? 0) < minimum) process.exitCode = 2;
      break;
    }
    case "pack": {
      const identity = parseIdentity(values.repo ?? "");
      const inventory = values.against ? repoInventory(values.against).paths : [];
      const artifacts = buildPack(identity, values.description ?? "", inventory);
      writeNewDirectory(values.out, () => [
        ...artifacts.map(({ path, content }) => [path, content]),
        ["SHIPOS-MANIFEST.json", JSON.stringify({ repository: identity.slug, artifacts: artifacts.map(({ content: _content, ...artifact }) => artifact) }, null, 2) + "\n"],
      ]);
      break;
    }
    case "media": {
      if (Boolean(values.repo) === Boolean(values.brand)) throw new Error("Choose exactly one of --repo or --brand.");
      const title = values.brand?.trim();
      if (values.brand && (!title || title.length > 100 || /[\u0000-\u001f]/.test(title))) throw new Error("Use a project title from 1 to 100 characters.");
      const identity = title ? { repo: title, owner: "", slug: "" } : parseIdentity(values.repo ?? "");
      writeNewDirectory(values.out, (staging) => mediaFiles(staging, identity, values.description ?? ""));
      break;
    }
    case "tools":
      console.log(TOOLS.map(({ id, title }) => `${id}\t${title}`).join("\n"));
      break;
    case "tool":
      if (values.file !== undefined && values.input !== undefined) throw new Error("Choose --input or --file.");
      console.log(runTool(target, values.input ?? readFileSync(values.file ?? 0, "utf8")));
      break;
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`ShipOS: ${error.message}`);
  process.exitCode = 1;
}

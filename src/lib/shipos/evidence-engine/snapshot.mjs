import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP_DIR = new Set([".git", "node_modules", ".next", "dist", "coverage", "prisma/db"]);
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 400;

export function loadSnapshotFromRoot(root, { testReport, workflowReview, performanceEvidence, accessibilityEvidence } = {}) {
  const files = {};
  walk(root, root, files);
  return { files, testReport, workflowReview, performanceEvidence, accessibilityEvidence };
}

function walk(root, current, files) {
  if (Object.keys(files).length >= MAX_FILES) return;
  let entries = [];
  try {
    entries = readdirSync(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (Object.keys(files).length >= MAX_FILES) return;
    if (entry.name === "." || entry.name === "..") continue;
    const full = join(current, entry.name);
    const rel = relative(root, full).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name) || rel === "prisma/db") continue;
      walk(root, full, files);
      continue;
    }
    if (!entry.isFile()) continue;
    let size = 0;
    try { size = statSync(full).size; } catch { continue; }
    if (size > MAX_FILE_BYTES) continue;
    try {
      files[rel] = readFileSync(full, "utf8");
    } catch {
      // Skip unreadable or binary files that throw.
    }
  }
}

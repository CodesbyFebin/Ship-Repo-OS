/** The same evidence format is used in the browser and the local CLI. */
export function normalizePath(value) {
  const path = value.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  if (!path || /^[\w-]+:|^\//.test(path) || /[\u0000-\u001f]/.test(path)) return "";
  const parts = path.split("/");
  return parts.some((part) => !part || part === ".." || part === ".") ? "" : path;
}

export function parseIdentity(value) {
  const slug = value.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\/$/, "").replace(/\.git$/i, "");
  const match = /^([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/([a-z\d_.-]{1,100})$/i.exec(slug);
  if (!match || [".", ".."].includes(match[2])) throw new Error("Enter a GitHub repository as owner/repo.");
  const [, owner, repo] = match;
  return { owner, repo, slug, url: `https://github.com/${slug}` };
}

/** @param {{paths?: string[], files?: object, complete?: boolean, metadata?: object}} [input] */
export function makeSnapshot({ paths = [], files = {}, complete = false, metadata = {} } = {}) {
  const contents = new Map();
  for (const [name, text] of Object.entries(files)) {
    const path = normalizePath(name);
    if (path && typeof text === "string") contents.set(path, text);
  }
  const inventory = [...new Set([...paths.map(normalizePath).filter(Boolean), ...contents.keys()])].sort();
  return { inventory, contents, complete, metadata };
}

export function readmePath(paths) {
  for (const pattern of [/^\.github\/readme(?:\.[^/]+)?$/i, /^readme(?:\.[^/]+)?$/i, /^docs\/readme(?:\.[^/]+)?$/i]) {
    const match = paths.find((path) => pattern.test(path));
    if (match) return match;
  }
  return "";
}

export function markdownLinks(text) {
  const source = text.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, "");
  return [...source.matchAll(/(!?)\[([^\]\n]*)\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/g)]
    .map((match) => ({ image: Boolean(match[1]), label: match[2], target: match[3] ?? match[4] }));
}

export function resolveLink(from, link) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(link)) return null;
  let target;
  try {
    target = decodeURIComponent(link.split(/[?#]/)[0]);
  } catch {
    return "";
  }
  const parts = target.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "..") {
      if (!parts.length) return "";
      parts.pop();
    } else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

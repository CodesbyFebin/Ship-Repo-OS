import { markdownLinks } from "./workbench/evidence.mjs";

export function countReadmeBadges(markdown) {
  const badges = new Set();
  for (const { target, image } of markdownLinks(markdown.replaceAll("[![", "!["))) {
    if (!image) continue;
    try {
      const url = new URL(target);
      const knownBadge = /^(?:[a-z0-9-]+\.)?(?:shields\.io|badgen\.net)$/i.test(url.hostname)
        || (url.hostname === "github.com" && /\/actions\/workflows\/[^/]+\/badge\.svg$/.test(url.pathname));
      if (knownBadge) badges.add(`${url.hostname}${url.pathname}`);
    } catch {
      // A relative or malformed image URL provides no badge evidence.
    }
  }
  return badges.size;
}

export function inspectDockerRuntime(dockerfile) {
  const stages = new Map();
  let runtime;
  for (const line of dockerfile.split(/\r?\n/)) {
    const from = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?\s*$/i.exec(line);
    if (from) {
      const [, image, name] = from;
      const inherited = stages.get(image.toLowerCase());
      runtime = inherited ? { ...inherited } : {
        pinned: image === "scratch" || /@sha256:[a-f\d]{64}$/i.test(image),
        user: "",
      };
      if (name) stages.set(name.toLowerCase(), runtime);
      continue;
    }
    const user = /^\s*USER\s+(\S+)\s*$/i.exec(line);
    if (runtime && user) runtime.user = user[1].split(":")[0];
  }
  if (!runtime) return { pass: false, detail: "No runtime stage could be read." };
  const nonRoot = /^(?:[1-9]\d*|[a-z_][a-z\d_-]*)$/i.test(runtime.user) && runtime.user.toLowerCase() !== "root";
  if (!nonRoot) return { pass: false, detail: "The runtime stage does not declare a verifiable non-root user." };
  if (!runtime.pinned) return { pass: false, detail: "The runtime base image does not declare a SHA-256 digest." };
  return { pass: true, detail: "Runtime has a digest-pinned base and an explicit non-root user." };
}

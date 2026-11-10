import assert from "node:assert/strict";
import test from "node:test";
import { countReadmeBadges, inspectDockerRuntime } from "../src/lib/shipos/repo-evidence.mjs";

test("badge evidence handles inline images and ignores banners and restyled duplicates", () => {
  const markdown = [
    "![Stars](https://img.shields.io/github/stars/owner/repo?style=flat)",
    "![Stars again](https://img.shields.io/github/stars/owner/repo?style=social)",
    "[![Build](https://github.com/owner/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/owner/repo/actions)",
    "![Cover](docs/cover.svg)",
  ].join(" ");
  assert.equal(countReadmeBadges(markdown), 2);
});

test("Docker evidence follows the runtime stage and requires an explicit non-root user and pinned base", () => {
  const base = `FROM node@sha256:${"a".repeat(64)} AS base\nUSER node\n`;
  assert.equal(inspectDockerRuntime(`${base}FROM base AS runtime\n`).pass, true);
  assert.equal(inspectDockerRuntime(`${base}FROM base AS runtime\nUSER 0:1000\n`).pass, false);
  assert.equal(inspectDockerRuntime(`${base}FROM node:24\nUSER 1000\n`).pass, false);
});

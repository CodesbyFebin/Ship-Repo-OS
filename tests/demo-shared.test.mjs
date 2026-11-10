import assert from "node:assert/strict";
import test from "node:test";
import { installCommand } from "../src/lib/shipos/demo-shared.ts";

test("demo setup recommends only a declared package script", () => {
  const repo = { detected: { packageManager: "bun", scripts: {} }, manifest: { scripts: {} }, rootFiles: [] };
  assert.equal(installCommand(repo), "bun install");
  repo.manifest.scripts.start = "node server.js";
  assert.equal(installCommand(repo), "bun install && bun run start");
  repo.detected.scripts.dev = "next dev";
  assert.equal(installCommand(repo), "bun install && bun run dev");
});

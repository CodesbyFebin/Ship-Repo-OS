#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HMAC_KEY_ENV,
  buildQualityProfile,
  createReceipt,
  evaluateG0,
  gateStatusReport,
  loadSnapshotFromRoot,
  runEvidenceSuite,
  verifyReceipt,
  verifySha256SumsInDirectory,
} from "../src/lib/shipos/evidence-engine/index.mjs";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

function flag(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (command === "help" || command === "--help" || command === "-h") {
  process.stdout.write(`ShipOS evidence engine
Usage:
  node scripts/evidence.mjs profile --root .
  node scripts/evidence.mjs g0 --repo-url URL --live-url URL
  node scripts/evidence.mjs g6 --sums SHA256SUMS --dir ./dist
  node scripts/evidence.mjs receipt --in payload.json [--out receipt.json]
  node scripts/evidence.mjs verify-receipt receipt.json
  node scripts/evidence.mjs suite --root . [--repo-url URL --live-url URL --sums FILE --dir DIR]
`);
  process.exit(0);
}

if (command === "profile") {
  const root = resolve(flag("--root", "."));
  print(buildQualityProfile(loadSnapshotFromRoot(root)));
} else if (command === "g0") {
  const result = await evaluateG0({ repoUrl: flag("--repo-url"), liveUrl: flag("--live-url") });
  print({ ...result, gates: gateStatusReport({ G0: result }) });
} else if (command === "g6") {
  const sums = resolve(flag("--sums", "SHA256SUMS"));
  const dir = resolve(flag("--dir", "."));
  print(verifySha256SumsInDirectory(sums, dir));
} else if (command === "receipt") {
  const payload = JSON.parse(readFileSync(resolve(flag("--in")), "utf8"));
  const receipt = createReceipt(payload, { hmacKey: process.env[HMAC_KEY_ENV] });
  const out = flag("--out");
  if (out) writeFileSync(resolve(out), `${JSON.stringify(receipt, null, 2)}\n`);
  print(receipt);
} else if (command === "verify-receipt") {
  const file = resolve(args[1] || flag("--in"));
  const receipt = JSON.parse(readFileSync(file, "utf8"));
  print(verifyReceipt(receipt, { hmacKey: process.env[HMAC_KEY_ENV] }));
} else if (command === "suite") {
  const root = resolve(flag("--root", "."));
  const sums = flag("--sums");
  const dir = flag("--dir");
  let manifest;
  let artifacts;
  if (sums && dir) {
    const fromDir = verifySha256SumsInDirectory(resolve(sums), resolve(dir));
    manifest = readFileSync(resolve(sums), "utf8");
    artifacts = Object.fromEntries((fromDir.results ?? []).filter((item) => item.file).map((item) => {
      try {
        return [item.file, readFileSync(resolve(dir, item.file))];
      } catch {
        return [item.file, ""];
      }
    }));
  }
  const result = await runEvidenceSuite({
    snapshot: loadSnapshotFromRoot(root),
    repoUrl: flag("--repo-url"),
    liveUrl: flag("--live-url"),
    manifest,
    artifacts,
    manifestPath: sums,
  });
  print(result);
} else {
  process.stderr.write(`Unknown command: ${command}\n`);
  process.exit(1);
}

#!/usr/bin/env bun
/** Fail if Cargo.toml or Cargo.lock version ≠ root package.json (SoT). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const cargo = readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8");
const match = /^version\s*=\s*"([^"]*)"/m.exec(cargo);
if (!match) {
  console.error("No version in Cargo.toml");
  process.exit(1);
}
if (match[1] !== pkg.version) {
  console.error(
    `Version mismatch: package.json=${pkg.version} Cargo.toml=${match[1]}\n` +
      `Run: bun run version ${pkg.version}`,
  );
  process.exit(1);
}
// Cargo.lock carries its own copy of the crate version and is not touched by
// `bun run version` — it only updates when cargo next runs. Releasing without
// it needed a follow-up commit once already (0f1210d), so check it here.
const lock = readFileSync(join(root, "src-tauri/Cargo.lock"), "utf8");
const lockMatch = /^name = "deckhand"\nversion = "([^"]*)"/m.exec(lock);
if (!lockMatch) {
  console.error("No deckhand entry in Cargo.lock");
  process.exit(1);
}
if (lockMatch[1] !== pkg.version) {
  console.error(
    `Version mismatch: package.json=${pkg.version} Cargo.lock=${lockMatch[1]}\n` +
      `Run: cargo check --manifest-path src-tauri/Cargo.toml`,
  );
  process.exit(1);
}

console.log(`versions ok: ${pkg.version}`);

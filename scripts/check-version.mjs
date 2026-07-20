#!/usr/bin/env bun
/** Fail if Cargo.toml version ≠ root package.json (SoT). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const cargo = readFileSync(join(root, "tauri/src-tauri/Cargo.toml"), "utf8");
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
console.log(`versions ok: ${pkg.version}`);

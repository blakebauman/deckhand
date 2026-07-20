#!/usr/bin/env bun
/**
 * Single-command version bump: root package.json (SoT) + Cargo.toml.
 * Usage: bun run version 0.1.0-alpha.1
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
const cargoPath = join(root, "tauri/src-tauri/Cargo.toml");

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const version = process.argv[2];
if (!version) {
  console.error("Usage: bun run version <semver>");
  process.exit(1);
}
if (!SEMVER.test(version)) {
  console.error(`Invalid semver: ${version}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

let cargo = readFileSync(cargoPath, "utf8");
const next = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
if (next === cargo) {
  console.error("Failed to patch version in Cargo.toml");
  process.exit(1);
}
writeFileSync(cargoPath, next);

console.log(`version → ${version}`);
console.log(`  ${pkgPath}`);
console.log(`  ${cargoPath}`);

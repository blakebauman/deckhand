# Development

## Prerequisites

- [Bun](https://bun.sh) (or npm)
- Go (see `sidecar/go.mod`)
- Rust / Cargo (for Tauri)
- A running Docker Engine (compatible API on the local socket or `DOCKER_HOST`)
- Optional: kubeconfig, `helm` CLI, Firecracker (Linux)

### Linux host packages

- `webkit2gtk` (Tauri webview)
- KVM (`/dev/kvm`) and a `firecracker` binary for MicroVMs mode

### Icons

Regenerating app icons requires `rsvg-convert` (and optionally ImageMagick for `.ico`).

## Quick start

```bash
bun install
bun run dev          # build sidecar + Tauri + Vite
```

`tauri:dev` starts Vite via `scripts/tauri-frontend-dev.sh`, which always uses this repo’s `tauri/` tree (never a sibling copy), checks that `app/` is the Spectrum 2 UI, and refuses to bind `:1420` if another project already owns it. The desktop shell prefers sidecar `127.0.0.1:7420` and falls back to an ephemeral port only if that bind fails.

### Split processes

Useful when iterating on the UI or sidecar alone:

```bash
bun run build:sidecar
./tauri/src-tauri/binaries/deckhand-sidecar --addr 127.0.0.1:7420

# separate terminal (stop any Tauri Vite on :1420 first)
VITE_SIDECAR_URL=http://127.0.0.1:7420 bun run dev:ui
```

Or run the sidecar with Go directly:

```bash
bun run dev:sidecar
```

## Scripts

| Script | Action |
|--------|--------|
| `bun run dev` | Build sidecar, then Tauri dev |
| `bun run dev:ui` | Vite UI only (`@deckhand/app`) |
| `bun run dev:sidecar` | Go sidecar on `127.0.0.1:7420` |
| `bun run build` | Production UI build |
| `bun run build:sidecar` | `scripts/build-sidecar.sh` → `tauri/src-tauri/binaries/` |
| `bun run icons` | `scripts/generate-icons.sh` from `brand/mark.svg` |
| `bun run tauri:build` | Sidecar + Tauri package |

## Packaging

Local:

```bash
bun run tauri:build
```

| Platform | Artifacts |
|----------|-----------|
| macOS | `.app`, `.dmg` under `tauri/src-tauri/target/release/bundle/` |
| Linux | `.deb`, AppImage |
| Windows | Deferred |

### Tag-triggered release CI

Pushing a version tag builds installers and attaches them to the GitHub Release:

```bash
bun run version 0.1.0-alpha.2   # syncs package.json + Cargo.toml
git commit -am "Release 0.1.0-alpha.2"
git tag v0.1.0-alpha.2
git push origin main v0.1.0-alpha.2
```

[`.github/workflows/release.yml`](../.github/workflows/release.yml) runs on `v*` tags (and `workflow_dispatch` for an existing tag). It packages:

- **macOS** (`macos-latest`) — Apple Silicon `.dmg` / `.app`
- **Linux** (`ubuntu-22.04`) — x86_64 `.deb` + AppImage

Tags containing `alpha`, `beta`, or `rc` are marked prerelease. macOS builds use **ad-hoc** code signing (`signingIdentity: "-"`) so Gatekeeper does not falsely report the app as damaged; users still need right-click → **Open** once (unidentified developer). Apple Developer ID + notarization is not configured yet. The workflow requires `package.json` version to match the tag (without the leading `v`).

### macOS install tip (current alpha)

If a downloaded build says it is **damaged**, clear quarantine after copying to Applications:

```bash
xattr -cr /Applications/Deckhand.app
```

Then open normally (or right-click → Open). That symptom is fixed in builds that include ad-hoc bundle signing (`v0.1.0-alpha.2`+).

Regular CI (`.github/workflows/ci.yml`) still only builds the sidecar + UI — not full installers.

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_SIDECAR_URL` | Override sidecar base URL for browser / split dev |
| `DOCKER_HOST` | Standard Docker client env (read by sidecar) |
| `KUBECONFIG` | kubeconfig path (default `~/.kube/config`) |

## UI

The React UI uses **Adobe Spectrum 2** via [`@react-spectrum/s2`](https://react-spectrum.adobe.com/getting-started).

- Style with the `style` / `iconStyle` macros (`with { type: 'macro' }`)
- Vite is configured with `unplugin-parcel-macros` (must be first in plugins)
- Do not add Radix, Tailwind, shadcn, or other component kits — see `.cursor/rules/spectrum-ui.mdc`

## Related

- [Architecture](./architecture.md)
- [Sidecar API](./api.md)

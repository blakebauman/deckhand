# Development

## Prerequisites

- [Bun](https://bun.sh) (or npm)
- Go (see `sidecar/go.mod`; CI uses 1.23.x)
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

```bash
bun run build:sidecar
bun run --filter @deckhand/tauri tauri:build
```

| Platform | Artifacts |
|----------|-----------|
| macOS | `.app`, `.dmg` |
| Linux | `.deb`, AppImage |
| Windows | Deferred |

CI (`.github/workflows/ci.yml`) builds the Go sidecar on macOS and Ubuntu and compiles the UI. Full Tauri packaging is left to local machines.

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

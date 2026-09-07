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

`tauri dev` runs `bun run dev:ui` (Vite on `:1420`) as its `beforeDevCommand`, then loads that URL. Vite uses `strictPort`, so a second instance fails loudly rather than silently serving from another port. The desktop shell prefers sidecar `127.0.0.1:7420` and falls back to an ephemeral port only if that bind fails.

### Split processes

Useful when iterating on the UI or sidecar alone:

```bash
bun run build:sidecar
./src-tauri/binaries/deckhand-sidecar --addr 127.0.0.1:7420 --token deckhand-dev

# separate terminal (stop any Tauri-started Vite on :1420 first)
VITE_SIDECAR_URL=http://127.0.0.1:7420 VITE_SIDECAR_TOKEN=deckhand-dev bun run dev:ui
```

The sidecar authenticates every request, so browser split-dev needs a token both sides agree on.
The desktop shell reuses a sidecar already on `:7420` only when `DECKHAND_SIDECAR_TOKEN` is exported
in *its* environment too — otherwise it cannot authenticate against a server it did not start, and
starts its own on an ephemeral port instead.
`bun run dev:sidecar` defaults to `deckhand-dev` for this reason; pass `--no-auth` instead if you
want it off entirely (it logs a warning — the API can bind-mount any host path into a container).

Or run the sidecar with Go directly:

```bash
bun run dev:sidecar
```

## Scripts

| Script | Action |
|--------|--------|
| `bun run dev` | Build sidecar, then Tauri dev |
| `bun run dev:ui` | Vite UI only, browser mode |
| `bun run dev:sidecar` | Go sidecar on `127.0.0.1:7420` |
| `bun run build` | Production UI build |
| `bun run build:sidecar` | `scripts/build-sidecar.sh` → `src-tauri/binaries/` |
| `bun run build:cli` | `deckhand` CLI → `bin/deckhand` (gitignored) |
| `bun run icons` | `scripts/generate-icons.sh` from `brand/mark.svg` |
| `bun run tauri:build` | Sidecar + Tauri package |

## Packaging

Local:

```bash
bun run tauri:build
```

| Platform | Artifacts |
|----------|-----------|
| macOS | `.app`, `.dmg` under `src-tauri/target/release/bundle/` |
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

Regular CI (`.github/workflows/ci.yml`) checks `gofmt`, builds and vets both Go binaries, runs `go test ./...`, and builds the UI — but not full installers.

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_SIDECAR_URL` | Override sidecar base URL for browser / split dev |
| `VITE_SIDECAR_TOKEN` | Sidecar token for browser / split dev |
| `DECKHAND_SIDECAR_TOKEN` | Token the sidecar should use instead of generating one |
| `DECKHAND_TOKEN` | Token the `deckhand` CLI presents |
| `DOCKER_HOST` | Standard Docker client env (read by sidecar) |
| `KUBECONFIG` | kubeconfig path (default `~/.kube/config`) |

## Lint and format

TypeScript is linted and formatted by [Biome](https://biomejs.dev):

```bash
bun run lint          # check
bun run lint:fix      # apply safe fixes
bun run format        # rewrite formatting
```

Three recommended rules are disabled in `biome.json`, because each fights a deliberate pattern
here rather than finding a defect:

| Rule | Why off |
|------|---------|
| `suspicious/noExplicitAny` | Docker and Kubernetes payloads are passed through as `any` (85 sites). Typing them is a real project; rewriting them to `unknown` would only move the casts. |
| `style/noNonNullAssertion` | `selected!` after an explicit guard is the idiom in the detail panes. |
| `correctness/useExhaustiveDependencies` | All hits were *excess* deps, not missing ones — several are `dataUpdatedAt`, used deliberately to re-run an effect when React Query refetches. The autofix would have changed behaviour. |

`src/components/ui/**` is excluded from linting: those files are regenerated by the shadcn CLI, so
fixes made there are lost on the next generation. They are still formatted.

## UI

The React UI uses **shadcn/ui** with the **Maia** preset (`bbVJxYW`) and **Tailwind CSS v4**.

- Primitives live under `src/components/ui/`
- Style with Tailwind utilities and CSS variables in `src/index.css`
- Do not add Adobe Spectrum or a second component kit — see `.cursor/rules/shadcn-ui.mdc`

## Related

- [Architecture](./architecture.md)
- [Sidecar API](./api.md)

# Architecture

Deckhand is a local-first desktop app. The React UI never talks to Docker or Kubernetes directly — it calls a Go sidecar over localhost HTTP. Tauri owns the window and sidecar process lifecycle.

```
UI (React / Vite)
       │  HTTP (localhost)
       ▼
Go sidecar ──► Docker Engine API
       │    ──► kubeconfig (client-go)
       │    ──► helm CLI
       │    ──► Firecracker (Linux + KVM; stub today)
       ▲
Tauri 2 (spawn / kill sidecar)
```

Partial connectivity is supported: Docker, Kubernetes, and Firecracker report status independently via `GET /api/status`.

## Packages

The repo is a single Bun package at the root — no workspaces.

| Path | Role |
|------|------|
| `src/` | React UI; `@/*` resolves here |
| `index.html`, `vite.config.ts`, `tsconfig.json` | The one Vite app, at the root |
| `public/` | Static assets served at `/` |
| `src-tauri/` | Tauri 2 shell (Rust crate, icons, bundled binaries) |
| `sidecar/` | Go HTTP API (`deckhand-sidecar`) |
| `brand/` | SVG mark and wordmark |
| `scripts/` | Sidecar build, icon generation, version sync |

`sidecar/` is a separate Go module, not part of the JS package. It is built with Go and copied into `src-tauri/binaries/` for bundling.

## Runtime flow

1. **Tauri startup** finds `binaries/deckhand-sidecar*` and spawns it with `--addr 127.0.0.1:0` (ephemeral port).
2. Sidecar prints `DECKHAND_SIDECAR_ADDR=host:port` on stdout; Tauri stores the URL for the `sidecar_url` command.
3. **UI boot** resolves the base URL via `invoke("sidecar_url")` in Tauri, or `VITE_SIDECAR_URL` / `http://127.0.0.1:7420` in browser-only mode, then polls `GET /health`.
4. **Tauri exit** kills the sidecar child process.

## Ports

| Service | Port | Notes |
|---------|------|--------|
| Vite (Tauri dev) | `1420` | `vite.config.ts` |
| Sidecar (manual) | `7420` | `bun run dev:sidecar` |
| Sidecar (Tauri) | ephemeral | `--addr 127.0.0.1:0` |

## UI modes

The sidebar switches between three modes (persisted in Zustand):

- **Docker** — dashboard, Compose, containers, images, volumes, networks, builds
- **Kubernetes** — overview, pods, deployments, resources, Helm
- **MicroVMs** — Firecracker VMs (sidebar entry only when the runtime reports available)

Tauri owns window lifecycle, sidecar spawn, and a system tray (Open / Quit; close-to-tray).

## Platform notes

| Topic | macOS | Linux |
|-------|-------|--------|
| Packaging | `.app`, `.dmg` | `.deb`, AppImage |
| Docker | Docker Engine API (local socket / `DOCKER_HOST`) | Docker Engine |
| Firecracker | Unavailable (`nop` provider) | Process + API sock when `/dev/kvm` + `firecracker` on `PATH` |
| Embed VM | Scaffold (`/api/engine`) | N/A — use attach + Firecracker |
| Host deps | — | `webkit2gtk`; KVM for MicroVMs |

Windows packaging is deferred.

## Related

- [Sidecar API](./api.md)
- [Embed runtime](./embed-runtime.md)
- [Supply chain](./supply-chain.md)
- [Development](./development.md)

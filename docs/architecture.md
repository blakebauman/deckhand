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

| Path | Role |
|------|------|
| `app/` | Shared React UI (`@deckhand/app`) |
| `tauri/` | Tauri 2 shell (`@deckhand/tauri`); Vite host aliases into `app/src` |
| `sidecar/` | Go HTTP API (`deckhand-sidecar`) |
| `brand/` | SVG mark and wordmark |
| `scripts/` | Sidecar build and icon generation |

`sidecar/` is not a Bun workspace member. It is built with Go and copied into `tauri/src-tauri/binaries/` for bundling.

## Runtime flow

1. **Tauri startup** finds `binaries/deckhand-sidecar*` and spawns it with `--addr 127.0.0.1:0` (ephemeral port).
2. Sidecar prints `DECKHAND_SIDECAR_ADDR=host:port` on stdout; Tauri stores the URL for the `sidecar_url` command.
3. **UI boot** resolves the base URL via `invoke("sidecar_url")` in Tauri, or `VITE_SIDECAR_URL` / `http://127.0.0.1:7420` in browser-only mode, then polls `GET /health`.
4. **Tauri exit** kills the sidecar child process.

## Ports

| Service | Port | Notes |
|---------|------|--------|
| Vite (Tauri dev) | `1420` | `tauri/vite.config.ts` |
| Sidecar (manual) | `7420` | `bun run dev:sidecar` |
| Sidecar (Tauri) | ephemeral | `--addr 127.0.0.1:0` |

## UI modes

The sidebar switches between three modes (persisted in Zustand):

- **Docker** — dashboard, Compose, containers, images, volumes, networks
- **Kubernetes** — overview, pods, deployments, Helm
- **MicroVMs** — Firecracker VMs (sidebar entry only when the runtime reports available)

## Platform notes

| Topic | macOS | Linux |
|-------|-------|--------|
| Packaging | `.app`, `.dmg` | `.deb`, AppImage |
| Docker | Docker Engine API (local socket / `DOCKER_HOST`) | Docker Engine |
| Firecracker | Unavailable (`nop` provider) | Shown when `/dev/kvm` + `firecracker` on `PATH` |
| Host deps | — | `webkit2gtk`; KVM for MicroVMs |

Windows packaging is deferred.

## Related

- [Sidecar API](./api.md)
- [Development](./development.md)

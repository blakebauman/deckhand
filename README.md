# Deckhand

Local-first Docker and Kubernetes desktop app for **macOS** and **Linux**.

Tauri 2 shell · Adobe Spectrum UI · Go sidecar for Docker, Compose, Kubernetes, Helm, and Linux Firecracker microVMs.

## Features

- **Docker** — dashboard, containers (logs / TTY / stats / mounts / debug shell), images (browse / Hub search), volumes (browse / clone / export), networks, Compose (per-service actions), builds (Buildx), disk prune, Docker contexts, diagnose
- **Kubernetes** — contexts, namespaces, pods, deployments, services, ingresses, configmaps, secrets (redacted), nodes, events, jobs, Helm
- **Enterprise-lite** — local audit log, secret redaction, confirm-before-prune, proxy-aware diagnose
- **Domains** — optional `*.deckhand.local` reverse proxy to published container ports
- **Engine modes** — attach (host Docker) or embed scaffold (see [docs/embed-runtime.md](docs/embed-runtime.md))
- **MicroVMs** — Firecracker process + API integration on Linux when KVM + `firecracker` are present
- **CLI** — `go run ./sidecar/cmd/deckhand -- status|diagnose|…`

## Quick start

```bash
bun install
bun run dev
```

See [docs/development.md](docs/development.md) for prerequisites, split-process workflows, and packaging.

## Downloads

Pre-release builds: [GitHub Releases](https://github.com/blakebauman/deckhand/releases).

macOS Apple Silicon DMGs are **ad-hoc signed** (not notarized). After install, if macOS blocks the app, right-click → **Open**, or:

```bash
xattr -cr /Applications/Deckhand.app
```

## Docs

| Doc | Description |
|-----|-------------|
| [Architecture](docs/architecture.md) | How the UI, Tauri, and sidecar fit together |
| [Development](docs/development.md) | Setup, scripts, packaging |
| [Sidecar API](docs/api.md) | Localhost HTTP API |
| [Embed runtime](docs/embed-runtime.md) | Attach vs embed / VirtioFS plan |
| [Supply chain](docs/supply-chain.md) | Audit, SBOM, signing notes |
| [Brand](brand/README.md) | Mark, wordmark, icons (`bun run icons`) |

## Architecture (sketch)

```
UI (Spectrum / React) → HTTP localhost → Go sidecar → Docker / kubeconfig / Helm / Firecracker
                              ↑
                         Tauri 2 (spawn + tray)
```

## License

MIT — see [LICENSE](LICENSE).

Not affiliated with the maritime [Deckhand logbook](https://deckhandlogbook.com/electronic-logbook-software/) product.

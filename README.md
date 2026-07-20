# Deckhand

Local-first Docker and Kubernetes desktop app for **macOS** and **Linux**.

Tauri 2 shell · Go sidecar for Docker, Compose, Kubernetes, Helm, and Linux Firecracker microVMs.

## Features

- **Docker** — dashboard, containers (logs / interactive TTY / stats / bulk actions), images, volumes, networks, Compose projects (engine list + folder scan), disk prune
- **Kubernetes** — contexts, namespaces, pods (logs / interactive TTY), deployments (scale / restart / delete), Helm releases
- **MicroVMs** — Firecracker provider on Linux when KVM + `firecracker` are present (hidden on macOS)

## Quick start

```bash
bun install
bun run dev
```

See [docs/development.md](docs/development.md) for prerequisites, split-process workflows, and packaging.

## Docs

| Doc | Description |
|-----|-------------|
| [Architecture](docs/architecture.md) | How the UI, Tauri, and sidecar fit together |
| [Development](docs/development.md) | Setup, scripts, packaging |
| [Sidecar API](docs/api.md) | Localhost HTTP API |
| [Brand](brand/README.md) | Mark, wordmark, icons (`bun run icons`) |

## Architecture (sketch)

```
UI (React) → HTTP localhost → Go sidecar → Docker / kubeconfig / Helm / Firecracker
                 ↑
            Tauri 2 (spawn lifecycle)
```

## License

MIT — see [LICENSE](LICENSE).

Not affiliated with the maritime [Deckhand logbook](https://deckhandlogbook.com/electronic-logbook-software/) product.

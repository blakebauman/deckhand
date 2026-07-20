# Sidecar API

Localhost HTTP API served by `deckhand-sidecar`. Routes are defined in `sidecar/internal/server/server.go`.

- CORS: all origins
- JSON errors: `{ "error": "..." }`
- Base URL: Tauri-provided ephemeral port, or `http://127.0.0.1:7420` in manual/split dev

## Health and status

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{ ok, service }` |
| `GET` | `/api/status` | Docker / Kubernetes / Firecracker availability |
| `GET` | `/api/audit` | Query: `n` — tail of local JSONL audit log |
| `GET` / `PUT` | `/api/engine` | Dual-mode engine config (attach / embed scaffold) |
| `GET` / `POST` | `/api/domains` | `*.deckhand.local` reverse-proxy status / enable; labels `dev.deckhand.domains`, `dev.deckhand.http-port` |

## Docker

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/docker/info` | Engine info |
| `GET` | `/api/docker/dashboard` | Resource counts |
| `GET` | `/api/docker/gpus` | NVIDIA GPU status |
| `GET` | `/api/docker/diagnose` | Troubleshoot snapshot |
| `GET` / `POST` | `/api/docker/contexts` | List / switch Docker CLI contexts |
| `GET` | `/api/docker/containers` | Query: `all` (default true) |
| `POST` | `/api/docker/containers` | Create / run (supports `mounts[]`, `labels`) |
| `GET` | `/api/docker/containers/{id}` | Inspect |
| `POST` | `/api/docker/containers/{id}/start` | Start |
| `POST` | `/api/docker/containers/{id}/stop` | Stop |
| `POST` | `/api/docker/containers/{id}/restart` | Restart |
| `DELETE` | `/api/docker/containers/{id}` | Query: `force` |
| `POST` | `/api/docker/containers/{id}/debug` | Distroless debug shell (netshoot sidecar) |
| `GET` | `/api/docker/containers/{id}/logs` | Query: `follow`, `tail`; text stream |
| `POST` | `/api/docker/containers/{id}/exec` | Body: `{ cmd: string[] }` — one-shot |
| `GET` | `/api/docker/containers/{id}/exec/ws` | WebSocket TTY |
| `GET` | `/api/docker/containers/{id}/stats` | Query: `stream=true` → NDJSON |
| `POST` | `/api/docker/containers/bulk` | Body: `{ ids, action }` |
| `GET` | `/api/docker/images` | List |
| `POST` | `/api/docker/images/pull` | Body: `{ ref }`; NDJSON progress |
| `DELETE` | `/api/docker/images/{id}` | Query: `force` |
| `POST` | `/api/docker/images/prune` | Dangling images |
| `POST` | `/api/docker/images/{id}/scan` | Body optional `{ ref }` — Trivy/Grype if on PATH |
| `GET` | `/api/docker/images/{id}/files` | Browse image filesystem |
| `GET` | `/api/docker/builders` | Buildx builders |
| `POST` | `/api/docker/build` | Body: `{ context, dockerfile?, tag? }`; text stream |
| `GET` / `POST` | `/api/docker/volumes` | List / create |
| `GET` / `DELETE` | `/api/docker/volumes/{name}` | Inspect / remove |
| `GET` | `/api/docker/volumes/{name}/files` | Browse volume files |
| `POST` | `/api/docker/volumes/clone` | Body: `{ source, dest }` |
| `GET` | `/api/docker/volumes/{name}/export` | Tar stream |
| `POST` | `/api/docker/volumes/{name}/import` | Tar body |
| `GET` / `POST` | `/api/docker/networks` | List / create |
| `GET` / `DELETE` | `/api/docker/networks/{id}` | Inspect / remove |
| `GET` | `/api/docker/events` | SSE |
| `GET` | `/api/docker/system/df` | Disk usage |
| `POST` | `/api/docker/system/prune` | Selective prune |
| `GET` | `/api/docker/registry/search` | Query: `q`, `limit` — Docker Hub |
| `POST` | `/api/docker/registry/login` | Body: `{ server?, username, password }` |
| `GET` / `PUT` | `/api/docker/daemon-json` | Read / write daemon.json |

## Compose

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/compose/projects` | Engine projects |
| `POST` | `/api/compose/discover` | Folder scan |
| `POST` | `/api/compose/up` | Up |
| `POST` | `/api/compose/down` | Down |
| `POST` | `/api/compose/restart` | Restart project |
| `POST` | `/api/compose/ps` | Ps (raw) |
| `POST` | `/api/compose/services` | Per-service status |
| `POST` | `/api/compose/service-action` | Body: `{ action, services[], … }` |

## Kubernetes

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/k8s/status` | Cluster probe |
| `GET` / `POST` | `/api/k8s/contexts` | List / switch |
| `GET` | `/api/k8s/namespaces` | Namespaces |
| `GET` / `DELETE` | `/api/k8s/pods/{ns}/{name}` | Pods |
| `GET` | `/api/k8s/pods/{ns}/{name}/logs` | Logs |
| `POST` / `GET` | `/api/k8s/pods/{ns}/{name}/exec` | Exec / TTY |
| `GET` | `/api/k8s/deployments` | Deployments |
| `POST` | `/api/k8s/deployments/{ns}/{name}/scale` | Scale |
| `POST` | `/api/k8s/deployments/{ns}/{name}/restart` | Restart |
| `DELETE` | `/api/k8s/deployments/{ns}/{name}` | Delete |
| `GET` | `/api/k8s/services` | Services |
| `GET` | `/api/k8s/ingresses` | Ingresses |
| `GET` | `/api/k8s/configmaps` | ConfigMaps |
| `GET` | `/api/k8s/secrets` | Secrets (**keys only**, values redacted) |
| `GET` | `/api/k8s/nodes` | Nodes |
| `GET` | `/api/k8s/events` | Events |
| `GET` | `/api/k8s/jobs` | Jobs |
| `GET` | `/api/k8s/cronjobs` | CronJobs |
| `GET` | `/api/k8s/statefulsets` | StatefulSets |

## Helm

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/helm/releases` | List |
| `GET` | `/api/helm/releases/{ns}/{name}` | Status |
| `POST` | `/api/helm/install` | Install |
| `POST` | `/api/helm/upgrade` | Upgrade |
| `POST` | `/api/helm/rollback` | Rollback |
| `DELETE` | `/api/helm/releases/{ns}/{name}` | Uninstall |

## Runtimes / Firecracker

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/runtimes` | `[{ name, available }]` |
| `GET` | `/api/runtimes/firecracker/vms` | List |
| `POST` | `/api/runtimes/firecracker/vms` | Create |
| `POST` | `/api/runtimes/firecracker/vms/{id}/start` | Start (real process + API sock on Linux) |
| `POST` | `/api/runtimes/firecracker/vms/{id}/stop` | Stop |
| `DELETE` | `/api/runtimes/firecracker/vms/{id}` | Destroy |
| `GET` | `/api/runtimes/firecracker/vms/{id}/logs` | Logs |

On Linux, availability requires `/dev/kvm` and `firecracker` on `PATH`. Start launches `firecracker --api-sock` and configures machine/boot/drive via the Firecracker HTTP API.

## CLI

```bash
go run ./cmd/deckhand — status|diagnose|contexts|use-context|ps|audit|engine|domains
```

Env: `DECKHAND_URL` (default `http://127.0.0.1:7420`).

## Related

- [Architecture](./architecture.md)
- [Embed runtime](./embed-runtime.md)
- [Supply chain](./supply-chain.md)
- UI client: `app/src/lib/api.ts`

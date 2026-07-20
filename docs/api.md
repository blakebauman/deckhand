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

## Docker

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/docker/info` | Engine info |
| `GET` | `/api/docker/dashboard` | Resource counts |
| `GET` | `/api/docker/gpus` | NVIDIA GPU status |
| `GET` | `/api/docker/containers` | Query: `all` (default true) |
| `POST` | `/api/docker/containers` | Create / run |
| `GET` | `/api/docker/containers/{id}` | Inspect |
| `POST` | `/api/docker/containers/{id}/start` | Start |
| `POST` | `/api/docker/containers/{id}/stop` | Stop |
| `POST` | `/api/docker/containers/{id}/restart` | Restart |
| `DELETE` | `/api/docker/containers/{id}` | Query: `force` |
| `GET` | `/api/docker/containers/{id}/logs` | Query: `follow`, `tail`; text stream |
| `POST` | `/api/docker/containers/{id}/exec` | Body: `{ cmd: string[] }` — one-shot |
| `GET` | `/api/docker/containers/{id}/exec/ws` | WebSocket TTY (`?shell=sh\|bash\|ash`); binary I/O + JSON resize |
| `GET` | `/api/docker/containers/{id}/stats` | Query: `stream=true` → NDJSON |
| `POST` | `/api/docker/containers/bulk` | Body: `{ ids, action }` |
| `GET` | `/api/docker/images` | List |
| `POST` | `/api/docker/images/pull` | Body: `{ ref }`; NDJSON progress |
| `DELETE` | `/api/docker/images/{id}` | Query: `force` |
| `POST` | `/api/docker/images/prune` | Dangling images |
| `GET` / `POST` | `/api/docker/volumes` | List / create |
| `GET` / `DELETE` | `/api/docker/volumes/{name}` | Inspect / remove |
| `GET` / `POST` | `/api/docker/networks` | List / create |
| `GET` / `DELETE` | `/api/docker/networks/{id}` | Inspect / remove |
| `GET` | `/api/docker/events` | SSE |
| `GET` | `/api/docker/system/df` | Disk usage |
| `POST` | `/api/docker/system/prune` | Selective prune |

## Compose

Shells out to `docker compose`.

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/compose/projects` | Engine projects from `docker compose ls -a` |
| `POST` | `/api/compose/discover` | Body: `{ roots: string[], maxDepth? }` — scan folders for compose files |
| `POST` | `/api/compose/up` | Body: `{ path?, configFiles?, yaml?, projectName? }` |
| `POST` | `/api/compose/down` | same (projectName alone is enough for known engine projects) |
| `POST` | `/api/compose/restart` | same |
| `POST` | `/api/compose/ps` | same |

`GET /api/compose/projects` drops config file paths that no longer exist on disk.

## Kubernetes

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/k8s/status` | Cluster probe |
| `GET` | `/api/k8s/contexts` | `{ contexts, current }` |
| `POST` | `/api/k8s/contexts` | Body: `{ name }` |
| `GET` | `/api/k8s/namespaces` | Namespace list |
| `GET` | `/api/k8s/pods` | Query: `namespace` |
| `GET` / `DELETE` | `/api/k8s/pods/{ns}/{name}` | Get / delete |
| `GET` | `/api/k8s/pods/{ns}/{name}/logs` | Query: `follow`, `tail`, `container` |
| `POST` | `/api/k8s/pods/{ns}/{name}/exec` | Body: `{ cmd, container? }` — one-shot |
| `GET` | `/api/k8s/pods/{ns}/{name}/exec/ws` | WebSocket TTY (`?shell=…&container=…`) |
| `GET` | `/api/k8s/deployments` | Query: `namespace` |
| `GET` | `/api/k8s/deployments/{ns}/{name}` | Get |
| `POST` | `/api/k8s/deployments/{ns}/{name}/scale` | Body: `{ replicas }` |
| `POST` | `/api/k8s/deployments/{ns}/{name}/restart` | Rollout restart |
| `DELETE` | `/api/k8s/deployments/{ns}/{name}` | Delete |

## Helm

Shells out to the `helm` CLI.

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/helm/releases` | Query: `namespace`, `allNamespaces` |
| `GET` | `/api/helm/releases/{ns}/{name}` | Status JSON |
| `POST` | `/api/helm/install` | Install |
| `POST` | `/api/helm/upgrade` | Upgrade |
| `POST` | `/api/helm/rollback` | Body: `{ namespace, name, revision }` |
| `DELETE` | `/api/helm/releases/{ns}/{name}` | Uninstall |

## Runtimes / Firecracker

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/runtimes` | `[{ name, available }]` |
| `GET` | `/api/runtimes/firecracker/vms` | List |
| `POST` | `/api/runtimes/firecracker/vms` | Create |
| `POST` | `/api/runtimes/firecracker/vms/{id}/start` | Start |
| `POST` | `/api/runtimes/firecracker/vms/{id}/stop` | Stop |
| `DELETE` | `/api/runtimes/firecracker/vms/{id}` | Destroy |
| `GET` | `/api/runtimes/firecracker/vms/{id}/logs` | Logs |

On Linux, availability requires `/dev/kvm` and `firecracker` on `PATH`. The current provider tracks VM metadata in memory; full Firecracker process integration is not wired yet.

## Related

- [Architecture](./architecture.md)
- UI client: `app/src/lib/api.ts`

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install
bun run dev              # build sidecar → Tauri dev (Vite on :1420)
bun run dev:ui           # Vite UI only; pair with VITE_SIDECAR_URL
bun run dev:sidecar      # go run the sidecar on 127.0.0.1:7420
bun run build            # tsc --noEmit && vite build  (the UI typecheck gate)
bun run build:sidecar    # scripts/build-sidecar.sh → src-tauri/binaries/
bun run version 0.1.0-x  # sync package.json + Cargo.toml
bun run version:check    # fail if Cargo.toml ≠ root package.json version
bun run tauri:build      # sidecar + installers (.dmg/.app, .deb/AppImage)

cd sidecar && go build ./... && go vet ./...   # sidecar checks
```

There are **no tests yet** — 32 Go files, zero `*_test.go`, and no JS test runner. Verification
is the build: `bun run build` for the UI, `go build ./... && go vet ./...` for the sidecar. CI
(`.github/workflows/ci.yml`) runs exactly those plus `go test ./...` and `bun run version:check`.
CI also gates `gofmt` on `sidecar/` — fix a failure with `gofmt -w sidecar/`. There is no
formatter or linter configured for the TypeScript side; `tsc --noEmit` is the only gate there.

xterm.js is code-split behind `ExecTerminalLazy` (~85 KB gzipped, the largest single dependency).
Import that wrapper rather than `ExecTerminal` directly, or the terminal lands back in the initial
bundle.

The repo is a **single Bun package at the root** — no workspaces, one `package.json`, one
`vite.config.ts`, one `tsconfig.json`, one `index.html`. `sidecar/` is a separate Go module.
Do not reintroduce a second Vite app or a workspace member for the frontend.

Split-process dev (UI iteration without rebuilding Tauri) — stop any Tauri Vite on `:1420` first,
since `strictPort` is on:

```bash
./src-tauri/binaries/deckhand-sidecar --addr 127.0.0.1:7420
VITE_SIDECAR_URL=http://127.0.0.1:7420 bun run dev:ui
```

## Architecture

Three processes, one direction of travel:

```
React UI (src/) ──HTTP+WS localhost──► Go sidecar (sidecar/) ──► Docker Engine API
                                              ├──► kubeconfig (client-go)
                                              ├──► helm CLI
      Tauri 2 (src-tauri/) spawns/kills ──────┴──► Firecracker (Linux + KVM)
```

The UI **never** talks to Docker or Kubernetes directly, and the sidecar has no UI knowledge —
every feature crosses both boundaries. Adding one typically means editing four places:

1. `sidecar/internal/<domain>/` — the capability (docker, k8s, helm, compose, domains, runtime, engine)
2. `sidecar/internal/server/server.go` `routes()` — one `mux.HandleFunc("VERB /api/...")` line
   (Go 1.22 method+wildcard patterns; handler bodies live in `server.go` or `handlers_ext.go`)
3. `src/lib/api.ts` — a method on the single `api` object (the only place `fetch` base URL lives)
4. `src/routes/*.tsx` — a React Query `useQuery`/`useMutation`

Keep `docs/api.md` in step when routes change; it is the hand-maintained mirror of `routes()`.

### Sidecar boundaries

- `sidecar/` is a separate Go module, outside the JS package. It builds with Go and is copied
  into `src-tauri/binaries/`, so Tauri runs a *stale* sidecar until `build:sidecar` reruns.
- Two binaries share the internals: `cmd/deckhand-sidecar` (HTTP daemon) and `cmd/deckhand` (CLI).
- Streaming is plain HTTP, not a framework: logs/build are text streams, image pull and container
  stats are NDJSON, Docker events are SSE, TTYs are WebSockets (`tty_ws.go`).
- Docker, Kubernetes, and Firecracker report availability **independently** via `GET /api/status`;
  partial connectivity is normal and the UI must degrade per-subsystem, not fail whole-app.
- Firecracker uses build-tag providers: `runtime/firecracker_linux.go` vs `runtime/nop.go`.
  Anything platform-specific belongs behind `runtime.Provider`, not in a handler.

### Auth (do not regress this)

Every sidecar request must carry a per-launch token — `Authorization: Bearer <t>` or `?token=<t>`.
The query form is not laziness: `EventSource`, `WebSocket`, and `window.open` cannot set headers,
and the events, logs, exec, stats, and volume-export endpoints are driven through exactly those.
In `src/lib/api.ts`, `request()` uses the header and every `*Url()` helper goes through
`tokenized()`; a new streaming endpoint must use one or the other or it will 401.

CORS mirrors auth rather than an origin allowlist — the request's `Origin` is echoed only after the
token is accepted. That is deliberate: the Tauri webview's origin differs per platform
(`tauri://localhost` on macOS, `http://tauri.localhost` elsewhere), so an allowlist risks breaking
a platform that cannot be tested locally, while a caller holding the token is authorized anyway.
Preflight is answered before the token check because a preflight never carries the header.

This replaced `Access-Control-Allow-Origin: *` with no auth at all, under which any page the user
visited could `POST /api/docker/containers` with a bind mount of `/` and take the host.

### Sidecar-URL resolution (the fragile part)

Tauri spawns the sidecar, prefers `127.0.0.1:7420`, and falls back to an ephemeral port; the child
prints `DECKHAND_SIDECAR_ADDR=host:port` on stdout, which Tauri exposes via the `sidecar_url`
command, alongside `sidecar_token`. `src/App.tsx` polls `invoke("sidecar_url")` (up to 40×250ms),
calls `setApiBaseUrl` + `setApiToken`, then polls `/health` before rendering — and **re-invokes**
both periodically while failing, so a restarted sidecar on a new port recovers. The token must be
refreshed with the URL: a restarted sidecar mints a new one, so refreshing only the URL reconnects
to an endpoint that then 401s everything. In a plain browser it uses `VITE_SIDECAR_URL` or
`:7420`. Never hardcode a base URL outside `src/lib/api.ts`.

### UI shell

`vite.config.ts` aliases `@` → `src/` and serves on `:1420` with `strictPort`, so a second Vite
fails loudly instead of drifting to another port; `tauri dev` starts it via `beforeDevCommand`.
Routing is code-defined in `src/router.tsx` (TanStack Router, flat routes under one
`RootLayout`), not file-based. Server state is React Query with `refetchInterval` polling
(~4–8s per list); client/persisted state is `src/stores/uiStore.ts` (Zustand + `persist`) —
including the three-way `mode` (`docker` | `kubernetes` | `microvms`) that drives the sidebar, and
user prefs like `confirmPrune`.

## Conventions

- **UI kit: shadcn/ui with the Maia preset (`base-maia`, `bbVJxYW`) + Tailwind v4, exclusively.**
  Primitives in `src/components/ui/` (shadcn CLI-generated), tokens in `src/index.css`,
  `cn()` from `@/lib/utils`. Do not add Adobe React Spectrum, Spectrum Charts, `style()` macros,
  MUI/Chakra/Ant, or hand-rolled Radix wrappers duplicating `@/components/ui`. The repo was
  migrated off Spectrum; reintroducing it undoes that. See `.cursor/rules/shadcn-ui.mdc`.
- Icons: `lucide-react` via `Icon` / `lucideProps()` in `src/components/Icon.tsx` (S/M/L size
  tokens, stroke 1.75) — not raw `<LucideIcon size={…}>`.
- Page composition: `PageShell` (title/description/actions) wrapping `ListPane*` + `DetailPane`
  parts, with the app helpers `Tip`, `StatusBadge`, `RowMenu`, `Field`, `MoreActionsMenu`,
  `SegmentedControl`. Custom widgets with no shadcn equivalent (xterm, Vega charts) get Tailwind
  token chrome rather than a second design system.
- Toasts go through `@/lib/toast` (Sonner), not `sonner` directly.
- Title-bar drag: use `useWindowDragProps()` and mark interactive children `data-no-drag`.
- Mutating sidecar operations log to the local JSONL audit log (`~/.deckhand/audit.jsonl`) via
  `s.audit.Log(action, target, detail, err)` — follow that for new destructive/stateful handlers.
- Kubernetes Secret values are redacted server-side (`k8s/resources.go` `SecretSummary`); never
  return raw secret data to the UI.
- Destructive actions (prune, remove) confirm in the UI by default, gated on `confirmPrune`.
- Versions: `package.json` is the source of truth; `src-tauri/Cargo.toml` must match, and
  release tags `v<version>` must match it too. Use `bun run version <v>` rather than editing both.

## Platform notes

macOS and Linux only (Windows packaging deferred). Firecracker/MicroVMs are Linux + `/dev/kvm` +
`firecracker` on PATH; on macOS the `nop` provider reports unavailable and the sidebar entry hides.
macOS release builds are **ad-hoc signed, not notarized**.

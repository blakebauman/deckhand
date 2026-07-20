# Embed runtime (R0–R2)

Deckhand supports dual engine modes:

| Mode | Behavior |
|------|----------|
| **attach** (default) | Use host Docker via `DOCKER_HOST` / CLI contexts |
| **embed** | Deckhand-managed Linux VM + Engine on macOS (scaffold) |

## R0 — Design (current)

- Config persisted at `~/.deckhand/engine.json` (`GET/PUT /api/engine`)
- Mode switch is recorded; embed reports `embedAvailable: false` until the guest ships
- VirtioFS share list, CPU/memory/disk, Resource Saver flags are stored for the future VM

## R1 — Bundled VM (planned)

- Apple Virtualization.framework (or equivalent) boots a minimal Linux guest
- Docker Engine inside the guest; Deckhand exposes a dedicated socket/context `deckhand-embed`
- Resource Saver stops the VM when idle

## R2 — VirtioFS (planned)

- Shared directories from `virtiofsShares` mounted into the guest
- Bind mounts in Run UI validated against the allowlist
- Only applies in embed mode — attach mode uses the host engine’s file sharing

## Linux hosts

Prefer **attach** + Firecracker microVMs (`/microvms`) for isolation. No VirtioFS required.

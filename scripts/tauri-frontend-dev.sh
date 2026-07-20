#!/usr/bin/env bash
# Start the Tauri Vite frontend from this repo only (never a sibling copy).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$ROOT/tauri"

case "$ROOT" in
  *"deckhand copy"* | *"deckhand-copy"*)
    echo "error: refusing to start Vite from a copy tree: $ROOT" >&2
    exit 1
    ;;
esac

if [[ ! -f "$TAURI_DIR/vite.config.ts" || ! -f "$TAURI_DIR/src/main.tsx" ]]; then
  echo "error: tauri frontend missing under $TAURI_DIR" >&2
  exit 1
fi

if ! grep -q '@react-spectrum/s2' "$ROOT/app/src/App.tsx" 2>/dev/null; then
  echo "error: $ROOT/app/src/App.tsx is not the Spectrum 2 app" >&2
  exit 1
fi

PORT=1420
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "${PIDS}" ]]; then
    for pid in $PIDS; do
      cwd="$(lsof -a -p "$pid" -d cwd 2>/dev/null | awk 'NR==2 { print $NF }' || true)"
      # Only reuse the Tauri Vite (tauri/), never @deckhand/app on the same port.
      if [[ -n "${cwd:-}" && ("$cwd" == "$TAURI_DIR" || "$cwd" == "$TAURI_DIR"/*) ]]; then
        echo "Tauri Vite already listening on :$PORT from $cwd — reusing"
        # Keep the process alive for Tauri's wait; block until killed.
        while kill -0 "$pid" 2>/dev/null; do sleep 3600; done
        exit 0
      fi
      echo "error: port $PORT is already in use by pid $pid${cwd:+ (cwd: $cwd)}" >&2
      echo "That is not the Tauri Vite. Stop it (e.g. bun app dev), then retry." >&2
      exit 1
    done
  fi
fi

cd "$TAURI_DIR"
exec bunx vite --port "$PORT" --strictPort

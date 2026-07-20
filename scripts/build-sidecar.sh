#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/tauri/src-tauri/binaries"
mkdir -p "$OUT"

cd "$ROOT/sidecar"
go build -o "$OUT/deckhand-sidecar" ./cmd/deckhand-sidecar

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  arm64|aarch64) ARCH="aarch64" ;;
  x86_64|amd64) ARCH="x86_64" ;;
esac

case "$OS" in
  darwin)
    TRIPLE="${ARCH}-apple-darwin"
    ;;
  linux)
    TRIPLE="${ARCH}-unknown-linux-gnu"
    ;;
  *)
    TRIPLE="${ARCH}-${OS}"
    ;;
esac

cp -f "$OUT/deckhand-sidecar" "$OUT/deckhand-sidecar-${TRIPLE}"
echo "Built $OUT/deckhand-sidecar and deckhand-sidecar-${TRIPLE}"

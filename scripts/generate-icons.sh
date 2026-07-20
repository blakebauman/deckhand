#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARK="$ROOT/brand/mark.svg"
ICONS="$ROOT/tauri/src-tauri/icons"
PUB="$ROOT/app/public"
ASSETS="$ROOT/app/src/assets/brand"

command -v rsvg-convert >/dev/null || { echo "rsvg-convert required (brew install librsvg)"; exit 1; }

mkdir -p "$ICONS" "$PUB" "$ASSETS"
cp "$ROOT"/brand/*.svg "$ASSETS/"
cp "$ROOT/brand/favicon.svg" "$PUB/favicon.svg"

rsvg-convert -w 32 -h 32 "$MARK" -o "$ICONS/32x32.png"
rsvg-convert -w 128 -h 128 "$MARK" -o "$ICONS/128x128.png"
rsvg-convert -w 256 -h 256 "$MARK" -o "$ICONS/128x128@2x.png"
rsvg-convert -w 512 -h 512 "$MARK" -o "$ICONS/icon.png"
rsvg-convert -w 1024 -h 1024 "$MARK" -o "$ICONS/icon-1024.png"
rsvg-convert -w 32 -h 32 "$ROOT/brand/favicon.svg" -o "$PUB/favicon.png"
cp "$MARK" "$ICONS/mark.svg"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/deckhand.iconset"
for s in 16 32 128 256 512; do
  rsvg-convert -w "$s" -h "$s" "$MARK" -o "$TMP/deckhand.iconset/icon_${s}x${s}.png"
  rsvg-convert -w $((s * 2)) -h $((s * 2)) "$MARK" -o "$TMP/deckhand.iconset/icon_${s}x${s}@2x.png"
done
iconutil -c icns "$TMP/deckhand.iconset" -o "$ICONS/icon.icns"
if command -v magick >/dev/null; then
  magick "$ICONS/icon.png" -define icon:auto-resize=256,128,64,48,32,16 "$ICONS/icon.ico"
fi
echo "Icons written to $ICONS and $PUB"

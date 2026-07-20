/** Platform modifier label for shortcut hints (⌘ on Apple, Ctrl elsewhere). */
export function modKeyLabel(): "⌘" | "Ctrl" {
  if (typeof navigator === "undefined") return "Ctrl";
  const apple =
    /Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
    // Tauri on macOS reports platform correctly; also catch UA as fallback.
    /Mac OS X/.test(navigator.userAgent);
  return apple ? "⌘" : "Ctrl";
}

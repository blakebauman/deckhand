import type { CSSProperties, MouseEvent } from "react";

async function startWindowDrag() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch {
    // Browser / non-Tauri preview — ignore.
  }
}

/**
 * macOS overlay titlebar drag strip.
 * Needs `core:window:allow-start-dragging` in Tauri capabilities.
 */
export function TitleBarDragRegion() {
  if (typeof navigator === "undefined") return null;
  if (navigator.userAgent.includes("Windows")) return null;

  return (
    <div
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-[9999] h-14"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        void startWindowDrag();
      }}
      aria-hidden
    />
  );
}

/** Make a chrome region window-draggable (skip interactive children with data-no-drag). */
export function useWindowDragProps() {
  return {
    "data-tauri-drag-region": true,
    style: { WebkitAppRegion: "drag" } as CSSProperties,
    onMouseDown: (e: MouseEvent) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("button, a, input, textarea, select, [data-no-drag], [role='button']")) return;
      void startWindowDrag();
    },
  };
}

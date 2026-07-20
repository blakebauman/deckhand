import type { CSSProperties, ReactNode } from "react";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TitleBarDragRegion } from "@/components/TitleBarDragRegion";
import { isTauriShell } from "@/lib/platform";

/**
 * Reserved space for the fixed status dock (bar + hairline + breathing room).
 * Applied as inline padding-bottom — Spectrum style() can drop arbitrary clearance.
 */
export const STATUS_DOCK_CLEARANCE = 64;

const frameBase = style({
  display: "flex",
  flexDirection: "column",
  height: "screen",
  overflow: "hidden",
  backgroundColor: "base",
});

const frameDesktop = style({
  display: "flex",
  flexDirection: "column",
  height: "screen",
  overflow: "hidden",
  backgroundColor: "base",
  paddingTop: 56,
  boxSizing: "border-box",
});

const content = style({
  position: "relative",
  zIndex: 0,
  minHeight: 0,
  flexGrow: 1,
  overflow: "hidden",
  boxSizing: "border-box",
});

/** Content-sized dock — top hairline only (avoid borderStyle painting all sides). */
const dock = style({
  position: "fixed",
  insetX: 0,
  bottom: 0,
  zIndex: 40,
  backgroundColor: "layer-1",
  paddingY: 12,
});

export function AppFrame({
  children,
  dock: dockSlot,
}: {
  children: ReactNode;
  dock?: ReactNode;
}) {
  const desktop = isTauriShell();

  return (
    <div className={desktop ? frameDesktop : frameBase} style={{ boxSizing: "border-box" }}>
      {desktop ? <TitleBarDragRegion /> : null}
      <div
        className={content}
        style={dockSlot ? { paddingBottom: STATUS_DOCK_CLEARANCE } : undefined}
      >
        {children}
      </div>
      {dockSlot ? (
        <div
          className={["dh-status-dock", dock].join(" ")}
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          data-no-drag
        >
          {dockSlot}
        </div>
      ) : null}
    </div>
  );
}

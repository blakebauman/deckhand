import type { CSSProperties, ReactNode } from "react";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { TitleBarDragRegion } from "@/components/TitleBarDragRegion";
import { isTauriShell } from "@/lib/platform";

const frameBase = style({
  display: "flex",
  flexDirection: "column",
  height: "screen",
  overflow: "hidden",
  backgroundColor: "base",
  paddingBottom: 64,
});

const frameDesktop = style({
  display: "flex",
  flexDirection: "column",
  height: "screen",
  overflow: "hidden",
  backgroundColor: "base",
  paddingTop: 56,
  paddingBottom: 64,
});

const content = style({
  position: "relative",
  zIndex: 0,
  minHeight: 0,
  flexGrow: 1,
});

const dock = style({
  position: "fixed",
  insetX: 0,
  bottom: 0,
  zIndex: 40,
  borderTopWidth: 1,
  borderStyle: "solid",
  borderColor: "gray-300",
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
    <div className={desktop ? frameDesktop : frameBase}>
      {desktop ? <TitleBarDragRegion /> : null}
      <div className={content}>{children}</div>
      {dockSlot ? (
        <div
          className={dock}
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          data-no-drag
        >
          {dockSlot}
        </div>
      ) : null}
    </div>
  );
}

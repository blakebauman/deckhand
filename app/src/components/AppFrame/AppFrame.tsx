import type { CSSProperties, ReactNode } from "react";
import { TitleBarDragRegion } from "@/components/TitleBarDragRegion";
import { cn } from "@/lib/utils";
import { isTauriShell } from "@/lib/platform";

/**
 * Reserved space under live content so scrollports end above the fixed dock
 * with a visible breathing gap (dock itself stays content-height).
 */
export const STATUS_DOCK_CLEARANCE = 96;

export function AppFrame({
  children,
  dock: dockSlot,
}: {
  children: ReactNode;
  dock?: ReactNode;
}) {
  const desktop = isTauriShell();

  return (
    <div
      className={cn(
        "flex h-screen flex-col overflow-hidden bg-background",
        desktop && "box-border pt-14",
      )}
      style={{ boxSizing: "border-box" }}
    >
      {desktop ? <TitleBarDragRegion /> : null}
      <div
        className="relative z-0 min-h-0 flex-1 overflow-hidden box-border"
        style={dockSlot ? { paddingBottom: STATUS_DOCK_CLEARANCE } : undefined}
      >
        {children}
      </div>
      {dockSlot ? (
        <div
          className="dh-status-dock fixed end-0 bottom-0 start-20 z-40 bg-card py-3"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          data-no-drag
        >
          {dockSlot}
        </div>
      ) : null}
    </div>
  );
}

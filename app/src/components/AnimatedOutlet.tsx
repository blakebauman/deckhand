import { Outlet, useRouterState } from "@tanstack/react-router";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

/** Route outlet keyed by pathname for remount on navigation. */
export function AnimatedOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div
      key={pathname}
      className={style({
        height: "full",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      })}
    >
      <Outlet />
    </div>
  );
}

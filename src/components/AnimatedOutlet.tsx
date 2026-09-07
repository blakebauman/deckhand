import { Outlet, useRouterState } from "@tanstack/react-router";

/** Route outlet keyed by pathname for remount on navigation. */
export function AnimatedOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div key={pathname} className="flex h-full min-h-0 flex-col">
      <Outlet />
    </div>
  );
}

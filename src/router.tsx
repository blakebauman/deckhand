import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { AnimatedOutlet } from "@/components/AnimatedOutlet";
import { AppFrame } from "@/components/AppFrame/AppFrame";
import { AppProvider } from "@/components/AppProvider";
import { GlobalSheets } from "@/components/GlobalSheets";
import { Sidebar } from "@/components/Sidebar";
import { StatusDock } from "@/components/StatusDock";
import { Toaster } from "@/components/Toaster";
import {
  BuildsPage,
  ContainersPage,
  DashboardPage,
  DeploymentsPage,
  HelmPage,
  ImagesPage,
  K8sOverviewPage,
  K8sResourcesPage,
  MicroVMsOverviewPage,
  MicroVMsPage,
  NetworksPage,
  PodsPage,
  ProjectsPage,
  SettingsPage,
  VolumesPage,
} from "@/routes";

function RootLayout() {
  return (
    <AppProvider>
      <AppFrame dock={<StatusDock />}>
        <Sidebar />
        <main
          className="ml-20 flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
          // Block width:auto + margin-inline-start can still overflow in the webview;
          // pin to the remaining viewport so the end padding stays visible.
          style={{ width: "calc(100% - 80px)", boxSizing: "border-box" }}
        >
          <div className="mx-auto box-border flex h-full min-h-0 min-w-0 w-full max-w-[1800px] flex-col overflow-x-hidden overflow-y-auto px-6 pt-3 pb-8 md:px-8">
            <AnimatedOutlet />
          </div>
        </main>
        <GlobalSheets />
      </AppFrame>
      <Toaster />
    </AppProvider>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const routeDefs = [
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: DashboardPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/projects", component: ProjectsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/containers", component: ContainersPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/images", component: ImagesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/networks", component: NetworksPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/volumes", component: VolumesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/builds", component: BuildsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/k8s", component: K8sOverviewPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/k8s/pods", component: PodsPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/k8s/deployments",
    component: DeploymentsPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/k8s/resources",
    component: K8sResourcesPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: "/k8s/helm", component: HelmPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/microvms",
    component: MicroVMsOverviewPage,
  }),
  createRoute({ getParentRoute: () => rootRoute, path: "/microvms/vms", component: MicroVMsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage }),
];

const routeTree = rootRoute.addChildren(routeDefs);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}

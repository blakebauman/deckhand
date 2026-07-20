import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppFrame } from "@/components/AppFrame/AppFrame";
import { AnimatedOutlet } from "@/components/AnimatedOutlet";
import { GlobalSheets } from "@/components/GlobalSheets";
import { Sidebar } from "@/components/Sidebar";
import { SpectrumProvider } from "@/components/SpectrumProvider";
import { StatusDock } from "@/components/StatusDock";
import { Toaster } from "@/components/Toaster";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
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
    <SpectrumProvider>
      <AppFrame dock={<StatusDock />}>
        <Sidebar />
        <main
          className={style({
            marginStart: 80,
            height: "full",
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          })}
        >
          <div
            className={style({
              maxWidth: 1800,
              marginX: "auto",
              width: "full",
              height: "full",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              paddingX: 32,
              paddingY: 16,
              paddingBottom: 24,
              overflowY: "auto",
            })}
          >
            <AnimatedOutlet />
          </div>
        </main>
        <GlobalSheets />
      </AppFrame>
      <Toaster />
    </SpectrumProvider>
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
  createRoute({ getParentRoute: () => rootRoute, path: "/k8s/deployments", component: DeploymentsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/k8s/resources", component: K8sResourcesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/k8s/helm", component: HelmPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "/microvms", component: MicroVMsOverviewPage }),
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

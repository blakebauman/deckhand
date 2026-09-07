import { useMatchRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Boxes,
  ChartColumn,
  Cloud,
  Code,
  Container,
  Database,
  FolderOpen,
  Globe,
  Info,
  Layers,
  Monitor,
  Search,
  Settings,
  Table,
} from "lucide-react";
import { useEffect, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { useUIStore, type AppMode } from "@/stores/uiStore";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { lucideProps } from "@/components/Icon";
import { LogoMark } from "@/components/Logo";
import { DockerMark, KubernetesMark, MicroVMMark } from "@/components/ModeMarks";
import { APP_VERSION } from "@/lib/version";
import { isTauriShell } from "@/lib/platform";
import { modKeyLabel } from "@/lib/hotkeys";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  exact?: boolean;
};

const dockerNav: NavItem[] = [
  { to: "/", icon: ChartColumn, label: "Dashboard", hint: "Engine health and GPU overview", exact: true },
  { to: "/projects", icon: FolderOpen, label: "Projects", hint: "Compose up and down" },
  { to: "/containers", icon: Container, label: "Containers", hint: "Monitor, logs, and exec" },
  { to: "/images", icon: Layers, label: "Images", hint: "Pull, prune, and remove images" },
  { to: "/builds", icon: Code, label: "Builds", hint: "Build images and search Hub" },
  { to: "/networks", icon: Globe, label: "Networks", hint: "Bridge and custom networks" },
  { to: "/volumes", icon: Database, label: "Volumes", hint: "Named volumes on this engine" },
  { to: "/settings", icon: Settings, label: "Settings", hint: "Theme and connection status" },
];

const k8sNav: NavItem[] = [
  { to: "/k8s", icon: ChartColumn, label: "Overview", hint: "Namespace workload summary", exact: true },
  { to: "/k8s/pods", icon: Boxes, label: "Pods", hint: "Logs and exec for pods" },
  { to: "/k8s/deployments", icon: Cloud, label: "Deployments", hint: "Scale, restart, delete" },
  { to: "/k8s/resources", icon: Table, label: "Resources", hint: "Services, secrets, jobs, and more" },
  { to: "/k8s/helm", icon: Archive, label: "Helm", hint: "Install and manage releases" },
  { to: "/settings", icon: Settings, label: "Settings", hint: "Theme and connection status" },
];

const microNav: NavItem[] = [
  { to: "/microvms", icon: ChartColumn, label: "Overview", hint: "Firecracker availability", exact: true },
  { to: "/microvms/vms", icon: Monitor, label: "VMs", hint: "Create and manage microVMs" },
  { to: "/settings", icon: Settings, label: "Settings", hint: "Theme and connection status" },
];

const modes: {
  id: AppMode;
  title: string;
  hint: string;
  icon: (props: { size?: number }) => ReactNode;
  /** Per-mark override; the Docker whale is wide and short so it needs more height. */
  iconSize?: number;
}[] = [
  { id: "docker", title: "Docker", hint: "Local Docker engine", icon: DockerMark, iconSize: 22 },
  { id: "kubernetes", title: "Kubernetes", hint: "Cluster via kubeconfig", icon: KubernetesMark, iconSize: 21 },
  { id: "microvms", title: "MicroVMs", hint: "Firecracker (Linux + KVM)", icon: MicroVMMark },
];

function modeFromPath(pathname: string): AppMode | null {
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return null;
  if (pathname.startsWith("/k8s")) return "kubernetes";
  if (pathname.startsWith("/microvms")) return "microvms";
  if (
    pathname === "/" ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/containers") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/builds") ||
    pathname.startsWith("/networks") ||
    pathname.startsWith("/volumes")
  ) {
    return "docker";
  }
  return null;
}

const railBtn =
  "box-border flex size-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-0 p-0 text-foreground";
const modeRailBtn =
  "box-border flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0";

function RailTip({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 text-start">
      <span className="text-sm font-semibold">{title}</span>
      {hint ? <span className="text-xs opacity-72">{hint}</span> : null}
    </div>
  );
}

function TipRight({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactElement;
}) {
  const enabled = useUIStore((s) => s.sidebarTooltips);
  if (!enabled) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" className="max-w-60">
        <RailTip title={title} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const mode = useUIStore((s) => s.mode);
  const setMode = useUIStore((s) => s.setMode);
  const openCommandPalette = useUIStore((s) => s.openCommandPalette);
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const runtimes = useQuery({ queryKey: ["runtimes"], queryFn: api.runtimes, refetchInterval: 15000 });
  const fcAvailable = runtimes.data?.some((r) => r.name === "firecracker" && r.available);
  const mod = modKeyLabel();

  useEffect(() => {
    const next = modeFromPath(pathname);
    if (next && next !== mode) setMode(next);
  }, [pathname, mode, setMode]);

  const nav = mode === "docker" ? dockerNav : mode === "kubernetes" ? k8sNav : microNav;

  const switchMode = (next: AppMode) => {
    setMode(next);
    if (next === "docker") navigate({ to: "/" });
    else if (next === "kubernetes") navigate({ to: "/k8s" });
    else navigate({ to: "/microvms" });
  };

  const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;
  const visibleModes = modes.filter((m) => m.id !== "microvms" || fcAvailable);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 start-0 z-30 flex w-20 flex-col items-center gap-5 bg-card pb-28",
        isTauriShell() ? "pt-16" : "pt-5",
      )}
    >
      <TipRight title="Deckhand" hint="Open dashboard">
        <button
          type="button"
          className={cn(railBtn, "size-12 hover:bg-muted")}
          style={noDrag}
          aria-label="Deckhand, open dashboard"
          onClick={() => navigate({ to: "/" })}
        >
          <LogoMark size={28} />
        </button>
      </TipRight>

      <div
        className="flex flex-col items-center gap-1 rounded-full bg-muted p-1"
        style={noDrag}
        role="group"
        aria-label="Runtime mode"
      >
        {visibleModes.map((m) => {
          const Icon = m.icon;
          const selected = mode === m.id;
          return (
            <TipRight key={m.id} title={m.title} hint={m.hint}>
              <button
                type="button"
                className={cn(
                  modeRailBtn,
                  selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-background/60",
                )}
                aria-label={m.title}
                aria-pressed={selected}
                onClick={() => switchMode(m.id)}
              >
                <Icon size={m.iconSize ?? 18} />
              </button>
            </TipRight>
          );
        })}
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2 pt-1" style={noDrag}>
        {nav.map((item) => {
          const active = item.exact
            ? !!matchRoute({ to: item.to, fuzzy: false })
            : !!matchRoute({ to: item.to, fuzzy: true });
          const Icon = item.icon;
          return (
            <TipRight key={item.to + item.label} title={item.label} hint={item.hint}>
              <button
                type="button"
                className={cn(railBtn, active ? "bg-muted" : "hover:bg-muted/60")}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate({ to: item.to })}
              >
                <Icon {...lucideProps("M")} />
              </button>
            </TipRight>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2 pb-1" style={noDrag}>
        <TipRight title="Command palette" hint={`${mod}K`}>
          <button
            type="button"
            className={cn(railBtn, "hover:bg-muted/60")}
            aria-label={`Command palette (${mod}K)`}
            onClick={() => openCommandPalette()}
          >
            <Search {...lucideProps("M")} />
          </button>
        </TipRight>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className={cn(railBtn, "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                aria-label={`Deckhand version ${APP_VERSION}`}
                onClick={() => navigate({ to: "/settings" })}
              >
                <Info {...lucideProps("M")} />
              </button>
            }
          />
          <TooltipContent side="right" className="max-w-none flex-col items-start py-2">
            <span className="text-sm font-semibold">Deckhand</span>
            <span className="font-mono text-xs opacity-90">v{APP_VERSION}</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

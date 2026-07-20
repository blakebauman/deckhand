import { useMatchRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ActionButton,
  Text,
  Tooltip,
  TooltipTrigger,
  type IconProps,
} from "@react-spectrum/s2";
import Home from "@react-spectrum/s2/icons/Home";
import Apps from "@react-spectrum/s2/icons/Apps";
import Images from "@react-spectrum/s2/icons/Images";
import SocialNetwork from "@react-spectrum/s2/icons/SocialNetwork";
import Data from "@react-spectrum/s2/icons/Data";
import Settings from "@react-spectrum/s2/icons/Settings";
import Collection from "@react-spectrum/s2/icons/Collection";
import Cloud from "@react-spectrum/s2/icons/Cloud";
import Archive from "@react-spectrum/s2/icons/Archive";
import DeviceDesktop from "@react-spectrum/s2/icons/DeviceDesktop";
import Layers from "@react-spectrum/s2/icons/Layers";
import Tools from "@react-spectrum/s2/icons/Tools";
import ViewList from "@react-spectrum/s2/icons/ViewList";
import { style, iconStyle } from "@react-spectrum/s2/style" with { type: "macro" };
import { useEffect, type CSSProperties, type ComponentType, type ReactNode } from "react";
import { useUIStore, type AppMode } from "@/stores/uiStore";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LogoMark } from "@/components/Logo";
import { DockerMark, KubernetesMark, MicroVMMark } from "@/components/ModeMarks";
import { APP_VERSION } from "@/lib/version";
import { isTauriShell } from "@/lib/platform";

type NavIcon = ComponentType<IconProps>;

type NavItem = {
  to: string;
  icon: NavIcon;
  label: string;
  hint?: string;
  exact?: boolean;
};

const dockerNav: NavItem[] = [
  { to: "/", icon: Home, label: "Dashboard", hint: "Engine health and GPU overview", exact: true },
  { to: "/projects", icon: Layers, label: "Projects", hint: "Compose up and down" },
  { to: "/containers", icon: Apps, label: "Containers", hint: "Monitor, logs, and exec" },
  { to: "/images", icon: Images, label: "Images", hint: "Pull, prune, and remove images" },
  { to: "/builds", icon: Tools, label: "Builds", hint: "Build images and search Hub" },
  { to: "/networks", icon: SocialNetwork, label: "Networks", hint: "Bridge and custom networks" },
  { to: "/volumes", icon: Data, label: "Volumes", hint: "Named volumes on this engine" },
  { to: "/settings", icon: Settings, label: "Settings", hint: "Theme and connection status" },
];

const k8sNav: NavItem[] = [
  { to: "/k8s", icon: Home, label: "Overview", hint: "Namespace workload summary", exact: true },
  { to: "/k8s/pods", icon: Collection, label: "Pods", hint: "Logs and exec for pods" },
  { to: "/k8s/deployments", icon: Cloud, label: "Deployments", hint: "Scale, restart, delete" },
  { to: "/k8s/resources", icon: ViewList, label: "Resources", hint: "Services, secrets, jobs, and more" },
  { to: "/k8s/helm", icon: Archive, label: "Helm", hint: "Install and manage releases" },
  { to: "/settings", icon: Settings, label: "Settings", hint: "Theme and connection status" },
];

const microNav: NavItem[] = [
  { to: "/microvms", icon: Home, label: "Overview", hint: "Firecracker availability", exact: true },
  { to: "/microvms/vms", icon: DeviceDesktop, label: "VMs", hint: "Create and manage microVMs" },
  { to: "/settings", icon: Settings, label: "Settings", hint: "Theme and connection status" },
];

const modes: {
  id: AppMode;
  title: string;
  hint: string;
  icon: (props: { size?: number }) => ReactNode;
}[] = [
  { id: "docker", title: "Docker", hint: "Local Docker engine", icon: DockerMark },
  { id: "kubernetes", title: "Kubernetes", hint: "Cluster via kubeconfig", icon: KubernetesMark },
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

const asideStyle = style({
  position: "fixed",
  insetY: 0,
  start: 0,
  zIndex: 30,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 20,
  width: 80,
  borderEndWidth: 1,
  borderStyle: "solid",
  borderColor: "gray-300",
  backgroundColor: "layer-1",
  paddingY: 20,
});

const asideStyleDesktop = style({
  position: "fixed",
  insetY: 0,
  start: 0,
  zIndex: 30,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 20,
  width: 80,
  borderEndWidth: 1,
  borderStyle: "solid",
  borderColor: "gray-300",
  backgroundColor: "layer-1",
  paddingY: 20,
  paddingTop: 64,
});

const navBtn = style({
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 44,
  height: 44,
  borderRadius: "full",
  borderWidth: 0,
  padding: 0,
  cursor: "pointer",
  color: "neutral",
  overflow: "hidden",
  backgroundColor: {
    default: "transparent",
    ":hover": "gray-100",
  },
});

const navBtnActive = style({
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 44,
  height: 44,
  borderRadius: "full",
  borderWidth: 0,
  padding: 0,
  cursor: "pointer",
  color: "neutral",
  overflow: "hidden",
  backgroundColor: "gray-200",
});

const logoBtn = style({
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 48,
  height: 48,
  borderRadius: "full",
  borderWidth: 0,
  padding: 0,
  cursor: "pointer",
  overflow: "hidden",
  backgroundColor: {
    default: "transparent",
    ":hover": "gray-100",
  },
});

const modeBtn = style({
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 36,
  height: 36,
  borderRadius: "full",
  borderWidth: 0,
  padding: 0,
  cursor: "pointer",
  color: "neutral",
  backgroundColor: {
    default: "transparent",
    ":hover": "gray-100",
  },
});

const modeBtnActive = style({
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 36,
  height: 36,
  borderRadius: "full",
  borderWidth: 0,
  padding: 0,
  cursor: "pointer",
  color: "white",
  backgroundColor: "accent",
});

function TipRight({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <TooltipTrigger placement="end" delay={400}>
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

export function Sidebar() {
  const mode = useUIStore((s) => s.mode);
  const setMode = useUIStore((s) => s.setMode);
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const runtimes = useQuery({ queryKey: ["runtimes"], queryFn: api.runtimes, refetchInterval: 15000 });
  const fcAvailable = runtimes.data?.some((r) => r.name === "firecracker" && r.available);

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
    <aside className={isTauriShell() ? asideStyleDesktop : asideStyle}>
      <TipRight label="Deckhand">
        <button
          type="button"
          className={logoBtn}
          style={noDrag}
          aria-label="Deckhand"
          onClick={() => navigate({ to: "/" })}
        >
          <LogoMark size={28} />
        </button>
      </TipRight>

      <div
        className={style({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: 4,
          borderRadius: "pill",
          backgroundColor: "gray-100",
        })}
        style={noDrag}
        role="group"
        aria-label="Runtime mode"
      >
        {visibleModes.map((m) => {
          const Icon = m.icon;
          const selected = mode === m.id;
          return (
            <TipRight
              key={m.id}
              label={
                <div>
                  <Text styles={style({ font: "ui", display: "block" })}>{m.title}</Text>
                  <Text
                    styles={style({
                      font: "detail-sm",
                      color: "neutral-subdued",
                      display: "block",
                    })}
                  >
                    {m.hint}
                  </Text>
                </div>
              }
            >
              <button
                type="button"
                className={selected ? modeBtnActive : modeBtn}
                aria-label={m.title}
                aria-pressed={selected}
                onClick={() => switchMode(m.id)}
              >
                <Icon size={18} />
              </button>
            </TipRight>
          );
        })}
      </div>

      <nav
        className={style({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          flexGrow: 1,
          paddingTop: 4,
        })}
        style={noDrag}
      >
        {nav.map((item) => {
          const active = item.exact
            ? !!matchRoute({ to: item.to, fuzzy: false })
            : !!matchRoute({ to: item.to, fuzzy: true });
          const Icon = item.icon;
          return (
            <TipRight
              key={item.to + item.label}
              label={
                <div>
                  <Text styles={style({ font: "ui", display: "block" })}>{item.label}</Text>
                  {item.hint ? (
                    <Text
                      styles={style({
                        font: "detail-sm",
                        color: "neutral-subdued",
                        display: "block",
                      })}
                    >
                      {item.hint}
                    </Text>
                  ) : null}
                </div>
              }
            >
              <button
                type="button"
                className={active ? navBtnActive : navBtn}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate({ to: item.to })}
              >
                <Icon styles={iconStyle({ size: "M" })} />
              </button>
            </TipRight>
          );
        })}
      </nav>

      <div className={style({ marginTop: "auto", paddingBottom: 4 })} style={noDrag}>
        <TipRight label={`Deckhand v${APP_VERSION}`}>
          <ActionButton isQuiet aria-label={`Deckhand v${APP_VERSION}`}>
            <Text
              styles={style({
                font: "detail-sm",
                color: "neutral-subdued",
              })}
            >
              v{APP_VERSION}
            </Text>
          </ActionButton>
        </TipRight>
      </div>
    </aside>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CustomDialog,
  DialogContainer,
  Heading,
  SearchField,
  Text,
} from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Boxes,
  Cloud,
  Container,
  Database,
  FolderOpen,
  Globe,
  Layers,
  LayoutGrid,
  List,
  Play,
  Settings,
  Trash2,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api";
import { lucideProps } from "@/components/Icon";
import { isTauriShell } from "@/lib/platform";
import { useUIStore } from "@/stores/uiStore";
import { containerName, shortId } from "@/lib/utils";

type Action = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: LucideIcon;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  onRunContainer,
  onOpenPrune,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunContainer?: () => void;
  onOpenPrune?: () => void;
}) {
  const navigate = useNavigate();
  const setMode = useUIStore((s) => s.setMode);
  const setPendingContainerId = useUIStore((s) => s.setPendingContainerId);
  const setPendingImageId = useUIStore((s) => s.setPendingImageId);
  const setPendingVolumeName = useUIStore((s) => s.setPendingVolumeName);
  const openRunSheet = useUIStore((s) => s.openRunSheet);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!open) {
      setQ("");
      setActive(0);
      setDebounced("");
    }
  }, [open]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 220);
    return () => window.clearTimeout(t);
  }, [q]);

  const containers = useQuery({
    queryKey: ["containers", "palette"],
    queryFn: () => api.containers(true),
    enabled: open,
    staleTime: 10_000,
  });
  const images = useQuery({
    queryKey: ["images", "palette"],
    queryFn: api.images,
    enabled: open,
    staleTime: 15_000,
  });
  const volumes = useQuery({
    queryKey: ["volumes", "palette"],
    queryFn: api.volumes,
    enabled: open,
    staleTime: 15_000,
  });
  const projects = useQuery({
    queryKey: ["compose-projects", "palette"],
    queryFn: api.composeProjects,
    enabled: open,
    staleTime: 15_000,
  });
  const hub = useQuery({
    queryKey: ["hub-search", debounced],
    queryFn: () => api.registrySearch(debounced, 8),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  const navActions = useMemo<Action[]>(() => {
    const go = (to: string, mode?: "docker" | "kubernetes" | "microvms") => () => {
      if (mode) setMode(mode);
      navigate({ to });
      onOpenChange(false);
    };
    return [
      { id: "dash", label: "Dashboard", hint: "Docker", group: "Navigate", icon: LayoutGrid, run: go("/", "docker") },
      { id: "projects", label: "Projects", hint: "Compose", group: "Navigate", icon: FolderOpen, run: go("/projects", "docker") },
      { id: "containers", label: "Containers", group: "Navigate", icon: Container, run: go("/containers", "docker") },
      { id: "images", label: "Images", group: "Navigate", icon: Layers, run: go("/images", "docker") },
      { id: "builds", label: "Builds", hint: "Build & Hub search", group: "Navigate", icon: Wrench, run: go("/builds", "docker") },
      { id: "networks", label: "Networks", group: "Navigate", icon: Globe, run: go("/networks", "docker") },
      { id: "volumes", label: "Volumes", group: "Navigate", icon: Database, run: go("/volumes", "docker") },
      { id: "k8s", label: "Kubernetes overview", group: "Navigate", icon: LayoutGrid, run: go("/k8s", "kubernetes") },
      { id: "pods", label: "Pods", group: "Navigate", icon: Boxes, run: go("/k8s/pods", "kubernetes") },
      { id: "deps", label: "Deployments", group: "Navigate", icon: Cloud, run: go("/k8s/deployments", "kubernetes") },
      { id: "resources", label: "Resources", hint: "Services, secrets, jobs…", group: "Navigate", icon: List, run: go("/k8s/resources", "kubernetes") },
      { id: "helm", label: "Helm", group: "Navigate", icon: Archive, run: go("/k8s/helm", "kubernetes") },
      { id: "settings", label: "Settings", group: "Navigate", icon: Settings, run: go("/settings") },
      {
        id: "run",
        label: "Run container…",
        hint: "Create from image",
        group: "Actions",
        icon: Play,
        run: () => {
          onOpenChange(false);
          onRunContainer?.();
        },
      },
      {
        id: "prune",
        label: "Prune engine disk…",
        hint: "System df",
        group: "Actions",
        icon: Trash2,
        run: () => {
          onOpenChange(false);
          onOpenPrune?.();
        },
      },
    ];
  }, [navigate, onOpenChange, onOpenPrune, onRunContainer, setMode]);

  const resourceActions = useMemo<Action[]>(() => {
    const out: Action[] = [];
    for (const c of containers.data || []) {
      const name = containerName(c.names) || shortId(c.id);
      out.push({
        id: `ctr-${c.id}`,
        label: name,
        hint: `${c.state || "?"} · ${c.image || ""}`.slice(0, 48),
        group: "Containers",
        icon: Container,
        run: () => {
          setMode("docker");
          setPendingContainerId(c.id);
          navigate({ to: "/containers" });
          onOpenChange(false);
        },
      });
    }
    for (const p of projects.data || []) {
      out.push({
        id: `proj-${p.name}-${p.path || ""}`,
        label: p.name,
        hint: p.status || p.source || "compose",
        group: "Compose",
        icon: FolderOpen,
        run: () => {
          setMode("docker");
          navigate({ to: "/projects" });
          onOpenChange(false);
        },
      });
    }
    for (const img of images.data || []) {
      const tag = img.RepoTags?.[0] || shortId(img.Id);
      out.push({
        id: `img-${img.Id}`,
        label: tag,
        hint: "image",
        group: "Images",
        icon: Layers,
        run: () => {
          setMode("docker");
          setPendingImageId(img.Id);
          navigate({ to: "/images" });
          onOpenChange(false);
        },
      });
    }
    for (const v of volumes.data || []) {
      const name = v.Name || v.name;
      if (!name) continue;
      out.push({
        id: `vol-${name}`,
        label: name,
        hint: "volume",
        group: "Volumes",
        icon: Database,
        run: () => {
          setMode("docker");
          setPendingVolumeName(name);
          navigate({ to: "/volumes" });
          onOpenChange(false);
        },
      });
    }
    for (const h of hub.data || []) {
      out.push({
        id: `hub-${h.name}`,
        label: h.name,
        hint: h.isOfficial ? "Hub · official" : `Hub · ★${h.starCount}`,
        group: "Docker Hub",
        icon: Cloud,
        run: () => {
          setMode("docker");
          openRunSheet(h.name.includes(":") ? h.name : `${h.name}:latest`);
          onOpenChange(false);
        },
      });
    }
    return out;
  }, [
    containers.data,
    projects.data,
    images.data,
    volumes.data,
    hub.data,
    navigate,
    onOpenChange,
    openRunSheet,
    setMode,
    setPendingContainerId,
    setPendingImageId,
    setPendingVolumeName,
  ]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = [...resourceActions, ...navActions];
    if (!needle) {
      // Prefer navigate + a few live resources when empty
      return [
        ...navActions,
        ...resourceActions.filter((a) => a.group === "Containers").slice(0, 8),
      ];
    }
    return all.filter(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        a.hint?.toLowerCase().includes(needle) ||
        a.group.toLowerCase().includes(needle),
    );
  }, [navActions, resourceActions, q]);

  useEffect(() => {
    setActive(0);
  }, [q, filtered.length]);

  return (
    <DialogContainer onDismiss={() => onOpenChange(false)}>
      {open ? (
        <CustomDialog size="M" padding="none" aria-label="Command palette">
          <Heading
            slot="title"
            styles={style({
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: 0,
              overflow: "hidden",
              borderWidth: 0,
            })}
          >
            Command palette
          </Heading>
          <div
            className={style({
              borderBottomWidth: 1,
              borderStyle: "solid",
              borderColor: "gray-200",
              paddingX: 16,
              paddingY: 12,
            })}
          >
            <SearchField
              autoFocus
              aria-label="Search containers, images, volumes, Hub"
              value={q}
              onChange={setQ}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(filtered.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  filtered[active]?.run();
                }
              }}
              placeholder="Search containers, Compose, images, volumes, Hub…"
            />
          </div>
          <div
            className={style({
              maxHeight: 360,
              overflowY: "auto",
              padding: 8,
            })}
          >
            {filtered.length === 0 ? (
              <div className={style({ paddingX: 12, paddingY: 32, textAlign: "center" })}>
                <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>No matches</Text>
              </div>
            ) : (
              filtered.map((a, i) => {
                const Icon = a.icon;
                const selected = i === active;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => a.run()}
                    className={
                      selected
                        ? style({
                            display: "flex",
                            width: "full",
                            alignItems: "center",
                            gap: 12,
                            borderRadius: "lg",
                            paddingX: 12,
                            paddingY: 8,
                            textAlign: "start",
                            backgroundColor: "gray-200",
                            borderStyle: "none",
                            cursor: "pointer",
                            color: "neutral",
                          })
                        : style({
                            display: "flex",
                            width: "full",
                            alignItems: "center",
                            gap: 12,
                            borderRadius: "lg",
                            paddingX: 12,
                            paddingY: 8,
                            textAlign: "start",
                            backgroundColor: "transparent",
                            borderStyle: "none",
                            cursor: "pointer",
                            color: "neutral",
                          })
                    }
                  >
                    <Icon {...lucideProps("S")} />
                    <span
                      className={style({
                        minWidth: 0,
                        flexGrow: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      })}
                    >
                      <Text styles={style({ font: "ui", fontWeight: "medium" })}>{a.label}</Text>
                      <span className={style({ display: "block", font: "detail", color: "neutral-subdued" })}>
                        {a.group}
                      </span>
                    </span>
                    {a.hint ? (
                      <Text styles={style({ font: "detail", color: "neutral-subdued" })}>{a.hint}</Text>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          <div
            className={style({
              borderTopWidth: 1,
              borderStyle: "solid",
              borderColor: "gray-200",
              paddingX: 16,
              paddingY: 8,
            })}
          >
            <Text styles={style({ font: "detail", color: "neutral-subdued" })}>
              ↑↓ navigate · ↵ select · esc close
              {hub.isFetching ? " · searching Hub…" : ""}
            </Text>
          </div>
        </CustomDialog>
      ) : null}
    </DialogContainer>
  );
}

/** Global ⌘K / Ctrl+K listener + palette host (Tauri menu emits the same toggle). */
export function CommandPaletteHost({
  onRunContainer,
  onOpenPrune,
}: {
  onRunContainer?: () => void;
  onOpenPrune?: () => void;
}) {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const toggle = useUIStore((s) => s.toggleCommandPalette);

  useEffect(() => {
    let last = 0;
    const fire = () => {
      const now = Date.now();
      // Dedupe webview keydown + native menu accelerator on the same press.
      if (now - last < 80) return;
      last = now;
      toggle();
    };

    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      if (e.altKey || e.shiftKey || e.repeat) return;
      e.preventDefault();
      fire();
    };
    window.addEventListener("keydown", onKey);

    let unlisten: (() => void) | undefined;
    if (isTauriShell()) {
      void import("@tauri-apps/api/event").then(({ listen }) =>
        listen("deckhand://command-palette", () => fire()).then((fn) => {
          unlisten = fn;
        }),
      );
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      unlisten?.();
    };
  }, [toggle]);

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      onRunContainer={onRunContainer}
      onOpenPrune={onOpenPrune}
    />
  );
}

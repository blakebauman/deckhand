import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CustomDialog,
  DialogContainer,
  Heading,
  SearchField,
  Text,
} from "@react-spectrum/s2";
import { style, iconStyle } from "@react-spectrum/s2/style" with { type: "macro" };
import ViewGrid from "@react-spectrum/s2/icons/ViewGrid";
import Layers from "@react-spectrum/s2/icons/Layers";
import Collection from "@react-spectrum/s2/icons/Collection";
import Data from "@react-spectrum/s2/icons/Data";
import GlobeGrid from "@react-spectrum/s2/icons/GlobeGrid";
import Folder from "@react-spectrum/s2/icons/Folder";
import AppsAll from "@react-spectrum/s2/icons/AppsAll";
import DeviceLaptop from "@react-spectrum/s2/icons/DeviceLaptop";
import Apps from "@react-spectrum/s2/icons/Apps";
import Settings from "@react-spectrum/s2/icons/Settings";
import Play from "@react-spectrum/s2/icons/Play";
import Delete from "@react-spectrum/s2/icons/Delete";
import { useUIStore } from "@/stores/uiStore";

type Action = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: ComponentType<{ styles?: ReturnType<typeof iconStyle> }>;
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
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const actions = useMemo<Action[]>(() => {
    const go = (to: string, mode?: "docker" | "kubernetes" | "microvms") => () => {
      if (mode) setMode(mode);
      navigate({ to });
      onOpenChange(false);
    };
    return [
      { id: "dash", label: "Dashboard", hint: "Docker", group: "Navigate", icon: ViewGrid, run: go("/", "docker") },
      { id: "projects", label: "Projects", hint: "Compose", group: "Navigate", icon: Layers, run: go("/projects", "docker") },
      { id: "containers", label: "Containers", group: "Navigate", icon: Collection, run: go("/containers", "docker") },
      { id: "images", label: "Images", group: "Navigate", icon: Data, run: go("/images", "docker") },
      { id: "networks", label: "Networks", group: "Navigate", icon: GlobeGrid, run: go("/networks", "docker") },
      { id: "volumes", label: "Volumes", group: "Navigate", icon: Folder, run: go("/volumes", "docker") },
      { id: "k8s", label: "Kubernetes overview", group: "Navigate", icon: ViewGrid, run: go("/k8s", "kubernetes") },
      { id: "pods", label: "Pods", group: "Navigate", icon: AppsAll, run: go("/k8s/pods", "kubernetes") },
      { id: "deps", label: "Deployments", group: "Navigate", icon: DeviceLaptop, run: go("/k8s/deployments", "kubernetes") },
      { id: "helm", label: "Helm", group: "Navigate", icon: Apps, run: go("/k8s/helm", "kubernetes") },
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
        icon: Delete,
        run: () => {
          onOpenChange(false);
          onOpenPrune?.();
        },
      },
    ];
  }, [navigate, onOpenChange, onOpenPrune, onRunContainer, setMode]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        a.hint?.toLowerCase().includes(needle) ||
        a.group.toLowerCase().includes(needle),
    );
  }, [actions, q]);

  useEffect(() => {
    setActive(0);
  }, [q]);

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
              aria-label="Search pages and actions"
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
              placeholder="Search pages and actions…"
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
                    <Icon styles={iconStyle({ size: "S", color: "neutral" })} />
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
            </Text>
          </div>
        </CustomDialog>
      ) : null}
    </DialogContainer>
  );
}

/** Global ⌘K / Ctrl+K listener + palette host. */
export function CommandPaletteHost({
  onRunContainer,
  onOpenPrune,
}: {
  onRunContainer?: () => void;
  onOpenPrune?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      onRunContainer={onRunContainer}
      onOpenPrune={onOpenPrune}
    />
  );
}

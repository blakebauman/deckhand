import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  ActionButton,
  Badge,
  Button,
  Checkbox,
  CheckboxGroup,
  Content,
  DialogTrigger,
  Popover,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from "@react-spectrum/s2";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConsolePanel } from "@/components/ConsolePanel";
import { ContainerMonitor } from "@/components/ContainerMonitor";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { ExecTerminal } from "@/components/ExecTerminal";
import { ListEmpty, ListItem, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { containerName, shortId } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import Filter from "@react-spectrum/s2/icons/Filter";
import { iconStyle, style } from "@react-spectrum/s2/style" with { type: "macro" };

import { copyText } from "@/routes/shared";

type ContainerTab = "monitor" | "logs" | "exec" | "inspect";

export function ContainersPage() {
  const qc = useQueryClient();
  const openRunSheet = useUIStore((s) => s.openRunSheet);
  const pendingContainerId = useUIStore((s) => s.pendingContainerId);
  const setPendingContainerId = useUIStore((s) => s.setPendingContainerId);
  const showStoppedContainers = useUIStore((s) => s.showStoppedContainers);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [tab, setTab] = useState<ContainerTab>("monitor");
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const list = useQuery({ queryKey: ["containers"], queryFn: () => api.containers(true), refetchInterval: 4000 });
  const detail = useQuery({
    queryKey: ["container", selected],
    queryFn: () => api.container(selected!),
    enabled: !!selected,
  });

  useEffect(() => {
    if (!pendingContainerId) return;
    setSelected(pendingContainerId);
    setPendingContainerId(undefined);
  }, [pendingContainerId, setPendingContainerId]);

  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of list.data || []) {
      if (c.state) set.add(c.state);
    }
    return [...set].sort().map((s) => ({ value: s, label: s }));
  }, [list.data]);

  const filtered = useMemo(() => {
    const items = list.data || [];
    const needle = q.toLowerCase();
    return items.filter((c) => {
      if (!showStoppedContainers && c.state !== "running" && stateFilter.length === 0) return false;
      if (stateFilter.length && !stateFilter.includes(c.state)) return false;
      if (!needle) return true;
      return (
        containerName(c.names).toLowerCase().includes(needle) ||
        c.image?.toLowerCase().includes(needle) ||
        c.id?.toLowerCase().includes(needle)
      );
    });
  }, [list.data, q, stateFilter, showStoppedContainers]);

  const selectedRow = filtered.find((c) => c.id === selected);
  const running = selectedRow?.state === "running" || detail.data?.State?.Running === true;

  const selectedIds = Object.entries(checked)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const act = async (fn: () => Promise<unknown>, ok = "Done") => {
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["containers"] });
      toast.success(ok);
    } catch (e: any) {
      toast.error("Action failed", { description: e?.message || String(e) });
    }
  };

  const tabs: { id: ContainerTab; label: string }[] = [
    { id: "monitor", label: "Monitor" },
    { id: "logs", label: "Logs" },
    { id: "exec", label: "Exec" },
    { id: "inspect", label: "Inspect" },
  ];

  return (
    <div className={style({ display: "flex", height: "full", minHeight: 0, gap: 24 })}>
      <ListPane
        title="Containers"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q || stateFilter.length ? "No matches" : "No containers"}
            description={
              q || stateFilter.length
                ? "Try another name, image, ID, or clear state filters."
                : "Nothing on this engine yet. Pull an image or deploy a Compose project."
            }
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search containers" }}
        actions={
          <div className={style({ display: "flex", alignItems: "center", gap: 8 })} data-no-drag>
            <DialogTrigger>
              <ActionButton isQuiet aria-label="Filter by container state">
                <Filter styles={iconStyle({ size: "S" })} />
              </ActionButton>
              <Popover>
                <Content>
                  <div className={style({ display: "flex", flexDirection: "column", gap: 8, minWidth: 224, padding: 12 })}>
                    <div className={style({ font: "body-xs", color: "neutral-subdued" })}>States</div>
                    <CheckboxGroup aria-label="Filter by state" value={stateFilter} onChange={setStateFilter}>
                      {stateOptions.map((opt) => (
                        <Checkbox key={opt.value} value={opt.value}>
                          {opt.label}
                        </Checkbox>
                      ))}
                    </CheckboxGroup>
                  </div>
                </Content>
              </Popover>
            </DialogTrigger>
            {selectedIds.length > 0 ? (
              <>
                <Tip label="Stop all selected containers">
                  <Button
                    size="S"
                    variant="secondary"
                    onPress={() =>
                      act(() => api.bulkContainers(selectedIds, "stop"), "Containers stopped").then(() =>
                        setChecked({}),
                      )
                    }
                  >
                    Stop ({selectedIds.length})
                  </Button>
                </Tip>
                <Tip label="Force-remove selected containers">
                  <Button size="S" variant="negative" onPress={() => setConfirmBulk(true)}>
                    Remove
                  </Button>
                </Tip>
              </>
            ) : (
              <Tip label="Create and start a container from an image">
                <Button size="S" onPress={() => openRunSheet()}>
                  Run
                </Button>
              </Tip>
            )}
          </div>
        }
      >
        {filtered.map((c) => (
          <RowMenu
            key={c.id}
            items={[
              { id: "open", label: "Open", onAction: () => setSelected(c.id) },
              { id: "start", label: "Start", onAction: () => void act(() => api.startContainer(c.id), "Started") },
              { id: "stop", label: "Stop", onAction: () => void act(() => api.stopContainer(c.id), "Stopped") },
              {
                id: "restart",
                label: "Restart",
                onAction: () => void act(() => api.restartContainer(c.id), "Restarted"),
              },
              { id: "sep-1", label: "", onAction: () => {} },
              { id: "copy-id", label: "Copy ID", onAction: () => void copyText(c.id) },
              { id: "copy-name", label: "Copy name", onAction: () => void copyText(containerName(c.names)) },
              { id: "sep-2", label: "", onAction: () => {} },
              {
                id: "remove",
                label: "Remove…",
                onAction: () => {
                  setSelected(c.id);
                  setConfirmRemove(true);
                },
                destructive: true,
              },
            ]}
            suffix={
              <>
                {c.gpu ? <StatusBadge tone="accent">GPU</StatusBadge> : null}
                <StatusBadge tone={c.state === "running" ? "success" : "muted"}>{c.state}</StatusBadge>
              </>
            }
          >
            <div className={style({ display: "flex", alignItems: "center", gap: 4, width: "full", minWidth: 0 })}>
              <div
                className={style({ paddingStart: 4, flexShrink: 0 })}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Checkbox
                  aria-label={`Select ${containerName(c.names)}`}
                  isSelected={!!checked[c.id]}
                  onChange={(v) => setChecked((prev) => ({ ...prev, [c.id]: v }))}
                />
              </div>
              <div className={style({ flexGrow: 1, minWidth: 0 })}>
                <ListItem active={selected === c.id} onClick={() => setSelected(c.id)}>
                  <div
                    className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}
                    title={containerName(c.names)}
                  >
                    {containerName(c.names)}
                  </div>
                  <div
                    className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, marginTop: 2 })}
                    title={c.image}
                  >
                    {c.image}
                  </div>
                </ListItem>
              </div>
            </div>
          </RowMenu>
        ))}
      </ListPane>
      <DetailPane
        selectionKey={selected}
        empty={
          <DetailEmpty
            title="Select a container"
            description="Monitor metrics, stream logs, and run exec commands for a container on this engine."
            action={
              <Button size="S" onPress={() => openRunSheet()}>
                Run container
              </Button>
            }
          />
        }
        header={
          <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
            <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minWidth: 0 })}>
              <DetailHeading>
                {containerName(detail.data?.Name ? [detail.data.Name] : selectedRow?.names)}
              </DetailHeading>
              <span title={`Full ID: ${selected}`}>
                <Badge variant="neutral" size="S">
                  {shortId(selected!)}
                </Badge>
              </span>
              <CopyButton value={selected || ""} label="Copy ID" iconOnly />
              <StatusBadge tone={running ? "success" : "muted"}>
                {running ? "running" : selectedRow?.state || "—"}
              </StatusBadge>
              {selectedRow?.gpu ||
              (detail.data?.HostConfig?.DeviceRequests?.length ?? 0) > 0 ? (
                <StatusBadge tone="accent">GPU</StatusBadge>
              ) : null}
            </div>
            <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
              <Button size="S" onPress={() => act(() => api.startContainer(selected!), "Started")}>
                Start
              </Button>
              <Button size="S" variant="secondary" onPress={() => act(() => api.stopContainer(selected!), "Stopped")}>
                Stop
              </Button>
              <Button
                size="S"
                variant="secondary"
                fillStyle="outline"
                onPress={() => act(() => api.restartContainer(selected!), "Restarted")}
              >
                Restart
              </Button>
              <Button size="S" variant="negative" onPress={() => setConfirmRemove(true)}>
                Remove
              </Button>
            </div>
          </div>
        }
      >
        <Tabs
          aria-label="Container details"
          selectedKey={tab}
          onSelectionChange={(k) => setTab(String(k) as ContainerTab)}
        >
          <TabList>
            {tabs.map((t) => (
              <Tab key={t.id} id={t.id}>
                {t.label}
              </Tab>
            ))}
          </TabList>
          <TabPanel id="monitor">
            <div className={style({ marginTop: 12 })}>
              <ContainerMonitor containerId={selected!} running={!!running} />
            </div>
          </TabPanel>
          <TabPanel id="logs">
            <div className={style({ marginTop: 12 })}>
              <ConsolePanel
                key={`${selected}-logs`}
                url={api.containerLogsUrl(selected!, true)}
                title="Container logs"
              />
            </div>
          </TabPanel>
          <TabPanel id="exec">
            <div className={style({ marginTop: 12 })}>
              <ExecTerminal
                key={selected!}
                wsUrl={api.containerExecWsUrl(selected!)}
                title="Container shell"
              />
            </div>
          </TabPanel>
          <TabPanel id="inspect">
            <div className={style({ marginTop: 12, position: "relative" })}>
              <div className={style({ position: "absolute", top: 12, insetEnd: 12, zIndex: 10 })}>
                <CopyButton value={JSON.stringify(detail.data || {}, null, 2)} label="Copy JSON" />
              </div>
              <pre
                className={style({
                  backgroundColor: "layer-1",
                  borderRadius: "xl",
                  padding: 16,
                  paddingTop: 48,
                  font: "code-xs",
                  maxHeight: "100%",
                  overflow: "auto",
                })}
              >
                {JSON.stringify(detail.data || {}, null, 2)}
              </pre>
            </div>
          </TabPanel>
        </Tabs>
      </DetailPane>

      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title="Remove containers"
        description={`Remove ${selectedIds.length} selected container${selectedIds.length === 1 ? "" : "s"}? This cannot be undone.`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          await act(() => api.bulkContainers(selectedIds, "remove"), "Containers removed");
          setChecked({});
        }}
      />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove container"
        description="Force-remove this container and its anonymous volumes?"
        confirmLabel="Remove"
        destructive
        onConfirm={() => act(() => api.removeContainer(selected!, true), "Container removed")}
      />
    </div>
  );
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  ActionButton,
  ActionMenu,
  Button,
  Checkbox,
  CheckboxGroup,
  Content,
  DialogTrigger,
  MenuItem,
  MenuSection,
  Popover,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
} from "@react-spectrum/s2";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CodeBlock } from "@/components/CodeBlock";
import { ConsolePanel } from "@/components/ConsolePanel";
import { ContainerMonitor } from "@/components/ContainerMonitor";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { ExecTerminal } from "@/components/ExecTerminal";
import { InspectFields, LabelChips } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { containerBrowseUrl, openExternalUrl } from "@/lib/openUrl";
import { containerName, formatPublishedPorts, shortId } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { Filter } from "lucide-react";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { lucideProps } from "@/components/Icon";

import { copyText } from "@/routes/shared";

type ContainerTab = "monitor" | "logs" | "exec" | "inspect";

function primaryNetwork(detail: any): string | undefined {
  const networks = detail?.NetworkSettings?.Networks;
  if (!networks || typeof networks !== "object") return undefined;
  const names = Object.keys(networks);
  if (!names.length) return undefined;
  const first = networks[names[0]];
  const ip = first?.IPAddress;
  return ip ? `${names[0]} · ${ip}` : names[0];
}

function commandLine(detail: any): string | undefined {
  const cfg = detail?.Config;
  if (!cfg) return undefined;
  const entry = Array.isArray(cfg.Entrypoint) ? cfg.Entrypoint.join(" ") : cfg.Entrypoint;
  const cmd = Array.isArray(cfg.Cmd) ? cfg.Cmd.join(" ") : cfg.Cmd;
  const parts = [entry, cmd].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

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
  const [showRaw, setShowRaw] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const list = useQuery({ queryKey: ["containers"], queryFn: () => api.containers(true), refetchInterval: 4000 });
  const detail = useQuery({
    queryKey: ["container", selected],
    queryFn: () => api.container(selected!),
    enabled: !!selected,
  });
  const domains = useQuery({ queryKey: ["domains"], queryFn: api.domainsStatus, staleTime: 30_000 });

  useEffect(() => {
    if (!pendingContainerId) return;
    setSelected(pendingContainerId);
    setPendingContainerId(undefined);
  }, [pendingContainerId, setPendingContainerId]);

  useEffect(() => {
    setShowRaw(false);
    setShowAllLabels(false);
    setTab("monitor");
  }, [selected]);

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
        c.id?.toLowerCase().includes(needle) ||
        c.status?.toLowerCase().includes(needle)
      );
    });
  }, [list.data, q, stateFilter, showStoppedContainers]);

  const selectedRow = filtered.find((c) => c.id === selected) || (list.data || []).find((c) => c.id === selected);
  const running = selectedRow?.state === "running" || detail.data?.State?.Running === true;
  const displayName = containerName(detail.data?.Name ? [detail.data.Name] : selectedRow?.names);
  const portSummary = formatPublishedPorts(selectedRow?.ports);
  const image = selectedRow?.image || detail.data?.Config?.Image || "—";
  const hasGpu =
    !!selectedRow?.gpu || (detail.data?.HostConfig?.DeviceRequests?.length ?? 0) > 0;
  const allLabels = (detail.data?.Config?.Labels || selectedRow?.labels || {}) as Record<string, string>;
  const composeProject = allLabels["com.docker.compose.project"];
  const composeService = allLabels["com.docker.compose.service"];

  const selectedIds = Object.entries(checked)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const stoppedHidden =
    !showStoppedContainers &&
    !q &&
    stateFilter.length === 0 &&
    (list.data || []).length > 0 &&
    filtered.length === 0;

  const act = async (fn: () => Promise<unknown>, ok = "Done") => {
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["containers"] });
      if (selected) qc.invalidateQueries({ queryKey: ["container", selected] });
      toast.success(ok);
    } catch (e: any) {
      toast.error("Action failed", { description: e?.message || String(e) });
    }
  };

  const openInBrowser = () => {
    if (!selected) return;
    const url = containerBrowseUrl({
      name: displayName,
      ports: selectedRow?.ports,
      labels: selectedRow?.labels || detail.data?.Config?.Labels,
      domainsEnabled: !!domains.data?.enabled,
      domainHttpPort: domains.data?.addr?.split(":").pop(),
    });
    if (!url) {
      toast.error("No published port", {
        description: "Publish a port or enable Domains in Settings",
      });
      return;
    }
    void openExternalUrl(url).then(
      () => toast.success("Opened browser", { description: url }),
      (e: any) => toast.error("Open failed", { description: e?.message }),
    );
  };

  const tabs: { id: ContainerTab; label: string }[] = [
    { id: "monitor", label: "Monitor" },
    { id: "logs", label: "Logs" },
    { id: "exec", label: "Exec" },
    { id: "inspect", label: "Inspect" },
  ];

  const emptyTitle = q || stateFilter.length ? "No matches" : stoppedHidden ? "Stopped containers hidden" : "No containers";
  const emptyDescription = q || stateFilter.length
    ? "Try another name, image, ID, or clear state filters."
    : stoppedHidden
      ? "Turn on “Show stopped containers” in Settings, or clear filters to see exited ones."
      : "Nothing on this engine yet. Pull an image or deploy a Compose project.";

  return (
    <div className={style({ display: "flex", height: "full", minHeight: 0, minWidth: 0, width: "full", gap: 24 })}>
      <ListPane
        title="Containers"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={emptyTitle}
            description={emptyDescription}
            action={
              stoppedHidden ? undefined : (
                <Button size="S" onPress={() => openRunSheet()}>
                  Run container
                </Button>
              )
            }
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search containers" }}
        actions={
          <div className={style({ display: "flex", alignItems: "center", gap: 8 })} data-no-drag>
            <DialogTrigger>
              <ActionButton isQuiet aria-label="Filter by container state">
                <Filter {...lucideProps("S")} />
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
                    fillStyle="outline"
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
                  <Button size="S" variant="negative" fillStyle="outline" onPress={() => setConfirmBulk(true)}>
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
        {filtered.map((c) => {
          const ports = formatPublishedPorts(c.ports);
          const subtitle = [c.image, ports].filter(Boolean).join(" · ");
          return (
            <RowMenu
              key={c.id}
              active={selected === c.id}
              onSelect={() => setSelected(c.id)}
              leading={
                <Checkbox
                  aria-label={`Select ${containerName(c.names)}`}
                  isSelected={!!checked[c.id]}
                  onChange={(v) => setChecked((prev) => ({ ...prev, [c.id]: v }))}
                />
              }
              items={[
                { id: "open", label: "Open", onAction: () => setSelected(c.id) },
                {
                  id: "start",
                  label: "Start",
                  onAction: () => void act(() => api.startContainer(c.id), "Started"),
                },
                {
                  id: "stop",
                  label: "Stop",
                  onAction: () => void act(() => api.stopContainer(c.id), "Stopped"),
                },
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
              <div
                className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}
                title={containerName(c.names)}
              >
                {containerName(c.names)}
              </div>
              <div
                className={style({ font: "body-xs", color: "neutral-subdued", truncate: true })}
                title={[c.status, subtitle].filter(Boolean).join(" · ")}
              >
                {subtitle || c.status || "—"}
              </div>
            </RowMenu>
          );
        })}
      </ListPane>
      <DetailPane
        selectionKey={selected}
        empty={
          <DetailEmpty
            title="Select a container"
            description="Monitor metrics, stream logs, and run exec — or start a new container on this engine."
            action={
              <Button size="S" onPress={() => openRunSheet()}>
                Run container
              </Button>
            }
          />
        }
      >
        {selected ? (
          <div className={style({ display: "flex", flexDirection: "column", gap: 16, minHeight: 0, height: "full" })}>
            <div
              className={style({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                minWidth: 0,
              })}
            >
              <div className={style({ minWidth: 0, flexGrow: 1, display: "flex", flexDirection: "column", gap: 4 })}>
                <div className={style({ display: "flex", alignItems: "center", gap: 8, minWidth: 0 })}>
                  <DetailHeading>{displayName}</DetailHeading>
                  <StatusBadge tone={running ? "success" : "muted"}>
                    {running ? "running" : selectedRow?.state || "—"}
                  </StatusBadge>
                  {hasGpu ? <StatusBadge tone="accent">GPU</StatusBadge> : null}
                </div>
                <div
                  className={style({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                  })}
                >
                  <div
                    className={style({
                      display: "inline-flex",
                      flexShrink: 0,
                      alignItems: "center",
                      gap: 2,
                    })}
                  >
                    <span className={style({ font: "code-xs", color: "neutral-subdued" })}>
                      {shortId(selected)}
                    </span>
                    <CopyButton value={selected} label="Copy ID" iconOnly />
                  </div>
                  <span
                    className={style({
                      font: "code-xs",
                      color: "neutral-subdued",
                      truncate: true,
                      minWidth: 0,
                    })}
                    title={[selectedRow?.status, image, portSummary].filter(Boolean).join(" · ")}
                  >
                    {[selectedRow?.status, portSummary].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
              <div
                className={style({
                  display: "flex",
                  flexShrink: 0,
                  alignItems: "center",
                  gap: 8,
                })}
              >
                {running ? (
                  <Button
                    size="S"
                    variant="secondary"
                    onPress={() => act(() => api.stopContainer(selected), "Stopped")}
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="S"
                    variant="accent"
                    onPress={() => act(() => api.startContainer(selected), "Started")}
                  >
                    Start
                  </Button>
                )}
                {running ? (
                  <Tip
                    label={
                      domains.data?.enabled
                        ? "Open via *.deckhand.local or published port"
                        : "Open first published port on localhost"
                    }
                  >
                    <Button size="S" variant="secondary" fillStyle="outline" onPress={openInBrowser}>
                      Open
                    </Button>
                  </Tip>
                ) : null}
                <ActionMenu aria-label="More container actions" isQuiet align="end" size="S">
                  <MenuSection>
                    <MenuItem
                      id="restart"
                      textValue="Restart"
                      isDisabled={!running}
                      onAction={() => void act(() => api.restartContainer(selected), "Restarted")}
                    >
                      <Text slot="label">Restart</Text>
                    </MenuItem>
                    <MenuItem
                      id="debug"
                      textValue="Debug shell"
                      onAction={() => {
                        void (async () => {
                          try {
                            const res = await api.debugContainer(selected);
                            await qc.invalidateQueries({ queryKey: ["containers"] });
                            setSelected(res.id);
                            setTab("exec");
                            toast.success("Debug shell ready", {
                              description: shortId(res.id),
                            });
                          } catch (e: any) {
                            toast.error("Debug shell failed", {
                              description: e?.message || String(e),
                            });
                          }
                        })();
                      }}
                    >
                      <Text slot="label">Debug shell</Text>
                    </MenuItem>
                  </MenuSection>
                  <MenuSection>
                    <MenuItem id="remove" textValue="Remove" onAction={() => setConfirmRemove(true)}>
                      <Text slot="label" styles={style({ color: "negative" })}>
                        Remove…
                      </Text>
                    </MenuItem>
                  </MenuSection>
                </ActionMenu>
              </div>
            </div>

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
                  <ContainerMonitor containerId={selected} running={!!running} />
                </div>
              </TabPanel>
              <TabPanel id="logs">
                <div className={style({ marginTop: 12 })}>
                  <ConsolePanel
                    key={`${selected}-logs`}
                    url={api.containerLogsUrl(selected, true)}
                    title="Container logs"
                  />
                </div>
              </TabPanel>
              <TabPanel id="exec">
                <div className={style({ marginTop: 12 })}>
                  <ExecTerminal
                    key={selected}
                    wsUrl={api.containerExecWsUrl(selected)}
                    title="Container shell"
                  />
                </div>
              </TabPanel>
              <TabPanel id="inspect">
                <div className={style({ marginTop: 12, display: "flex", flexDirection: "column", gap: 16 })}>
                  <InspectFields
                    rows={[
                      { label: "Image", value: image, mono: true, copy: image !== "—" ? image : undefined },
                      { label: "Ports", value: portSummary || undefined, mono: true },
                      { label: "Network", value: primaryNetwork(detail.data), mono: true },
                      {
                        label: "Compose",
                        value: composeProject
                          ? `${composeProject}${composeService ? ` / ${composeService}` : ""}`
                          : undefined,
                      },
                      { label: "Command", value: commandLine(detail.data), mono: true },
                      {
                        label: "Restart",
                        value: detail.data?.HostConfig?.RestartPolicy?.Name,
                      },
                      { label: "Created", value: detail.data?.Created },
                    ]}
                  />

                  {(detail.data?.Mounts || []).length > 0 ? (
                    <div className={style({ display: "flex", flexDirection: "column", gap: 8 })}>
                      <div
                        className={style({
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 8,
                        })}
                      >
                        <div className={style({ font: "title-sm" })}>Mounts</div>
                        <div className={style({ font: "body-xs", color: "neutral-subdued" })}>
                          {(detail.data.Mounts as any[]).length}
                        </div>
                      </div>
                      <div className={style({ display: "flex", flexDirection: "column", gap: 4 })}>
                        {(detail.data.Mounts as any[]).map((m, i) => (
                          <div
                            key={`${m.Source || m.Name || ""}-${m.Destination || m.Target || ""}-${i}`}
                            className={style({
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                              paddingX: 12,
                              paddingY: 8,
                              borderRadius: "lg",
                              backgroundColor: "gray-100",
                              minWidth: 0,
                            })}
                          >
                            <div
                              className={style({
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: 8,
                              })}
                            >
                              <StatusBadge tone="muted">{m.Type || "mount"}</StatusBadge>
                              {m.RW === false || m.Mode === "ro" ? (
                                <StatusBadge tone="muted">ro</StatusBadge>
                              ) : null}
                              <span className={style({ font: "code-xs", truncate: true, minWidth: 0 })}>
                                {m.Source || m.Name || "—"}
                              </span>
                            </div>
                            <div className={style({ font: "code-xs", color: "neutral-subdued", truncate: true })}>
                              → {m.Destination || m.Target || "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 })}>
                    {Object.keys(allLabels).length > 0 ? (
                      <Button
                        size="S"
                        variant="secondary"
                        fillStyle="outline"
                        onPress={() => setShowAllLabels((v) => !v)}
                      >
                        {showAllLabels ? "Hide labels" : `Labels (${Object.keys(allLabels).length})`}
                      </Button>
                    ) : null}
                    <Button size="S" variant="secondary" fillStyle="outline" onPress={() => setShowRaw((v) => !v)}>
                      {showRaw ? "Hide JSON" : "Inspect JSON"}
                    </Button>
                  </div>
                  {showAllLabels ? <LabelChips labels={allLabels} /> : null}
                  {showRaw ? (
                    <CodeBlock
                      title="Inspect"
                      meta="docker inspect"
                      value={JSON.stringify(detail.data || {}, null, 2)}
                      empty="No inspect data"
                    />
                  ) : null}
                </div>
              </TabPanel>
            </Tabs>
          </div>
        ) : null}
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
        description={`Force-remove “${displayName}” and its anonymous volumes?`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => act(() => api.removeContainer(selected!, true), "Container removed")}
      />
    </div>
  );
}

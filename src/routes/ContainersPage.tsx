import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CodeBlock } from "@/components/CodeBlock";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConsolePanel } from "@/components/ConsolePanel";
import { ContainerMonitor } from "@/components/ContainerMonitor";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { ExecTerminalLazy } from "@/components/ExecTerminalLazy";
import { lucideProps } from "@/components/Icon";
import { InspectFields, LabelChips } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import { RowMenu } from "@/components/RowMenu";
import { StatusBadge } from "@/components/StatusBadge";
import { Tip } from "@/components/Tip";
import { toast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { containerBrowseUrl, openExternalUrl } from "@/lib/openUrl";
import { containerName, formatPublishedPorts, shortId } from "@/lib/utils";
import { copyText } from "@/routes/shared";
import { useUIStore } from "@/stores/uiStore";

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
  const list = useQuery({
    queryKey: ["containers"],
    queryFn: () => api.containers(true),
    refetchInterval: 4000,
  });
  const detail = useQuery({
    queryKey: ["container", selected],
    queryFn: () => api.container(selected!),
    enabled: !!selected,
  });
  const domains = useQuery({
    queryKey: ["domains"],
    queryFn: api.domainsStatus,
    staleTime: 30_000,
  });

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

  const selectedRow =
    filtered.find((c) => c.id === selected) || (list.data || []).find((c) => c.id === selected);
  const running = selectedRow?.state === "running" || detail.data?.State?.Running === true;
  const displayName = containerName(detail.data?.Name ? [detail.data.Name] : selectedRow?.names);
  const portSummary = formatPublishedPorts(selectedRow?.ports);
  const image = selectedRow?.image || detail.data?.Config?.Image || "—";
  const hasGpu = !!selectedRow?.gpu || (detail.data?.HostConfig?.DeviceRequests?.length ?? 0) > 0;
  const allLabels = (detail.data?.Config?.Labels || selectedRow?.labels || {}) as Record<
    string,
    string
  >;
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

  const emptyTitle =
    q || stateFilter.length
      ? "No matches"
      : stoppedHidden
        ? "Stopped containers hidden"
        : "No containers";
  const emptyDescription =
    q || stateFilter.length
      ? "Try another name, image, ID, or clear state filters."
      : stoppedHidden
        ? "Turn on “Show stopped containers” in Settings, or clear filters to see exited ones."
        : "Nothing on this engine yet. Pull an image or deploy a Compose project.";

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 gap-5">
      <ListPane
        title="Containers"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={emptyTitle}
            description={emptyDescription}
            action={
              stoppedHidden ? undefined : (
                <Button size="sm" onClick={() => openRunSheet()}>
                  Run container
                </Button>
              )
            }
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search containers" }}
        actions={
          <div className="flex items-center gap-2" data-no-drag>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Filter by container state"
                    className={stateFilter.length ? "bg-muted text-foreground" : undefined}
                  >
                    <Filter {...lucideProps("S")} />
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-56 gap-2 p-3">
                <div className="text-xs font-medium text-muted-foreground">States</div>
                <div className="flex flex-col gap-2" role="group" aria-label="Filter by state">
                  {stateOptions.map((opt) => {
                    const id = `state-${opt.value}`;
                    const checked = stateFilter.includes(opt.value);
                    return (
                      <div key={opt.value} className="flex items-center gap-2">
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(next) => {
                            setStateFilter((prev) => {
                              if (next)
                                return prev.includes(opt.value) ? prev : [...prev, opt.value];
                              return prev.filter((s) => s !== opt.value);
                            });
                          }}
                        />
                        <Label
                          htmlFor={id}
                          className="cursor-pointer text-sm font-normal capitalize"
                        >
                          {opt.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                {stateFilter.length > 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-xs"
                    onClick={() => setStateFilter([])}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </PopoverContent>
            </Popover>
            {selectedIds.length > 0 ? (
              <>
                <Tip label="Stop all selected containers">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      act(() => api.bulkContainers(selectedIds, "stop"), "Containers stopped").then(
                        () => setChecked({}),
                      )
                    }
                  >
                    {`Stop (${selectedIds.length})`}
                  </Button>
                </Tip>
                <Tip label="Force-remove selected containers">
                  <Button size="sm" variant="destructive" onClick={() => setConfirmBulk(true)}>
                    Remove
                  </Button>
                </Tip>
              </>
            ) : (
              <Tip label="Create and start a container from an image">
                <Button size="sm" onClick={() => openRunSheet()}>
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
                  checked={!!checked[c.id]}
                  onCheckedChange={(v) => setChecked((prev) => ({ ...prev, [c.id]: v }))}
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
                {
                  id: "copy-name",
                  label: "Copy name",
                  onAction: () => void copyText(containerName(c.names)),
                },
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
                  <StatusBadge tone={c.state === "running" ? "success" : "muted"}>
                    {c.state}
                  </StatusBadge>
                </>
              }
            >
              <div className="min-w-0 truncate text-sm font-medium" title={containerName(c.names)}>
                {containerName(c.names)}
              </div>
              <div
                className="truncate text-xs text-muted-foreground"
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
              <Button size="sm" onClick={() => openRunSheet()}>
                Run container
              </Button>
            }
          />
        }
      >
        {selected ? (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <DetailHeading>{displayName}</DetailHeading>
                  <StatusBadge tone={running ? "success" : "muted"}>
                    {running ? "running" : selectedRow?.state || "—"}
                  </StatusBadge>
                  {hasGpu ? <StatusBadge tone="accent">GPU</StatusBadge> : null}
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="inline-flex shrink-0 items-center gap-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      {shortId(selected)}
                    </span>
                    <CopyButton value={selected} label="Copy ID" iconOnly />
                  </div>
                  <span
                    className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                    title={[selectedRow?.status, image, portSummary].filter(Boolean).join(" · ")}
                  >
                    {[selectedRow?.status, portSummary].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {running ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => act(() => api.stopContainer(selected), "Stopped")}
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => act(() => api.startContainer(selected), "Started")}
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
                    <Button size="sm" variant="secondary" onClick={openInBrowser}>
                      Open
                    </Button>
                  </Tip>
                ) : null}
                <MoreActionsMenu label="More container actions">
                  <DropdownMenuItem
                    disabled={!running}
                    onClick={() => void act(() => api.restartContainer(selected), "Restarted")}
                  >
                    Restart
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
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
                    Debug shell
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemove(true)}>
                    Remove…
                  </DropdownMenuItem>
                </MoreActionsMenu>
              </div>
            </div>

            <Tabs
              aria-label="Container details"
              value={tab}
              onValueChange={(k) => setTab(String(k) as ContainerTab)}
              className="min-h-0 flex-1"
            >
              <TabsList>
                {tabs.map((t) => (
                  <TabsTrigger key={t.id} value={t.id}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="monitor" className="mt-3 min-h-0">
                <ContainerMonitor containerId={selected} running={!!running} />
              </TabsContent>
              <TabsContent value="logs" className="mt-3 min-h-0">
                <ConsolePanel
                  key={`${selected}-logs`}
                  url={api.containerLogsUrl(selected, true)}
                  title="Container logs"
                />
              </TabsContent>
              <TabsContent value="exec" className="mt-3 min-h-0">
                <ExecTerminalLazy
                  key={selected}
                  wsUrl={api.containerExecWsUrl(selected)}
                  title="Container shell"
                />
              </TabsContent>
              <TabsContent value="inspect" className="mt-3">
                <div className="flex flex-col gap-4">
                  <InspectFields
                    rows={[
                      {
                        label: "Image",
                        value: image,
                        mono: true,
                        copy: image !== "—" ? image : undefined,
                      },
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
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between gap-2">
                        <div className="text-sm font-semibold">Mounts</div>
                        <div className="text-xs text-muted-foreground">
                          {(detail.data.Mounts as any[]).length}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {(detail.data.Mounts as any[]).map((m, i) => (
                          <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: index only disambiguates an otherwise-composite key
                            key={`${m.Source || m.Name || ""}-${m.Destination || m.Target || ""}-${i}`}
                            className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge tone="muted">{m.Type || "mount"}</StatusBadge>
                              {m.RW === false || m.Mode === "ro" ? (
                                <StatusBadge tone="muted">ro</StatusBadge>
                              ) : null}
                              <span className="min-w-0 truncate font-mono text-xs">
                                {m.Source || m.Name || "—"}
                              </span>
                            </div>
                            <div className="truncate font-mono text-xs text-muted-foreground">
                              → {m.Destination || m.Target || "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {Object.keys(allLabels).length > 0 ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowAllLabels((v) => !v)}
                      >
                        {showAllLabels
                          ? "Hide labels"
                          : `Labels (${Object.keys(allLabels).length})`}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="secondary" onClick={() => setShowRaw((v) => !v)}>
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
              </TabsContent>
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

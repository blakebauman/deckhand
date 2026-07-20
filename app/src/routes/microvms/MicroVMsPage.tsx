import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button, NumberField, Tabs, TabList, Tab, TabPanel } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api, type MicroVM } from "@/lib/api";
import { CodeBlock } from "@/components/CodeBlock";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { GlassSheet } from "@/components/GlassSheet";
import { InspectFields } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { Field } from "@/components/spectrum/Field";
import { RowMenu } from "@/components/spectrum/RowMenu";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { Tip } from "@/components/spectrum/Tip";
import { shortId } from "@/lib/utils";
import { copyText } from "@/routes/shared";

function stateTone(state?: string): "success" | "muted" | "warn" | "destructive" | "accent" {
  switch ((state || "").toLowerCase()) {
    case "running":
      return "success";
    case "created":
      return "accent";
    case "stopped":
    case "exited":
      return "muted";
    case "error":
    case "failed":
      return "destructive";
    default:
      return "muted";
  }
}

function isRunning(state?: string) {
  return (state || "").toLowerCase() === "running";
}

export function MicroVMsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["vms"], queryFn: api.listVMs, refetchInterval: 5000 });
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"inspect" | "logs">("inspect");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    kernel: "",
    rootfs: "",
    vcpu: 1,
    memoryMb: 512,
  });

  const filtered = useMemo(() => {
    const items = list.data || [];
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter(
      (vm) =>
        vm.name?.toLowerCase().includes(needle) ||
        vm.id?.toLowerCase().includes(needle) ||
        vm.state?.toLowerCase().includes(needle) ||
        vm.kernel?.toLowerCase().includes(needle) ||
        vm.rootfs?.toLowerCase().includes(needle),
    );
  }, [list.data, q]);

  const row = filtered.find((vm) => vm.id === selected) || (list.data || []).find((vm) => vm.id === selected);

  useEffect(() => {
    if (selected && list.data && !list.data.some((vm) => vm.id === selected)) {
      setSelected(null);
    }
  }, [list.data, selected]);

  const logs = useQuery({
    queryKey: ["vm-logs", selected],
    queryFn: () => api.vmLogs(selected!),
    enabled: !!selected && tab === "logs",
    refetchInterval: tab === "logs" && selected && isRunning(row?.state) ? 4000 : false,
  });

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["vms"] });
      toast.success(ok);
    } catch (e: any) {
      toast.error("Action failed", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const createVM = async () => {
    const name = form.name.trim();
    const kernel = form.kernel.trim();
    const rootfs = form.rootfs.trim();
    if (!kernel || !rootfs) return;
    setCreating(true);
    try {
      const vm = await api.createVM({
        name,
        kernel,
        rootfs,
        vcpu: form.vcpu || 1,
        memoryMb: form.memoryMb || 512,
      });
      setSelected(vm.id);
      setForm({ name: "", kernel: "", rootfs: "", vcpu: 1, memoryMb: 512 });
      setCreateOpen(false);
      await qc.invalidateQueries({ queryKey: ["vms"] });
      toast.success("MicroVM created", { description: vm.name });
    } catch (e: any) {
      toast.error("Create failed", { description: e?.message });
    } finally {
      setCreating(false);
    }
  };

  const rowItems = (vm: MicroVM) => [
    { id: "open", label: "Open", onAction: () => setSelected(vm.id) },
    { id: "copy-id", label: "Copy ID", onAction: () => void copyText(vm.id) },
    { id: "copy-name", label: "Copy name", onAction: () => void copyText(vm.name) },
    { id: "sep-1", label: "", onAction: () => {} },
    {
      id: "start",
      label: "Start",
      onAction: () => void act(() => api.startVM(vm.id), "Started"),
    },
    {
      id: "stop",
      label: "Stop",
      onAction: () => void act(() => api.stopVM(vm.id), "Stopped"),
    },
    {
      id: "logs",
      label: "View logs",
      onAction: () => {
        setSelected(vm.id);
        setTab("logs");
      },
    },
    { id: "sep-2", label: "", onAction: () => {} },
    {
      id: "destroy",
      label: "Destroy…",
      onAction: () => {
        setSelected(vm.id);
        setConfirmDestroy(true);
      },
      destructive: true,
    },
  ];

  const running = isRunning(row?.state);

  return (
    <div className={style({ display: "flex", height: "full", minHeight: 0, minWidth: 0, width: "full", gap: 24 })}>
      <ListPane
        title="VMs"
        loading={list.isLoading}
        empty={
          <ListEmpty
            title={q ? "No matches" : "No microVMs"}
            description={
              q
                ? "Try another name, state, or path."
                : "Create a Firecracker VM with a kernel and rootfs path."
            }
            action={
              q ? undefined : (
                <Button size="S" onPress={() => setCreateOpen(true)}>
                  Create
                </Button>
              )
            }
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search VMs" }}
        actions={
          <Tip label="Create a Firecracker microVM">
            <Button size="S" onPress={() => setCreateOpen(true)}>
              Create
            </Button>
          </Tip>
        }
      >
        {filtered.map((vm) => (
          <RowMenu
            key={vm.id}
            active={selected === vm.id}
            onSelect={() => setSelected(vm.id)}
            items={rowItems(vm)}
            suffix={<StatusBadge tone={stateTone(vm.state)}>{vm.state || "—"}</StatusBadge>}
          >
            <div className={style({ font: "body", fontWeight: "medium", truncate: true, minWidth: 0 })}>
              {vm.name}
            </div>
            <div className={style({ font: "body-xs", color: "neutral-subdued", truncate: true, minWidth: 0 })}>
              {vm.vcpu} vCPU · {vm.memoryMb} MB
              {vm.id ? ` · ${shortId(vm.id)}` : ""}
            </div>
          </RowMenu>
        ))}
      </ListPane>

      <DetailPane
        selectionKey={selected}
        empty={
          <DetailEmpty
            title="Select a microVM"
            description="Inspect kernel and rootfs, start or stop the VM, or read console logs."
            action={
              <Button size="S" variant="secondary" onPress={() => setCreateOpen(true)}>
                Create microVM
              </Button>
            }
          />
        }
      >
        {row ? (
          <div className={style({ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 8 })}>
            <div
              className={style({
                display: "flex",
                flexWrap: "wrap",
                alignItems: "start",
                justifyContent: "space-between",
                gap: 12,
              })}
            >
              <div className={style({ minWidth: 0, flexGrow: 1, display: "flex", flexDirection: "column", gap: 8 })}>
                <div className={style({ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" })}>
                  <DetailHeading>{row.name}</DetailHeading>
                  <StatusBadge tone={stateTone(row.state)}>{row.state || "—"}</StatusBadge>
                </div>
                <div className={style({ font: "code-xs", color: "neutral-subdued" })}>
                  {shortId(row.id)}
                  {` · ${row.vcpu} vCPU · ${row.memoryMb} MB`}
                </div>
              </div>
              <div className={style({ display: "flex", flexWrap: "wrap", gap: 8 })}>
                <Button
                  size="S"
                  variant="secondary"
                  fillStyle="outline"
                  isDisabled={busy || running}
                  onPress={() => void act(() => api.startVM(row.id), "Started")}
                >
                  Start
                </Button>
                <Button
                  size="S"
                  variant="secondary"
                  fillStyle="outline"
                  isDisabled={busy || !running}
                  onPress={() => void act(() => api.stopVM(row.id), "Stopped")}
                >
                  Stop
                </Button>
                <CopyButton value={row.id} label="Copy ID" />
                <Button
                  size="S"
                  variant="negative"
                  fillStyle="outline"
                  isDisabled={busy}
                  onPress={() => setConfirmDestroy(true)}
                >
                  Destroy
                </Button>
              </div>
            </div>

            <Tabs
              aria-label="MicroVM detail"
              selectedKey={tab}
              onSelectionChange={(k) => setTab(k as "inspect" | "logs")}
            >
              <TabList>
                <Tab id="inspect">Inspect</Tab>
                <Tab id="logs">Logs</Tab>
              </TabList>
              <TabPanel id="inspect">
                <div className={style({ display: "flex", flexDirection: "column", gap: 16, paddingTop: 16 })}>
                  <InspectFields
                    rows={[
                      { label: "State", value: row.state },
                      { label: "vCPU", value: String(row.vcpu) },
                      { label: "Memory", value: `${row.memoryMb} MB` },
                      { label: "Kernel", value: row.kernel, mono: true, copy: row.kernel },
                      { label: "Rootfs", value: row.rootfs, mono: true, copy: row.rootfs },
                      { label: "ID", value: row.id, mono: true, copy: row.id },
                    ]}
                  />
                </div>
              </TabPanel>
              <TabPanel id="logs">
                <div className={style({ display: "flex", flexDirection: "column", gap: 12, paddingTop: 16 })}>
                  <div className={style({ display: "flex", justifyContent: "end" })}>
                    <Button
                      size="S"
                      variant="secondary"
                      fillStyle="outline"
                      isPending={logs.isFetching}
                      onPress={() => void logs.refetch()}
                    >
                      Refresh
                    </Button>
                  </div>
                  {logs.isError ? (
                    <div className={style({ font: "body-sm", color: "neutral-subdued" })}>
                      {(logs.error as Error)?.message || "Failed to load logs"}
                    </div>
                  ) : (
                    <CodeBlock
                      title="Console"
                      meta="firecracker"
                      value={logs.data?.output || (logs.isLoading ? "Loading…" : "No log output yet.")}
                      maxHeight="420px"
                    />
                  )}
                </div>
              </TabPanel>
            </Tabs>
          </div>
        ) : null}
      </DetailPane>

      <GlassSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create microVM"
        description="Firecracker needs a kernel and rootfs on the host. Paths are validated by the sidecar."
        size="md"
        footer={
          <>
            <Button variant="secondary" onPress={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              isDisabled={!form.kernel.trim() || !form.rootfs.trim() || creating}
              isPending={creating}
              onPress={() => void createVM()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
          <Field
            value={form.name}
            onChange={(name) => setForm((f) => ({ ...f, name }))}
            placeholder="name (optional)"
            aria-label="VM name"
          />
          <Field
            value={form.kernel}
            onChange={(kernel) => setForm((f) => ({ ...f, kernel }))}
            placeholder="/path/to/vmlinux"
            aria-label="Kernel path"
          />
          <Field
            value={form.rootfs}
            onChange={(rootfs) => setForm((f) => ({ ...f, rootfs }))}
            placeholder="/path/to/rootfs.ext4"
            aria-label="Rootfs path"
          />
          <div
            className={style({
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            })}
          >
            <NumberField
              label="vCPU"
              value={form.vcpu}
              onChange={(vcpu) => setForm((f) => ({ ...f, vcpu: vcpu || 1 }))}
              minValue={1}
            />
            <NumberField
              label="Memory (MB)"
              value={form.memoryMb}
              onChange={(memoryMb) => setForm((f) => ({ ...f, memoryMb: memoryMb || 512 }))}
              minValue={128}
            />
          </div>
        </div>
      </GlassSheet>

      <ConfirmDialog
        open={confirmDestroy}
        onOpenChange={setConfirmDestroy}
        title="Destroy microVM"
        description={`Destroy “${row?.name || selected}”? This removes the VM definition and local Firecracker state.`}
        confirmLabel="Destroy"
        destructive
        onConfirm={async () => {
          if (!selected) return;
          try {
            await api.destroyVM(selected);
            toast.success("MicroVM destroyed");
            setSelected(null);
            await qc.invalidateQueries({ queryKey: ["vms"] });
          } catch (e: any) {
            toast.error("Destroy failed", { description: e?.message });
            throw e;
          }
        }}
      />
    </div>
  );
}

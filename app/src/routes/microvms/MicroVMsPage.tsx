import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api, type MicroVM } from "@/lib/api";
import { CodeBlock } from "@/components/CodeBlock";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { DetailEmpty, DetailHeading, DetailPane } from "@/components/DetailPane";
import { GlassSheet } from "@/components/GlassSheet";
import { InspectFields } from "@/components/InspectFields";
import { ListEmpty, ListPane } from "@/components/ListPane";
import { toast } from "@/components/Toaster";
import { RowMenu } from "@/components/RowMenu";
import { StatusBadge } from "@/components/StatusBadge";
import { Tip } from "@/components/Tip";
import { shortId } from "@/lib/utils";
import { copyText } from "@/routes/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


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
    <div className="flex h-full min-h-0 w-full min-w-0 gap-5">
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
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Create
                </Button>
              )
            }
          />
        }
        search={{ value: q, onChange: setQ, placeholder: "Search VMs" }}
        actions={
          <Tip label="Create a Firecracker microVM">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
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
            <div className="min-w-0 truncate text-sm font-medium">{vm.name}</div>
            <div className="min-w-0 truncate text-xs text-muted-foreground">
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
              <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
                Create microVM
              </Button>
            }
          />
        }
      >
        {row ? (
          <div className="flex flex-col gap-4 pb-2">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <DetailHeading>{row.name}</DetailHeading>
                  <StatusBadge tone={stateTone(row.state)}>{row.state || "—"}</StatusBadge>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {shortId(row.id)}
                  {` · ${row.vcpu} vCPU · ${row.memoryMb} MB`}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || running}
                  onClick={() => void act(() => api.startVM(row.id), "Started")}
                >
                  Start
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy || !running}
                  onClick={() => void act(() => api.stopVM(row.id), "Stopped")}
                >
                  Stop
                </Button>
                <CopyButton value={row.id} label="Copy ID" />
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setConfirmDestroy(true)}
                >
                  Destroy
                </Button>
              </div>
            </div>

            <Tabs
              aria-label="MicroVM detail"
              value={tab}
              onValueChange={(k) => setTab(k as "inspect" | "logs")}
            >
              <TabsList>
                <TabsTrigger value="inspect">Inspect</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              <TabsContent value="inspect" className="mt-3">
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
              </TabsContent>
              <TabsContent value="logs" className="mt-3">
                <div className="flex flex-col gap-3">
                  <div className="flex justify-end">
                    <Button size="sm" variant="secondary" onClick={() => void logs.refetch()}>
                      Refresh
                    </Button>
                  </div>
                  {logs.isError ? (
                    <div className="text-sm text-muted-foreground">
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
              </TabsContent>
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
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={!form.kernel.trim() || !form.rootfs.trim() || creating}
              onClick={() => void createVM()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vm-name">Name</Label>
            <Input
              id="vm-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="optional"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vm-kernel">Kernel</Label>
            <Input
              id="vm-kernel"
              value={form.kernel}
              onChange={(e) => setForm((f) => ({ ...f, kernel: e.target.value }))}
              placeholder="/path/to/vmlinux"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vm-rootfs">Rootfs</Label>
            <Input
              id="vm-rootfs"
              value={form.rootfs}
              onChange={(e) => setForm((f) => ({ ...f, rootfs: e.target.value }))}
              placeholder="/path/to/rootfs.ext4"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vm-vcpu">vCPU</Label>
              <Input
                id="vm-vcpu"
                type="number"
                min={1}
                value={form.vcpu}
                onChange={(e) => setForm((f) => ({ ...f, vcpu: Number(e.target.value) || 1 }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vm-memory">Memory (MB)</Label>
              <Input
                id="vm-memory"
                type="number"
                min={128}
                value={form.memoryMb}
                onChange={(e) => setForm((f) => ({ ...f, memoryMb: Number(e.target.value) || 512 }))}
              />
            </div>
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

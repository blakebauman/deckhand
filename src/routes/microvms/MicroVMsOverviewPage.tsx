import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { EmptyState, MetricTile, PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/StatusBadge";
import { HelpHint } from "@/components/HelpHint";
import { Button } from "@/components/ui/button";

export function MicroVMsOverviewPage() {
  const navigate = useNavigate();
  const status = useQuery({ queryKey: ["status"], queryFn: api.status });
  const runtimes = useQuery({ queryKey: ["runtimes"], queryFn: api.runtimes });
  const vms = useQuery({ queryKey: ["vms"], queryFn: api.listVMs, refetchInterval: 5000 });

  const available =
    status.data?.firecracker.available ||
    runtimes.data?.some((r) => r.name === "firecracker" && r.available);
  const list = vms.data || [];
  const running = list.filter((vm) => (vm.state || "").toLowerCase() === "running").length;
  const created = list.filter((vm) => (vm.state || "").toLowerCase() === "created").length;

  return (
    <PageShell
      title="MicroVMs"
      description="Firecracker microVMs when KVM and the firecracker binary are available on Linux."
      actions={
        available ? (
          <Button size="sm" onClick={() => navigate({ to: "/microvms/vms" })}>
            Open VMs
          </Button>
        ) : null
      }
    >
      {!available ? (
        <EmptyState
          title="Firecracker unavailable"
          description="Needs Linux with KVM and a firecracker binary on PATH. This mode stays hidden on macOS."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="success">Firecracker ready</StatusBadge>
            <span className="text-xs text-muted-foreground">
              Create and manage microVMs from the VMs tab
            </span>
            <HelpHint label="Kernel and rootfs paths must exist on the host where the sidecar runs." />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              label="VMs"
              value={list.length}
              hint="defined"
              tip="All Firecracker microVMs known to the sidecar"
              onClick={() => navigate({ to: "/microvms/vms" })}
            />
            <MetricTile
              label="Running"
              value={running}
              hint="active"
              tip="MicroVMs with a live Firecracker process"
              onClick={() => navigate({ to: "/microvms/vms" })}
            />
            <MetricTile
              label="Created"
              value={created}
              hint="not started"
              tip="Defined but not currently running"
              onClick={() => navigate({ to: "/microvms/vms" })}
            />
          </div>

          {list.length === 0 ? (
            <EmptyState
              title="No microVMs yet"
              description="Create one with a kernel and rootfs path — useful for isolated workloads on Linux hosts with KVM."
              action={
                <Button size="sm" onClick={() => navigate({ to: "/microvms/vms" })}>
                  Create microVM
                </Button>
              }
            />
          ) : null}
        </div>
      )}
    </PageShell>
  );
}

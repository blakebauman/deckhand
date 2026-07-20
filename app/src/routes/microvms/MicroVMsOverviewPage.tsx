import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { EmptyState, MetricTile, PageShell } from "@/components/PageShell";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { HelpHint } from "@/components/HelpHint";

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
          <Button size="S" onPress={() => navigate({ to: "/microvms/vms" })}>
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
        <div className={style({ display: "flex", flexDirection: "column", gap: 24 })}>
          <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 })}>
            <StatusBadge tone="success">Firecracker ready</StatusBadge>
            <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>
              Create and manage microVMs from the VMs tab
            </Text>
            <HelpHint label="Kernel and rootfs paths must exist on the host where the sidecar runs." />
          </div>

          <div
            className={style({
              display: "grid",
              gridTemplateColumns: {
                default: "1fr",
                sm: "1fr 1fr",
                md: "1fr 1fr 1fr",
              },
              gap: 12,
            })}
          >
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
                <Button size="S" onPress={() => navigate({ to: "/microvms/vms" })}>
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

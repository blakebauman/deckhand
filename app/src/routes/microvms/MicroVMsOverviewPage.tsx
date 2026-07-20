import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { EmptyState, PageShell } from "@/components/PageShell";

export function MicroVMsOverviewPage() {
  const runtimes = useQuery({ queryKey: ["runtimes"], queryFn: api.runtimes });
  const available = runtimes.data?.some((r) => r.name === "firecracker" && r.available);
  return (
    <PageShell title="MicroVMs" description="Firecracker microVMs when KVM is available on Linux.">
      {available ? (
        <EmptyState title="Firecracker ready" description="Create and manage microVMs from the VMs tab." />
      ) : (
        <EmptyState
          title="Firecracker unavailable"
          description="Needs Linux with KVM and a firecracker binary on PATH. This mode stays hidden on macOS."
        />
      )}
    </PageShell>
  );
}

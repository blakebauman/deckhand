import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { DiskUsagePanel } from "@/components/DiskUsagePanel";
import { GpuPanel } from "@/components/GpuPanel";
import { HelpHint } from "@/components/HelpHint";
import { EmptyState, PageShell } from "@/components/PageShell";
import { ChartPanel, RunningAreaChart } from "@/components/charts/ChartsPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { useDockerReconnect } from "@/hooks/useDockerReconnect";
import { useMetricsStore } from "@/stores/metricsStore";
import { Button } from "@/components/ui/button";

const jumpLinks = [
  { label: "Containers", to: "/containers" as const },
  { label: "Images", to: "/images" as const },
  { label: "Volumes", to: "/volumes" as const },
  { label: "Networks", to: "/networks" as const },
  { label: "Projects", to: "/projects" as const },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { reconnect, pending: reconnecting } = useDockerReconnect();
  const dash = useQuery({
    queryKey: ["docker-dashboard"],
    queryFn: api.dockerDashboard,
    refetchInterval: 5000,
  });
  const status = useQuery({ queryKey: ["status"], queryFn: api.status });
  const info = useQuery({ queryKey: ["docker-info"], queryFn: api.dockerInfo, retry: false });
  const contexts = useQuery({ queryKey: ["docker-contexts"], queryFn: api.dockerContexts, retry: false });
  const pushRunning = useMetricsStore((s) => s.pushRunning);
  const clearRunning = useMetricsStore((s) => s.clearRunning);
  const runningHistory = useMetricsStore((s) => s.runningHistory);
  const engineContext = contexts.data?.current;
  const dockerOffline = status.isSuccess && !status.data?.docker.connected;
  const statusLoading = status.isLoading || status.isPending;

  useEffect(() => {
    clearRunning();
  }, [engineContext, clearRunning]);

  useEffect(() => {
    if (dash.data?.containersRunning == null) return;
    pushRunning(dash.data.containersRunning);
  }, [dash.dataUpdatedAt, dash.data?.containersRunning, pushRunning]);

  const running = dash.data?.containersRunning ?? 0;
  const totalContainers = dash.data?.containers ?? 0;
  const paused = dash.data?.containersPaused ?? 0;
  const stopped = Math.max(totalContainers - running - paused, 0);
  const engineName =
    engineContext ||
    (info.data as { Name?: string } | undefined)?.Name ||
    "local engine";

  const runningSeries = useMemo(() => {
    if (runningHistory.length > 0) {
      return runningHistory.map(({ i, t, running: r }) => ({ i, t, running: r }));
    }
    return [{ i: 0, t: "now", running }];
  }, [runningHistory, running]);

  return (
    <PageShell
      title="Dashboard"
      description="What’s running on this engine — jump to resources when you need the lists."
    >
      {statusLoading ? (
        <EmptyState title="Checking engine…" description="Waiting for sidecar status." />
      ) : dockerOffline ? (
        <EmptyState
          title="Docker is offline"
          description={
            status.data?.docker.error ||
            "Start Docker Desktop, Colima, or another engine, then retry attach."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="default" onClick={() => void reconnect()}>
                Retry connection
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/settings" })}>
                Open Settings
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="m-0 text-xl font-semibold tracking-tight tabular-nums">
                    {running} running
                  </span>
                  <StatusBadge tone="success">Connected</StatusBadge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {engineName}
                  {` · ${totalContainers} total`}
                  {stopped ? ` · ${stopped} stopped` : ""}
                  {paused ? ` · ${paused} paused` : ""}
                  {dash.data?.images != null ? ` · ${dash.data.images} images` : ""}
                  {dash.data?.volumes != null ? ` · ${dash.data.volumes} volumes` : ""}
                  {dash.data?.networks != null ? ` · ${dash.data.networks} networks` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {jumpLinks.map((link) => (
                  <Button
                    key={link.to}
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate({ to: link.to })}
                  >
                    {link.label}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          <ChartPanel
            title="Running containers"
            hint="Hover for time · ~5s samples"
            height={200}
          >
            <RunningAreaChart data={runningSeries} />
          </ChartPanel>

          <div className="grid items-start gap-5 md:grid-cols-2">
            <section className="flex min-w-0 flex-col gap-0 overflow-hidden rounded-2xl bg-card">
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <span className="m-0 text-xs font-medium text-muted-foreground">GPUs</span>
                <HelpHint label="Detected via nvidia-smi and the Docker NVIDIA runtime" />
              </div>
              <div className="min-w-0 px-5 pb-4">
                <GpuPanel />
              </div>
            </section>

            <section className="flex min-w-0 flex-col gap-0 overflow-hidden rounded-2xl bg-card">
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <span className="m-0 text-xs font-medium text-muted-foreground">Engine disk</span>
                <HelpHint label="From docker system df — reclaim unused layers, stopped containers, and idle cache" />
              </div>
              <div className="min-w-0 px-5 pb-4">
                <DiskUsagePanel compact hideTitle />
              </div>
            </section>
          </div>
        </div>
      )}
    </PageShell>
  );
}

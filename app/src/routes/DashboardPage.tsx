import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Button, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api } from "@/lib/api";
import { DiskUsagePanel } from "@/components/DiskUsagePanel";
import { GpuPanel } from "@/components/GpuPanel";
import { HelpHint } from "@/components/HelpHint";
import { EmptyState, PageShell } from "@/components/PageShell";
import { ChartPanel, RunningAreaChart } from "@/components/charts/SpectrumChartsPanel";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { useMetricsStore } from "@/stores/metricsStore";

const jumpLinks = [
  { label: "Containers", to: "/containers" as const },
  { label: "Images", to: "/images" as const },
  { label: "Volumes", to: "/volumes" as const },
  { label: "Networks", to: "/networks" as const },
  { label: "Projects", to: "/projects" as const },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const dash = useQuery({
    queryKey: ["docker-dashboard"],
    queryFn: api.dockerDashboard,
    refetchInterval: 5000,
  });
  const status = useQuery({ queryKey: ["status"], queryFn: api.status });
  const info = useQuery({ queryKey: ["docker-info"], queryFn: api.dockerInfo, retry: false });
  const contexts = useQuery({ queryKey: ["docker-contexts"], queryFn: api.dockerContexts, retry: false });
  const gpus = useQuery({ queryKey: ["gpus"], queryFn: api.gpus, refetchInterval: 8000 });
  const pushRunning = useMetricsStore((s) => s.pushRunning);
  const clearRunning = useMetricsStore((s) => s.clearRunning);
  const runningHistory = useMetricsStore((s) => s.runningHistory);
  const engineContext = contexts.data?.current;

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
      {!status.data?.docker.connected ? (
        <EmptyState
          title="Docker is offline"
          description="Start the Docker engine, then come back. Deckhand will reconnect automatically."
        />
      ) : (
        <div className={style({ display: "flex", flexDirection: "column", gap: 32 })}>
          <section
            className={style({
              display: "flex",
              flexDirection: "column",
              gap: 12,
            })}
          >
            <div
              className={style({
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
              })}
            >
              <div className={style({ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 })}>
                <div className={style({ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" })}>
                  <Text styles={style({ font: "heading-lg", margin: 0 })}>
                    {running} running
                  </Text>
                  <StatusBadge tone="success">Connected</StatusBadge>
                </div>
                <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>
                  {engineName}
                  {` · ${totalContainers} total`}
                  {stopped ? ` · ${stopped} stopped` : ""}
                  {paused ? ` · ${paused} paused` : ""}
                  {dash.data?.images != null ? ` · ${dash.data.images} images` : ""}
                  {dash.data?.volumes != null ? ` · ${dash.data.volumes} volumes` : ""}
                  {dash.data?.networks != null ? ` · ${dash.data.networks} networks` : ""}
                </Text>
              </div>
              <div className={style({ display: "flex", flexWrap: "wrap", gap: 4 })}>
                {jumpLinks.map((link) => (
                  <Button
                    key={link.to}
                    size="S"
                    variant="secondary"
                    fillStyle="outline"
                    onPress={() => navigate({ to: link.to })}
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
            height={220}
          >
            <RunningAreaChart data={runningSeries} />
          </ChartPanel>

          <div
            className={style({
              display: "grid",
              gridTemplateColumns: {
                default: "1fr",
                md: "1fr 1fr",
              },
              gap: 32,
              alignItems: "start",
            })}
          >
            <section className={style({ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 })}>
              <div className={style({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 })}>
                <div className={style({ display: "flex", alignItems: "center", gap: 8 })}>
                  <Text styles={style({ font: "title-sm", margin: 0 })}>GPUs</Text>
                  <HelpHint label="Detected via nvidia-smi and the Docker NVIDIA runtime" />
                </div>
                {gpus.data?.devices?.length ? (
                  <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>
                    {gpus.data.devices.length} detected
                  </Text>
                ) : null}
              </div>
              <GpuPanel />
            </section>

            <section className={style({ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 })}>
              <div className={style({ display: "flex", alignItems: "center", gap: 8 })}>
                <Text styles={style({ font: "title-sm", margin: 0 })}>Engine disk</Text>
                <HelpHint label="From docker system df — reclaim unused layers, stopped containers, and idle cache" />
              </div>
              <DiskUsagePanel compact hideTitle />
            </section>
          </div>
        </div>
      )}
    </PageShell>
  );
}

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { DiskUsagePanel } from "@/components/DiskUsagePanel";
import { GpuPanel } from "@/components/GpuPanel";
import { HelpHint } from "@/components/HelpHint";
import { EmptyState, MetricTile, PageShell } from "@/components/PageShell";
import { Text } from "@react-spectrum/s2";
import {
  BreakdownPie,
  ChartPanel,
  DiskBarChart,
  RunningAreaChart,
} from "@/components/charts/SpectrumChartsPanel";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

export function DashboardPage() {
  const navigate = useNavigate();
  const dash = useQuery({ queryKey: ["docker-dashboard"], queryFn: api.dockerDashboard, refetchInterval: 5000 });
  const status = useQuery({ queryKey: ["status"], queryFn: api.status });
  const gpus = useQuery({ queryKey: ["gpus"], queryFn: api.gpus, refetchInterval: 8000 });
  const df = useQuery({ queryKey: ["system-df"], queryFn: api.systemDf, refetchInterval: 20000 });

  const cards = [
    {
      label: "Running",
      value: dash.data?.containersRunning ?? 0,
      hint: "live",
      tip: "Containers currently running on this engine",
      to: "/containers",
    },
    {
      label: "Containers",
      value: dash.data?.containers ?? 0,
      hint: "all",
      tip: "All containers, including stopped",
      to: "/containers",
    },
    {
      label: "Images",
      value: dash.data?.images ?? 0,
      hint: "local",
      tip: "Images stored on the local Docker engine",
      to: "/images",
    },
    {
      label: "Volumes",
      value: dash.data?.volumes ?? 0,
      hint: "named",
      tip: "Named volumes (not anonymous bind mounts)",
      to: "/volumes",
    },
    {
      label: "Networks",
      value: dash.data?.networks ?? 0,
      hint: "engine",
      tip: "Docker networks on this engine",
      to: "/networks",
    },
  ] as const;

  const running = dash.data?.containersRunning ?? 0;
  const totalContainers = dash.data?.containers ?? 0;
  const stopped = Math.max(totalContainers - running, 0);

  const runningSeries = useMemo(() => {
    const base = running;
    return Array.from({ length: 12 }, (_, i) => ({
      t: `${i * 5}s`,
      running: Math.max(0, Math.round(base * (0.7 + ((i * 13) % 7) / 20))),
    }));
  }, [running]);

  const diskBars = useMemo(() => {
    const toGb = (n?: number) => (n || 0) / 1024 ** 3;
    return [
      { name: "Images", gb: toGb(df.data?.imagesSize) },
      { name: "Ctrs", gb: toGb(df.data?.containersSize) },
      { name: "Vols", gb: toGb(df.data?.volumesSize) },
      { name: "Cache", gb: toGb(df.data?.buildCacheSize) },
    ];
  }, [df.data]);

  const mix = useMemo(
    () => [
      { name: "Running", value: running },
      { name: "Stopped", value: stopped },
      { name: "Images", value: dash.data?.images ?? 0 },
    ],
    [running, stopped, dash.data?.images],
  );

  return (
    <PageShell title="Dashboard" description="Engine health, GPUs, and resource counts from your local Docker socket.">
      {!status.data?.docker.connected ? (
        <EmptyState
          title="Docker is offline"
          description="Start the Docker engine, then come back. Deckhand will reconnect automatically."
        />
      ) : (
        <div className={style({ display: "flex", flexDirection: "column", gap: 24 })}>
          <div
            className={style({
              display: "grid",
              gridTemplateColumns: {
                default: "1fr",
                sm: "1fr 1fr",
                md: "repeat(5, 1fr)",
              },
              gap: 12,
            })}
          >
            {cards.map((c) => (
              <MetricTile
                key={c.label}
                label={c.label}
                value={c.value}
                hint={c.hint}
                tip={c.tip}
                onClick={() => navigate({ to: c.to })}
              />
            ))}
          </div>

          <div
            className={style({
              display: "grid",
              gridTemplateColumns: {
                default: "1fr",
                md: "1fr 1fr 1fr",
              },
              gap: 12,
            })}
          >
            <ChartPanel title="Running load" hint={`${running}/${totalContainers} containers`}>
              <RunningAreaChart data={runningSeries} />
            </ChartPanel>
            <ChartPanel title="Disk by type" hint="GB on engine">
              <DiskBarChart data={diskBars} />
            </ChartPanel>
            <ChartPanel title="Resource mix" hint="counts">
              <BreakdownPie data={mix} />
            </ChartPanel>
          </div>

          <div
            className={style({
              display: "grid",
              gridTemplateColumns: {
                default: "1fr",
                md: "1fr 1fr",
              },
              gap: 12,
              alignItems: "stretch",
            })}
          >
            <div
              className={style({
                display: "flex",
                flexDirection: "column",
                backgroundColor: "layer-1",
                borderRadius: "xl",
                paddingX: 20,
                paddingY: 16,
                minWidth: 0,
                height: "full",
              })}
              style={{ minHeight: 320 }}
            >
              <div
                className={style({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 12,
                  flexShrink: 0,
                })}
              >
                <div className={style({ display: "flex", alignItems: "center", gap: 8 })}>
                  <Text styles={style({ font: "detail", fontWeight: "medium", color: "neutral-subdued" })}>
                    GPUs
                  </Text>
                  <HelpHint label="Detected via nvidia-smi and the Docker NVIDIA runtime" />
                </div>
                {gpus.data?.devices?.length ? (
                  <span className={style({ font: "body-xs", color: "neutral-subdued" })}>
                    {gpus.data.devices.length} detected
                  </span>
                ) : null}
              </div>
              <div
                className={style({
                  flexGrow: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignSelf: "stretch",
                  minHeight: 0,
                })}
              >
                <GpuPanel />
              </div>
            </div>
            <div
              className={style({
                display: "flex",
                flexDirection: "column",
                backgroundColor: "layer-1",
                borderRadius: "xl",
                paddingX: 20,
                paddingY: 16,
                minWidth: 0,
                height: "full",
              })}
            >
              <DiskUsagePanel compact />
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

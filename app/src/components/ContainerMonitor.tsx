import { useEffect, useState } from "react";
import { Badge, Heading, InlineAlert, Content, Text } from "@react-spectrum/s2";
import { style, iconStyle } from "@react-spectrum/s2/style" with { type: "macro" };
import Pause from "@react-spectrum/s2/icons/Pause";
import { api, type ContainerStats } from "@/lib/api";
import { LiveSparkline } from "@/components/charts/LiveSparkline";
import { MetricCard, WaveBars } from "@/components/charts/MetricChart";
import { useEasedNumber } from "@/hooks/useEasedSeries";
import { useLiveStats } from "@/hooks/useLiveStats";
import { formatBytes } from "@/lib/utils";

/** Live runtime metrics (docker stats / cgroup) — SVG sparklines, not Vega. */
export function ContainerMonitor({ containerId, running }: { containerId: string; running?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const { sampleLabel, hist, pushSample } = useLiveStats(!!running);
  // Match sparkline tip duration so headline spikes land with the chart.
  const cpuEased = useEasedNumber(sampleLabel?.cpu ?? 0, 280);
  const memEased = useEasedNumber(sampleLabel?.mem ?? 0, 280);
  const netEased = useEasedNumber(sampleLabel?.netRate ?? 0, 280);

  useEffect(() => {
    if (!containerId || !running) {
      setConnected(false);
      setError(running === false ? "Container is not running" : null);
      return;
    }

    const ac = new AbortController();
    setError(null);
    setConnected(false);
    let prevNet = 0;
    let skipFirstCpu = true;

    (async () => {
      try {
        const res = await fetch(api.containerStatsStreamUrl(containerId), { signal: ac.signal });
        if (!res.ok || !res.body) throw new Error(res.statusText || "stats stream failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const next = JSON.parse(trimmed) as ContainerStats;
              const netTotal = next.netRx + next.netTx;
              const delta = prevNet > 0 ? Math.max(0, netTotal - prevNet) : 0;
              prevNet = netTotal;
              pushSample({
                cpuPercent: next.cpuPercent,
                memoryPercent: next.memoryPercent,
                memoryUsage: next.memoryUsage,
                memoryLimit: next.memoryLimit,
                netRx: next.netRx,
                netTx: next.netTx,
                blockRead: next.blockRead,
                blockWrite: next.blockWrite,
                pids: next.pids,
                netDelta: delta,
                skipCpu: skipFirstCpu,
              });
              skipFirstCpu = false;
              setConnected(true);
            } catch {
              /* skip */
            }
          }
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e.message || "stats unavailable");
      }
    })();

    return () => ac.abort();
  }, [containerId, running, pushSample]);

  if (!running) {
    return (
      <div
        className={style({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          backgroundColor: "layer-1",
          borderRadius: "xl",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "gray-200",
          paddingX: 32,
          paddingY: 40,
          minHeight: 280,
          textAlign: "center",
        })}
      >
        <div
          className={style({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            size: 44,
            borderRadius: "full",
            backgroundColor: "gray-100",
          })}
        >
          <Pause styles={iconStyle({ size: "L", color: "neutral" })} />
        </div>
        <Text styles={style({ font: "title-sm" })}>Container stopped</Text>
        <Text styles={style({ font: "body-sm", color: "neutral-subdued", maxWidth: 320 })}>
          Start it to stream CPU, memory, network, and block I/O from cgroups.
        </Text>
      </div>
    );
  }

  if (error) {
    return (
      <InlineAlert variant="negative">
        <Heading>Stats unavailable</Heading>
        <Content>{error}</Content>
      </InlineAlert>
    );
  }

  if (!connected || !sampleLabel) {
    return (
      <div
        className={style({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: "layer-1",
          borderRadius: "xl",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "gray-200",
          paddingX: 24,
          paddingY: 32,
          minHeight: 280,
        })}
      >
        <WaveBars values={[0.2, 0.45, 0.3, 0.7, 0.4, 0.55, 0.85, 0.35, 0.5, 0.65, 0.4, 0.6]} max={1} />
        <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>
          Connecting to stats stream…
        </Text>
      </div>
    );
  }

  return (
    <div className={style({ display: "flex", flexDirection: "column", gap: 16 })}>
      <div className={style({ display: "flex", alignItems: "center", gap: 8 })}>
        <Badge variant="positive">Live</Badge>
        <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>
          Docker stats stream · updates ~1s
        </Text>
      </div>

      <div
        className={style({
          display: "grid",
          gridTemplateColumns: {
            default: "1fr",
            lg: "1fr 1fr",
          },
          gap: 12,
        })}
      >
        <MetricCard label="CPU" value={`${cpuEased.toFixed(1)}%`} hint="cgroup usage">
          <LiveSparkline values={hist.cpu} unit="%" label="CPU" tone="accent" />
        </MetricCard>
        <MetricCard
          label="Memory"
          value={`${memEased.toFixed(1)}%`}
          hint={`${formatBytes(sampleLabel.memUsage)} / ${formatBytes(sampleLabel.memLimit)}`}
        >
          <LiveSparkline values={hist.mem} unit="%" label="Memory" />
        </MetricCard>
      </div>

      <div
        className={style({
          display: "grid",
          gridTemplateColumns: {
            default: "1fr",
            lg: "1fr 1fr",
          },
          gap: 12,
        })}
      >
        <MetricCard
          label="Network"
          value={`${formatBytes(netEased)}/s`}
          hint={`${formatBytes(sampleLabel.netRx)} ↓ · ${formatBytes(sampleLabel.netTx)} ↑ total`}
        >
          <LiveSparkline
            values={hist.net}
            label="Throughput"
            height={72}
            formatValue={(n) => `${formatBytes(n)}/s`}
          />
        </MetricCard>

        <div
          className={style({
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            minWidth: 0,
          })}
        >
          <MetricCard
            label="Block I/O"
            value={`${formatBytes(sampleLabel.blockRead)} R`}
            hint={`${formatBytes(sampleLabel.blockWrite)} W`}
          />
          <MetricCard label="PIDs" value={String(sampleLabel.pids)} hint="processes" />
        </div>
      </div>
    </div>
  );
}

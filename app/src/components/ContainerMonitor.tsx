import { useEffect, useState } from "react";
import { InlineAlert, Heading, Content, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api, type ContainerStats } from "@/lib/api";
import { AreaChart, MetricCard, WaveBars } from "@/components/charts/MetricChart";
import { formatBytes } from "@/lib/utils";

const HISTORY = 48;

/** Live runtime metrics with charts (docker stats / cgroup). */
export function ContainerMonitor({ containerId, running }: { containerId: string; running?: boolean }) {
  const [sample, setSample] = useState<ContainerStats | null>(null);
  const [cpuHist, setCpuHist] = useState<number[]>([]);
  const [memHist, setMemHist] = useState<number[]>([]);
  const [netHist, setNetHist] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerId || !running) {
      setSample(null);
      setCpuHist([]);
      setMemHist([]);
      setNetHist([]);
      setError(running === false ? "Container is not running" : null);
      return;
    }

    const ac = new AbortController();
    setError(null);
    let prevNet = 0;

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
              setSample(next);
              setCpuHist((h) => [...h, next.cpuPercent].slice(-HISTORY));
              setMemHist((h) => [...h, next.memoryPercent].slice(-HISTORY));
              const netTotal = next.netRx + next.netTx;
              const delta = prevNet > 0 ? Math.max(0, netTotal - prevNet) : 0;
              prevNet = netTotal;
              setNetHist((h) => [...h, delta].slice(-HISTORY));
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
  }, [containerId, running]);

  if (!running) {
    return (
      <div
        className={style({
          backgroundColor: "layer-1",
          borderRadius: "xl",
          paddingX: 20,
          paddingY: 24,
        })}
      >
        <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>
          Start the container to stream CPU, memory, network, and block I/O metrics.
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

  if (!sample) {
    return (
      <div
        className={style({
          backgroundColor: "layer-1",
          borderRadius: "xl",
          display: "flex",
          height: 160,
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        <WaveBars values={[0.2, 0.5, 0.3, 0.8, 0.4, 0.6, 0.9, 0.3, 0.5, 0.7, 0.4, 0.6]} max={1} />
      </div>
    );
  }

  return (
    <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
      <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>
        Live Docker stats stream — CPU, memory, net, and block I/O from cgroups.
      </Text>
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
        <MetricCard label="CPU" value={`${sample.cpuPercent.toFixed(2)}%`} hint="total usage">
          <AreaChart values={cpuHist} />
          <div className={style({ marginTop: 8 })}>
            <WaveBars values={cpuHist} max={Math.max(100, ...cpuHist)} />
          </div>
        </MetricCard>
        <MetricCard
          label="Memory"
          value={`${sample.memoryPercent.toFixed(1)}%`}
          hint={`${formatBytes(sample.memoryUsage)} / ${formatBytes(sample.memoryLimit)}`}
        >
          <AreaChart values={memHist} max={100} />
          <div className={style({ marginTop: 8 })}>
            <WaveBars values={memHist} max={100} />
          </div>
        </MetricCard>
      </div>
      <div
        className={style({
          display: "grid",
          gridTemplateColumns: {
            default: "1fr",
            sm: "1fr 1fr",
            xl: "1fr 1fr 1fr",
          },
          gap: 12,
        })}
      >
        <MetricCard label="Net I/O" value={`${formatBytes(sample.netRx)} ↓`} hint={`${formatBytes(sample.netTx)} ↑`}>
          <WaveBars values={netHist} />
        </MetricCard>
        <MetricCard
          label="Block I/O"
          value={`${formatBytes(sample.blockRead)} R`}
          hint={`${formatBytes(sample.blockWrite)} W`}
        />
        <MetricCard label="PIDs" value={String(sample.pids)} hint="process count" />
      </div>
    </div>
  );
}

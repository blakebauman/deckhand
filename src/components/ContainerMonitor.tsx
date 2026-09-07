import { Loader2, Pause } from "lucide-react";
import { useEffect, useState } from "react";
import { LiveSparkline } from "@/components/charts/LiveSparkline";
import { MetricCard, WaveBars } from "@/components/charts/MetricChart";
import { lucideProps } from "@/components/Icon";
import { Badge } from "@/components/ui/badge";
import { useEasedNumber } from "@/hooks/useEasedSeries";
import { useLiveStats } from "@/hooks/useLiveStats";
import { api, type ContainerStats } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

/** Live runtime metrics (docker stats / cgroup) — SVG sparklines. */
export function ContainerMonitor({
  containerId,
  running,
}: {
  containerId: string;
  running?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const { sampleLabel, hist, pushSample } = useLiveStats(!!running);
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
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-2.5 rounded-2xl bg-card px-8 py-10 text-center">
        <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
          <Pause {...lucideProps("M")} className="text-muted-foreground" />
        </div>
        <span className="text-sm font-semibold">Container stopped</span>
        <span className="max-w-sm text-sm text-muted-foreground">
          Start it to stream CPU, memory, network, and block I/O from cgroups.
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-muted/60 px-4 py-3">
        <p className="m-0 text-sm font-semibold">Stats unavailable</p>
        <p className="m-0 mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!connected || !sampleLabel) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-3.5 rounded-2xl bg-card px-6 py-8 text-center">
        <WaveBars
          values={[0.2, 0.45, 0.3, 0.7, 0.4, 0.55, 0.85, 0.35, 0.5, 0.65, 0.4, 0.6]}
          max={1}
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Connecting to stats stream…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
          Live
        </Badge>
        <span className="text-xs text-muted-foreground">Docker stats stream · ~1s</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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

      <div className="grid gap-3 md:grid-cols-2">
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

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
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

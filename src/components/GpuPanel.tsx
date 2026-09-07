import { useQuery } from "@tanstack/react-query";
import { CloudOff, Loader2 } from "lucide-react";
import { RingGauge } from "@/components/charts/MetricChart";
import { HelpHint } from "@/components/HelpHint";
import { lucideProps } from "@/components/Icon";
import { Tip } from "@/components/Tip";
import { Badge } from "@/components/ui/badge";
import { api, type GPUStatus } from "@/lib/api";

export function GpuPanel() {
  const gpus = useQuery({ queryKey: ["gpus"], queryFn: api.gpus, refetchInterval: 4000 });

  if (gpus.isLoading) {
    return (
      <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center gap-2 text-center">
        <Loader2 aria-label="Probing GPUs" className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Probing GPUs…</span>
      </div>
    );
  }

  const data = gpus.data as GPUStatus | undefined;
  if (!data?.available && !data?.devices?.length) {
    return (
      <div className="flex min-h-[140px] flex-1 items-center justify-center py-2 text-center">
        <div className="flex max-w-sm flex-col items-center gap-2">
          <div className="mb-0.5 flex size-9 items-center justify-center rounded-full bg-muted">
            <CloudOff {...lucideProps("M")} className="text-muted-foreground" />
          </div>
          <h2 className="m-0 text-sm font-semibold">No GPU runtime detected</h2>
          <p className="m-0 text-sm text-muted-foreground">
            {data?.toolkitHint ||
              "Install NVIDIA drivers and the NVIDIA Container Toolkit, then expose GPUs with docker run --gpus."}
          </p>
        </div>
      </div>
    );
  }

  const runtimeTip = data.available
    ? data.runtime
      ? `Docker GPU runtime “${data.runtime}” is registered for --gpus`
      : "GPU tooling detected on this host"
    : "GPU toolkit detected but devices are unavailable";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {data.runtime ? `runtime: ${data.runtime}` : data.nvidiaSmi ? "nvidia-smi" : "GPU"}
        </Badge>
        <HelpHint label={runtimeTip} />
        <span className="text-xs text-muted-foreground">
          {data.devices.length} device{data.devices.length === 1 ? "" : "s"} · Docker GPU access
        </span>
      </div>
      <div className="grid gap-3">
        {data.devices.map((d) => {
          const memPct = d.memoryTotalMiB > 0 ? (d.memoryUsedMiB / d.memoryTotalMiB) * 100 : 0;
          return (
            <div key={d.uuid || d.index} className="rounded-2xl bg-muted/80 px-4 py-3.5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{d.name}</span>
                  <Tip label={d.uuid ? `Device UUID: ${d.uuid}` : `GPU index ${d.index}`}>
                    <span className="w-fit cursor-default font-mono text-xs text-muted-foreground">
                      GPU {d.index}
                      {d.uuid ? ` · ${d.uuid.slice(0, 18)}…` : ""}
                    </span>
                  </Tip>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary">{d.temperature}°C</Badge>
                  <HelpHint label="GPU temperature from nvidia-smi" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <RingGauge
                  value={d.utilization}
                  label="GPU util"
                  sub={`${d.utilization}% compute`}
                />
                <RingGauge
                  value={memPct}
                  label="VRAM"
                  sub={`${d.memoryUsedMiB} / ${d.memoryTotalMiB} MiB`}
                />
              </div>
            </div>
          );
        })}
      </div>
      {!data.devices.length && data.available ? (
        <span className="text-xs text-muted-foreground">
          NVIDIA runtime is registered, but nvidia-smi reported no devices. On macOS / remote Docker
          this is common — GPU passthrough needs a Linux host with the toolkit.
        </span>
      ) : null}
    </div>
  );
}

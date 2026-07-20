import { useQuery } from "@tanstack/react-query";
import {
  ActionButton,
  Badge,
  Content,
  Heading,
  IllustratedMessage,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import CloudStateError from "@react-spectrum/s2/illustrations/linear/CloudStateError";
import { api, type GPUStatus } from "@/lib/api";
import { HelpHint } from "@/components/HelpHint";
import { MetricCard, RingGauge, WaveBars } from "@/components/charts/MetricChart";

export function GpuPanel() {
  const gpus = useQuery({ queryKey: ["gpus"], queryFn: api.gpus, refetchInterval: 4000 });

  if (gpus.isLoading) {
    return <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>Probing GPUs…</Text>;
  }

  const data = gpus.data as GPUStatus | undefined;
  if (!data?.available && !data?.devices?.length) {
    return (
      <div
        className={style({
          flexGrow: 1,
          width: "full",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        })}
        style={{ minHeight: "100%" }}
      >
        <IllustratedMessage>
          <CloudStateError />
          <Heading>No GPU runtime detected</Heading>
          <Content>
            {data?.toolkitHint ||
              "Install NVIDIA drivers and the NVIDIA Container Toolkit, then expose GPUs with docker run --gpus."}
          </Content>
        </IllustratedMessage>
      </div>
    );
  }

  const runtimeTip = data.available
    ? data.runtime
      ? `Docker GPU runtime “${data.runtime}” is registered for --gpus`
      : "GPU tooling detected on this host"
    : "GPU toolkit detected but devices are unavailable";

  return (
    <div className={style({ display: "flex", flexDirection: "column", gap: 12 })}>
      <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 })}>
        <Badge variant={data.available ? "positive" : "notice"}>
          {data.runtime ? `runtime: ${data.runtime}` : data.nvidiaSmi ? "nvidia-smi" : "GPU"}
        </Badge>
        <HelpHint label={runtimeTip} />
        <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>
          {data.devices.length} device{data.devices.length === 1 ? "" : "s"} · Docker GPU access
        </Text>
      </div>
      <div
        className={style({
          display: "grid",
          gridTemplateColumns: {
            default: "1fr",
            md: "1fr 1fr",
          },
          gap: 12,
        })}
      >
        {data.devices.map((d) => {
          const memPct = d.memoryTotalMiB > 0 ? (d.memoryUsedMiB / d.memoryTotalMiB) * 100 : 0;
          return (
            <div
              key={d.uuid || d.index}
              className={style({
                backgroundColor: "layer-2",
                borderRadius: "xl",
                borderWidth: 0,
                paddingX: 20,
                paddingY: 16,
              })}
            >
              <div
                className={style({
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "start",
                  justifyContent: "space-between",
                  gap: 12,
                })}
              >
                <div>
                  <Text styles={style({ font: "ui", fontWeight: "bold" })}>{d.name}</Text>
                  <TooltipTrigger placement="bottom">
                    <ActionButton
                      isQuiet
                      aria-label={d.uuid ? `Device UUID: ${d.uuid}` : `GPU index ${d.index}`}
                    >
                      <Text
                        styles={style({
                          font: "code-xs",
                          color: "neutral-subdued",
                        })}
                      >
                        GPU {d.index}
                        {d.uuid ? ` · ${d.uuid.slice(0, 18)}…` : ""}
                      </Text>
                    </ActionButton>
                    <Tooltip>
                      {d.uuid ? `Device UUID: ${d.uuid}` : `GPU index ${d.index}`}
                    </Tooltip>
                  </TooltipTrigger>
                </div>
                <div className={style({ display: "flex", alignItems: "center", gap: 4 })}>
                  <Badge variant="neutral" fillStyle="subtle">
                    {d.temperature}°C
                  </Badge>
                  <HelpHint label="GPU temperature from nvidia-smi" />
                </div>
              </div>
              <div
                className={style({
                  display: "grid",
                  gridTemplateColumns: {
                    default: "1fr",
                    sm: "1fr 1fr",
                  },
                  gap: 12,
                })}
              >
                <div>
                  <RingGauge value={d.utilization} label="GPU util" sub={`${d.utilization}% compute`} />
                </div>
                <MetricCard
                  flat
                  label="VRAM"
                  value={`${memPct.toFixed(0)}%`}
                  hint={`${d.memoryUsedMiB} / ${d.memoryTotalMiB} MiB`}
                >
                  <WaveBars
                    values={[memPct * 0.7, memPct * 0.85, memPct, memPct * 0.9, memPct * 0.75, memPct]}
                    max={100}
                  />
                </MetricCard>
              </div>
            </div>
          );
        })}
      </div>
      {!data.devices.length && data.available ? (
        <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>
          NVIDIA runtime is registered, but nvidia-smi reported no devices. On macOS / remote Docker this is
          common — GPU passthrough needs a Linux host with the toolkit.
        </Text>
      ) : null}
    </div>
  );
}

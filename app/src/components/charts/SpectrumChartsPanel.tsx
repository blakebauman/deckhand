import { useEffect, useState } from "react";
import { Axis, Bar, Chart, ChartTooltip, Line } from "@spectrum-charts/react-spectrum-charts-s2";
import { Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useUIStore } from "@/stores/uiStore";

export function useChartColorScheme(): "light" | "dark" {
  const theme = useUIStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

function TooltipBody({ title, value }: { title: string; value: string }) {
  return (
    <div className={style({ display: "flex", flexDirection: "column", gap: 2, paddingX: 4, paddingY: 2 })}>
      <Text styles={style({ font: "detail-sm", color: "neutral-subdued" })}>{title}</Text>
      <Text styles={style({ font: "ui-sm", fontWeight: "medium" })}>{value}</Text>
    </div>
  );
}

export function ChartPanel({
  title,
  hint,
  children,
  height = 180,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div
      className={style({
        backgroundColor: "layer-1",
        borderRadius: "xl",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "gray-200",
        paddingX: 20,
        paddingY: 16,
        minWidth: 0,
      })}
    >
      <div
        className={style({
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        })}
      >
        <Text styles={style({ font: "detail", fontWeight: "medium", color: "neutral-subdued" })}>{title}</Text>
        {hint ? <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>{hint}</Text> : null}
      </div>
      <div style={{ width: "100%", height }}>{children}</div>
    </div>
  );
}

export function RunningAreaChart({
  data,
}: {
  data: { i: number; t: string; running: number }[];
}) {
  const colorScheme = useChartColorScheme();
  // Integer counts + ordinal X — monotone over time strings looked like fractional containers.
  const chartData = data.length
    ? data.map((d) => ({ i: d.i, t: d.t, running: Math.round(d.running) }))
    : [{ i: 0, t: "now", running: 0 }];
  return (
    <Chart data={chartData} height="100%" width="100%" colorScheme={colorScheme} padding={8}>
      {/* Hide sample-index ticks — time lives in the tooltip only. */}
      <Axis position="bottom" baseline hideDefaultLabels />
      <Axis position="left" grid numberFormat="d" tickMinStep={1} tickCountLimit={4} />
      <Line dimension="i" metric="running" gradient interpolate="step-after" scaleType="linear">
        <ChartTooltip>
          {(datum) => (
            <TooltipBody
              title={String(datum.t ?? "")}
              value={`${Math.round(Number(datum.running ?? 0))} running`}
            />
          )}
        </ChartTooltip>
      </Line>
    </Chart>
  );
}

export function DiskBarChart({ data }: { data: { name: string; gb: number }[] }) {
  const colorScheme = useChartColorScheme();
  const chartData = data.length ? data : [{ name: "—", gb: 0 }];
  return (
    <Chart data={chartData} height="100%" width="100%" colorScheme={colorScheme} padding={8}>
      <Axis position="bottom" baseline />
      <Axis position="left" grid />
      <Bar dimension="name" metric="gb">
        <ChartTooltip>
          {(datum) => (
            <TooltipBody
              title={String(datum.name ?? "")}
              value={`${Number(datum.gb ?? 0).toFixed(2)} GB`}
            />
          )}
        </ChartTooltip>
      </Bar>
    </Chart>
  );
}

/** Horizontal bar breakdown — Donut is typed under `/rc` but not shipped in the S2 package build. */
export function BreakdownPie({ data }: { data: { name: string; value: number }[] }) {
  const colorScheme = useChartColorScheme();
  const chartData = data.length ? data : [{ name: "Empty", value: 1 }];
  return (
    <Chart data={chartData} height="100%" width="100%" colorScheme={colorScheme} colors="s2Categorical6" padding={8}>
      <Axis position="left" baseline />
      <Axis position="bottom" grid />
      <Bar dimension="name" metric="value" orientation="horizontal" color="name">
        <ChartTooltip>
          {(datum) => (
            <TooltipBody
              title={String(datum.name ?? "")}
              value={Number(datum.value ?? 0).toLocaleString()}
            />
          )}
        </ChartTooltip>
      </Bar>
    </Chart>
  );
}

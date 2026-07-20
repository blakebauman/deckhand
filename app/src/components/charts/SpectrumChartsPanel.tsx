import { useEffect, useState } from "react";
import { Axis, Bar, Chart, Line } from "@spectrum-charts/react-spectrum-charts-s2";
import { Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useUIStore } from "@/stores/uiStore";

function useChartColorScheme(): "light" | "dark" {
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

export function RunningAreaChart({ data }: { data: { t: string; running: number }[] }) {
  const colorScheme = useChartColorScheme();
  return (
    <Chart data={data} height="100%" width="100%" colorScheme={colorScheme} padding={8}>
      <Axis position="bottom" baseline />
      <Axis position="left" grid hideDefaultLabels={false} />
      <Line dimension="t" metric="running" gradient interpolate="monotone" />
    </Chart>
  );
}

export function DiskBarChart({ data }: { data: { name: string; gb: number }[] }) {
  const colorScheme = useChartColorScheme();
  return (
    <Chart data={data} height="100%" width="100%" colorScheme={colorScheme} padding={8}>
      <Axis position="bottom" baseline />
      <Axis position="left" grid />
      <Bar dimension="name" metric="gb" />
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
      <Bar dimension="name" metric="value" orientation="horizontal" color="name" />
    </Chart>
  );
}

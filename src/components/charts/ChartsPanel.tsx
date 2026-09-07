import { useEffect, useId, useMemo, useState } from "react";
import { useUIStore } from "@/stores/uiStore";

export function useChartColorScheme(): "light" | "dark" {
  const theme = useUIStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true,
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
    <div className="min-w-0 rounded-2xl bg-card px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="relative" style={{ width: "100%", height }}>
        {children}
      </div>
    </div>
  );
}

/** Step-after area chart for running-container counts over time. */
export function RunningAreaChart({ data }: { data: { i: number; t: string; running: number }[] }) {
  const gradId = useId().replace(/:/g, "");
  const scheme = useChartColorScheme();
  const chartData = data.length
    ? data.map((d) => ({ i: d.i, t: d.t, running: Math.round(d.running) }))
    : [{ i: 0, t: "now", running: 0 }];

  const { linePath, areaPath, maxY, minY, ticks } = useMemo(() => {
    const values = chartData.map((d) => d.running);
    const dataMax = Math.max(...values, 0);
    // Count series: always ground at 0 so a flat run reads as a high waterline, not a baseline hairline
    const minY = 0;
    const maxY = Math.max(dataMax + Math.max(1, Math.ceil(dataMax * 0.12)), 4);
    const range = Math.max(maxY - minY, 1);

    const w = 100;
    const h = 100;
    const padTop = 8;
    const padBottom = 4;
    const plotH = h - padTop - padBottom;
    const n = chartData.length;
    const xAt = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * w);
    const yAt = (v: number) => padTop + plotH - ((v - minY) / range) * plotH;

    let line: string;
    let area: string;
    if (n <= 1) {
      const y = yAt(chartData[0].running).toFixed(2);
      line = `M 0 ${y} L ${w} ${y}`;
      area = `M 0 ${y} L ${w} ${y} L ${w} ${(h - padBottom).toFixed(2)} L 0 ${(h - padBottom).toFixed(2)} Z`;
    } else {
      line = `M ${xAt(0).toFixed(2)} ${yAt(chartData[0].running).toFixed(2)}`;
      for (let i = 1; i < n; i++) {
        const x = xAt(i).toFixed(2);
        line += ` L ${x} ${yAt(chartData[i - 1].running).toFixed(2)} L ${x} ${yAt(chartData[i].running).toFixed(2)}`;
      }
      area = `${line} L ${xAt(n - 1).toFixed(2)} ${(h - padBottom).toFixed(2)} L ${xAt(0).toFixed(2)} ${(h - padBottom).toFixed(2)} Z`;
    }
    const tickCount = 4;
    const ticks = Array.from({ length: tickCount }, (_, i) => {
      const v = minY + (range * i) / (tickCount - 1);
      return { v: Math.round(v), y: yAt(v) };
    });

    return { linePath: line, areaPath: area, maxY, minY, ticks };
  }, [chartData]);

  const last = chartData[chartData.length - 1];
  const srSummary = `Running containers over time. Latest ${last.running} at ${last.t}, ${chartData.length} samples.`;
  const stroke = scheme === "dark" ? "oklch(0.78 0.12 293)" : "oklch(0.52 0.18 293)";
  const grid = scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  return (
    <div className="relative h-full w-full" title={`${last.t}: ${last.running} running`}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        role="img"
        aria-label={srSummary}
      >
        {/* The title attribute above is a mouse tooltip; this is the accessible name. */}
        <title>{srSummary}</title>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <line
            key={t.v}
            x1={0}
            x2={100}
            y1={t.y}
            y2={t.y}
            stroke={grid}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-1 text-[10px] text-muted-foreground">
        <span>
          {last.running} running
          {chartData.length > 1 ? ` · ${chartData.length} samples` : " · collecting…"}
        </span>
        <span>
          {minY}–{maxY}
        </span>
      </div>
    </div>
  );
}

export function DiskBarChart({ data }: { data: { name: string; gb: number }[] }) {
  const chartData = data.length ? data : [{ name: "—", gb: 0 }];
  const max = Math.max(1, ...chartData.map((d) => d.gb));

  return (
    <div className="flex h-full flex-col justify-end gap-2.5">
      {chartData.map((d) => (
        <div
          key={d.name}
          className="flex items-center gap-2"
          title={`${d.name}: ${d.gb.toFixed(2)} GB`}
        >
          <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{d.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80"
              style={{ width: `${(d.gb / max) * 100}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-end font-mono text-xs tabular-nums">
            {d.gb.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bar breakdown. */
export function BreakdownPie({ data }: { data: { name: string; value: number }[] }) {
  const chartData = data.length ? data : [{ name: "Empty", value: 1 }];
  const max = Math.max(1, ...chartData.map((d) => d.value));

  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {chartData.map((d) => (
        <div key={d.name} className="flex items-center gap-2" title={`${d.name}: ${d.value}`}>
          <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">{d.name}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/75"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-end font-mono text-xs tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

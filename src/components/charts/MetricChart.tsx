import { motion, useReducedMotion } from "framer-motion";
import { useId, useMemo } from "react";

const ease = [0.16, 1, 0.3, 1] as const;

/** Animated bar waveform for live metrics. */
export function WaveBars({ values, max }: { values: number[]; max?: number }) {
  const reduceMotion = useReducedMotion();
  const peak = Math.max(max ?? 0, ...values, 1);
  const pads = values.length ? values : Array.from({ length: 24 }, () => 0);
  const duration = reduceMotion ? 0 : 0.35;

  return (
    <div className="flex h-14 w-full max-w-xs items-center justify-center gap-1">
      {pads.map((v, i) => (
        <motion.div
          // biome-ignore lint/suspicious/noArrayIndexKey: bars are a fixed-length positional series
          key={i}
          className="min-w-1 w-[3px] flex-1 rounded-full bg-foreground/35"
          animate={{
            height: `${Math.max(8, (v / peak) * 100)}%`,
            opacity: 0.4 + (i / Math.max(pads.length, 1)) * 0.55,
          }}
          transition={{
            duration,
            ease,
            delay: reduceMotion ? 0 : Math.min(i * 0.008, 0.12),
          }}
        />
      ))}
    </div>
  );
}

/** Smooth SVG area sparkline. */
export function AreaChart({
  values,
  max,
}: {
  values: number[];
  max?: number;
  stroke?: string;
  fill?: string;
}) {
  const gid = useId().replace(/:/g, "");
  const { line, area } = useMemo(() => {
    const w = 240;
    const h = 72;
    const pad = 4;
    const data = values.length > 1 ? values : [...values, ...values];
    const peak = Math.max(max ?? 0, ...data, 1);
    if (data.length < 2) {
      return { line: "", area: "" };
    }
    const step = (w - pad * 2) / (data.length - 1);
    const pts = data.map((v, i) => {
      const x = pad + i * step;
      const y = pad + (1 - v / peak) * (h - pad * 2);
      return [x, y] as const;
    });
    const lineD = pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" ");
    const areaD = `${lineD} L${pts[pts.length - 1][0].toFixed(1)} ${(h - pad).toFixed(1)} L${pts[0][0].toFixed(1)} ${(h - pad).toFixed(1)} Z`;
    return { line: lineD, area: areaD };
  }, [values, max]);

  return (
    <div className="w-full text-foreground">
      {/* Decorative: MetricCard renders the value as text beside this. */}
      <svg
        viewBox="0 0 240 72"
        className="w-full h-16 overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`areaFill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area ? <path d={area} fill={`url(#areaFill-${gid})`} /> : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        ) : null}
      </svg>
    </div>
  );
}

/** Circular utilization gauge. */
export function RingGauge({
  value,
  max = 100,
  label,
  sub,
}: {
  value: number;
  max?: number;
  label: string;
  sub?: string;
}) {
  const reduceMotion = useReducedMotion();
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex items-center gap-3 text-foreground">
      {/* Decorative: the label and percentage are rendered as text alongside. */}
      <svg
        width="84"
        height="84"
        viewBox="0 0 84 84"
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          opacity={0.22}
        />
        <motion.circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduceMotion ? 0 : 0.45, ease }}
        />
      </svg>
      <div>
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <div>
          <span className="text-xl font-semibold tracking-tight font-bold">{pct.toFixed(0)}%</span>
        </div>
        {sub ? <span className="text-muted-foreground text-xs">{sub}</span> : null}
      </div>
    </div>
  );
}

/** Metric surface aligned with ChartPanel: label + meta, value, optional chart. */
export function MetricCard({
  label,
  value,
  hint,
  children,
  flat,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
  /** Skip raised fill when nested inside another layer surface. */
  flat?: boolean;
}) {
  return (
    <div
      className={
        flat
          ? "flex min-w-0 flex-col gap-2 overflow-hidden"
          : "flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl bg-card px-4 py-3.5"
      }
    >
      <div className="flex justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <span className="text-lg font-semibold tracking-tight tabular-nums">{value}</span>
      {children ? <div className="mt-0.5 min-w-0">{children}</div> : null}
    </div>
  );
}

import { motion } from "framer-motion";
import { useId, useMemo } from "react";
import { Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

const ease = [0.16, 1, 0.3, 1] as const;

/** Spectrum-aligned chart colors (work in light/dark via currentColor where possible). */
const CHART_FG = "var(--spectrum-gray-800)";
const CHART_FG_SOFT = "color-mix(in srgb, var(--spectrum-gray-800) 55%, transparent)";
const CHART_FILL = "color-mix(in srgb, var(--spectrum-gray-800) 12%, transparent)";
const CHART_BORDER = "var(--spectrum-gray-300)";

/** Animated bar waveform for live metric series. */
export function WaveBars({
  values,
  max,
  color = CHART_FG_SOFT,
}: {
  values: number[];
  max?: number;
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
  color?: string;
}) {
  const peak = Math.max(max ?? 0, ...values, 1);
  const pads = values.length ? values : Array.from({ length: 24 }, () => 0);

  return (
    <div
      className={style({
        display: "flex",
        height: 56,
        width: "full",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      })}
    >
      {pads.map((v, i) => (
        <motion.div
          key={i}
          className={style({
            width: 3,
            minWidth: 2,
            flexGrow: 1,
            borderRadius: "full",
          })}
          animate={{
            height: `${Math.max(8, (v / peak) * 100)}%`,
            backgroundColor: color,
            opacity: 0.28 + (i / Math.max(pads.length, 1)) * 0.72,
          }}
          transition={{ duration: 0.35, ease, delay: Math.min(i * 0.008, 0.12) }}
        />
      ))}
    </div>
  );
}

/** Smooth SVG area chart for CPU / memory history. */
export function AreaChart({
  values,
  max,
  stroke = CHART_FG_SOFT,
  fill = CHART_FILL,
}: {
  values: number[];
  max?: number;
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
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
    const lineD = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const areaD = `${lineD} L${pts[pts.length - 1][0].toFixed(1)} ${(h - pad).toFixed(1)} L${pts[0][0].toFixed(1)} ${(h - pad).toFixed(1)} Z`;
    return { line: lineD, area: areaD };
  }, [values, max]);

  return (
    <svg
      viewBox="0 0 240 72"
      className={style({ height: 64, width: "full", overflow: "visible" })}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`areaFill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      {area ? <path d={area} fill={`url(#areaFill-${gid})`} /> : null}
      {line ? (
        <motion.path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: 1, opacity: 1 }}
        />
      ) : null}
    </svg>
  );
}

/** Circular utilization gauge (GPU / CPU). */
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
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className={style({ display: "flex", alignItems: "center", gap: 12 })}>
      <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="42" cy="42" r={r} fill="none" stroke={CHART_BORDER} strokeWidth="7" />
        <motion.circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={CHART_FG}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.45, ease }}
        />
      </svg>
      <div>
        <Text
          styles={style({
            font: "detail",
            fontWeight: "medium",
            color: "neutral-subdued",
          })}
        >
          {label}
        </Text>
        <div>
          <Text styles={style({ font: "heading-lg", fontWeight: "bold" })}>{pct.toFixed(0)}%</Text>
        </div>
        {sub ? (
          <Text styles={style({ font: "body-xs", color: "neutral-subdued" })}>{sub}</Text>
        ) : null}
      </div>
    </div>
  );
}

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
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
}) {
  return (
    <div
      className={
        flat
          ? style({
              overflow: "hidden",
              minWidth: 0,
            })
          : style({
              backgroundColor: "layer-1",
              overflow: "hidden",
              borderRadius: "xl",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "gray-200",
              paddingX: 16,
              paddingY: 16,
            })
      }
    >
      <Text
        styles={style({
          font: "detail",
          fontWeight: "medium",
          color: "neutral-subdued",
        })}
      >
        {label}
      </Text>
      <div className={style({ marginTop: 4 })}>
        <Text styles={style({ font: "title-lg", fontWeight: "bold" })}>{value}</Text>
      </div>
      {hint ? (
        <Text styles={style({ marginTop: 2, font: "detail", color: "neutral-subdued" })}>{hint}</Text>
      ) : null}
      {children ? <div className={style({ marginTop: 12 })}>{children}</div> : null}
    </div>
  );
}

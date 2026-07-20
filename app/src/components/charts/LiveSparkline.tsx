import { useId, useMemo, useState, type PointerEvent } from "react";
import { Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useEasedNumber, useEasedSeries } from "@/hooks/useEasedSeries";

const W = 280;
const H = 72;
const PAD = 6;

function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} L${pts[1].x.toFixed(2)} ${pts[1].y.toFixed(2)}`;
  }

  const n = pts.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const m: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    m.push(dy[i] / (dx[i] || 1e-6));
  }

  const tangents = new Array(n).fill(0);
  tangents[0] = m[0];
  tangents[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) tangents[i] = 0;
    else tangents[i] = (m[i - 1] + m[i]) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-6) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i] / m[i];
      const b = tangents[i + 1] / m[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        tangents[i] = t * a * m[i];
        tangents[i + 1] = t * b * m[i];
      }
    }
  }

  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cp1x = p0.x + dx[i] / 3;
    const cp1y = p0.y + (tangents[i] * dx[i]) / 3;
    const cp2x = p1.x - dx[i] / 3;
    const cp2y = p1.y - (tangents[i + 1] * dx[i]) / 3;
    d += ` C${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Lightweight live sparkline (no Vega). Spectrum color via style macro → currentColor.
 * Cheap enough to re-render on each Docker stats sample (~1 Hz).
 */
export function LiveSparkline({
  values,
  unit = "%",
  label = "Sample",
  height = 88,
  formatValue,
  /** Spectrum style color token for the series */
  tone = "neutral",
}: {
  values: number[];
  unit?: string;
  label?: string;
  height?: number;
  formatValue?: (n: number) => string;
  tone?: "neutral" | "accent";
}) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<{ i: number; x: number; y: number; v: number } | null>(null);
  const eased = useEasedSeries(values, 280);
  const rawPeak = useMemo(() => Math.max(...(values.length ? values : [0]), 0), [values]);
  /** Decay only — scale jumps up instantly for spikes, eases down after. */
  const softPeak = useEasedNumber(rawPeak, 600);

  const { line, area, peak } = useMemo(() => {
    const data = eased.length > 1 ? eased : eased.length === 1 ? [eased[0], eased[0]] : [0, 0.01];
    // rawPeak wins on the way up so a network burst isn’t crushed by a lagging axis.
    const dataPeak = Math.max(rawPeak, softPeak, ...data, 0);
    const peak = Math.max(dataPeak * 1.15, dataPeak + 0.5, 1);
    const step = (W - PAD * 2) / Math.max(1, data.length - 1);
    const drawPts = data.map((v, i) => ({
      x: PAD + i * step,
      y: PAD + (1 - v / peak) * (H - PAD * 2),
      v,
    }));
    const line = monotonePath(drawPts);
    const area = line
      ? `${line} L${drawPts[drawPts.length - 1].x.toFixed(2)} ${(H - PAD).toFixed(2)} L${drawPts[0].x.toFixed(2)} ${(H - PAD).toFixed(2)} Z`
      : "";
    return { line, area, peak };
  }, [eased, softPeak, rawPeak]);

  /** Hit-test / tooltip use raw samples so peaks aren’t lost to tip easing. */
  const hoverPts = useMemo(() => {
    const data = values.length > 1 ? values : values.length === 1 ? [values[0], values[0]] : [0, 0.01];
    const step = (W - PAD * 2) / Math.max(1, data.length - 1);
    return data.map((v, i) => ({
      x: PAD + i * step,
      y: PAD + (1 - v / peak) * (H - PAD * 2),
      v,
    }));
  }, [values, peak]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const spacing =
      hoverPts.length > 1 ? Math.abs(hoverPts[1].x - hoverPts[0].x) : W;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < hoverPts.length; i++) {
      const d = Math.abs(hoverPts[i].x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    // On sharp bursts, bias toward the higher neighbor when nearly equidistant.
    if (best > 0 && best < hoverPts.length - 1) {
      const left = hoverPts[best - 1];
      const mid = hoverPts[best];
      const right = hoverPts[best + 1];
      const nearLeft = Math.abs(left.x - x) < spacing * 0.55;
      const nearRight = Math.abs(right.x - x) < spacing * 0.55;
      if (nearLeft && left.v > mid.v && left.v >= right.v) best = best - 1;
      else if (nearRight && right.v > mid.v && right.v >= left.v) best = best + 1;
    }
    const p = hoverPts[best];
    setHover({ i: best, x: p.x, y: p.y, v: p.v });
  };

  const n = hoverPts.length;

  return (
    <div
      className={
        tone === "accent"
          ? style({ position: "relative", width: "full", color: "accent" })
          : style({ position: "relative", width: "full", color: "neutral" })
      }
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        className={style({ overflow: "visible", display: "block" })}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area ? <path d={area} fill={`url(#spark-${gid})`} /> : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {hover ? (
          <circle
            cx={hover.x}
            cy={hover.y}
            r="3.5"
            fill="currentColor"
            stroke="var(--spectrum-gray-50, #fff)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {hover ? (
        <div
          className={style({
            position: "absolute",
            top: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            paddingX: 8,
            paddingY: 4,
            borderRadius: "sm",
            backgroundColor: "layer-2",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "gray-200",
            pointerEvents: "none",
          })}
          style={{
            left: `${Math.min(82, Math.max(0, (hover.x / W) * 100 - 8))}%`,
          }}
        >
          <Text styles={style({ font: "detail-sm", color: "neutral-subdued" })}>
            {label} · {hover.i === n - 1 ? "now" : `−${n - 1 - hover.i}`}
          </Text>
          <Text styles={style({ font: "ui-sm", fontWeight: "medium" })}>
            {formatValue
              ? formatValue(hover.v)
              : `${hover.v.toFixed(unit === "%" ? 1 : 2)}${unit}`}
          </Text>
        </div>
      ) : null}
    </div>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { Heading, Text, Tooltip, TooltipTrigger } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { useWindowDragProps } from "@/components/TitleBarDragRegion";

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const drag = useWindowDragProps();

  return (
    <div className={[style({ minHeight: "full" }), className].filter(Boolean).join(" ")}>
      <div
        className={style({
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
        })}
        {...drag}
      >
        <div>
          <Heading
            styles={style({
              font: "heading-xl",
              margin: 0,
            })}
          >
            {title}
          </Heading>
          {description ? (
            <Text
              styles={style({
                font: "body-sm",
                color: "neutral-subdued",
                display: "block",
                marginTop: 4,
                maxWidth: 672,
              })}
            >
              {description}
            </Text>
          ) : null}
        </div>
        {actions ? (
          <div
            className={style({
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            })}
            data-no-drag
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={style({
        display: "flex",
        flexDirection: "column",
        alignItems: "start",
        gap: 12,
        backgroundColor: "layer-1",
        borderRadius: "xl",
        paddingX: 32,
        paddingY: 40,
      })}
    >
      <Heading
        styles={style({
          font: "title",
          margin: 0,
        })}
      >
        {title}
      </Heading>
      <Text
        styles={style({
          font: "body-sm",
          color: "neutral-subdued",
          maxWidth: 448,
        })}
      >
        {description}
      </Text>
      {action}
    </div>
  );
}

const metricTile = style({
  position: "relative",
  overflow: "hidden",
  backgroundColor: "layer-1",
  borderRadius: "xl",
  paddingX: 20,
  paddingY: 20,
  width: "full",
  textAlign: "start",
  borderWidth: 0,
  borderStyle: "none",
  outlineStyle: "none",
  cursor: "pointer",
});

const metricTileStatic = style({
  position: "relative",
  overflow: "hidden",
  backgroundColor: "layer-1",
  borderRadius: "xl",
  paddingX: 20,
  paddingY: 20,
  width: "full",
  textAlign: "start",
  borderWidth: 0,
  borderStyle: "none",
  outlineStyle: "none",
});

function MetricTileBody({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <>
      <Text
        styles={style({
          font: "detail-sm",
          color: "neutral-subdued",
          display: "block",
        })}
      >
        {label}
      </Text>
      <Text
        styles={style({
          font: "heading-xl",
          display: "block",
          marginTop: 8,
        })}
      >
        {value}
      </Text>
      {hint ? (
        <Text
          styles={style({
            font: "body-xs",
            color: "neutral-subdued",
            display: "block",
            marginTop: 4,
          })}
        >
          {hint}
        </Text>
      ) : null}
    </>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  tip,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tip?: string;
  onClick?: () => void;
}) {
  // Never disable tipped tiles — disabled controls cannot host Spectrum tooltips.
  const tile = (
    <button
      type="button"
      aria-label={tip || label}
      onClick={onClick}
      className={["dh-metric-tile", onClick ? metricTile : metricTileStatic].join(" ")}
      style={onClick ? undefined : { cursor: "default" }}
    >
      <MetricTileBody label={label} value={value} hint={hint} />
    </button>
  );

  if (!tip) return tile;

  return (
    <TooltipTrigger>
      {tile}
      <Tooltip>{tip}</Tooltip>
    </TooltipTrigger>
  );
}

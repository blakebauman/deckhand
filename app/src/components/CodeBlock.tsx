import type { ReactNode } from "react";
import { Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { CopyButton } from "@/components/CopyButton";

/** Structured code/JSON panel with a quiet toolbar (inspect, VM logs, etc.). */
export function CodeBlock({
  value,
  title = "JSON",
  meta,
  maxHeight = "50vh",
  empty = "No data",
}: {
  value: string;
  title?: string;
  meta?: ReactNode;
  maxHeight?: string;
  empty?: string;
}) {
  const hasContent = Boolean(value.trim());

  return (
    <div
      className={[
        "dh-code-block",
        style({
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: "xl",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "gray-300",
          backgroundColor: "layer-1",
          minWidth: 0,
        }),
      ].join(" ")}
    >
      <div
        className={style({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexShrink: 0,
          paddingX: 12,
          paddingY: 8,
          borderBottomWidth: 1,
          borderStyle: "solid",
          borderColor: "gray-200",
          backgroundColor: "layer-2",
        })}
      >
        <div className={style({ display: "flex", minWidth: 0, alignItems: "center", gap: 8 })}>
          <Text styles={style({ font: "ui-sm", fontWeight: "medium" })}>{title}</Text>
          {meta ? (
            <Text styles={style({ font: "detail-sm", color: "neutral-subdued" })}>{meta}</Text>
          ) : null}
        </div>
        <CopyButton value={hasContent ? value : ""} label="Copy" iconOnly />
      </div>
      <pre
        className={[
          "dh-code-block__body",
          hasContent ? "" : "is-muted",
          style({
            margin: 0,
            paddingX: 16,
            paddingY: 16,
            font: "code-xs",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }),
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ maxHeight }}
      >
        {hasContent ? value : empty}
      </pre>
    </div>
  );
}

import type { ReactNode } from "react";
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
        "flex flex-col min-w-0 overflow-hidden bg-card rounded-2xl min-w-0",
      ].join(" ")}
    >
      <div
        className="flex items-center justify-between shrink-0 gap-2 px-3 py-2 bg-muted"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium">{title}</span>
          {meta ? (
            <span className="text-muted-foreground text-xs">{meta}</span>
          ) : null}
        </div>
        <CopyButton value={hasContent ? value : ""} label="Copy" iconOnly />
      </div>
      <pre
        className={[
          "dh-code-block__body",
          hasContent ? "" : "is-muted",
          "px-4 py-4 m-0 overflow-auto font-mono text-xs",
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

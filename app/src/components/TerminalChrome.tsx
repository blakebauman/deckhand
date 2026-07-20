import type { ReactNode } from "react";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

/** Shared dark console shell for logs, exec, and sheet output. */
export function TerminalFrame({
  toolbar,
  children,
  tall,
}: {
  toolbar: ReactNode;
  children: ReactNode;
  /** Prefer taller panels in detail panes. */
  tall?: boolean;
}) {
  return (
    <div
      className={[
        "dh-terminal",
        tall ? "dh-terminal--tall" : "",
        style({
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          overflow: "hidden",
          borderRadius: "xl",
          borderWidth: 1,
          borderStyle: "solid",
        }),
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "dh-terminal__toolbar",
          style({
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexShrink: 0,
            paddingX: 12,
            paddingY: 8,
          }),
        ].join(" ")}
      >
        {toolbar}
      </div>
      {children}
    </div>
  );
}

export function TerminalToolbarStart({ children }: { children: ReactNode }) {
  return (
    <div className={style({ display: "flex", minWidth: 0, alignItems: "center", gap: 8 })}>
      {children}
    </div>
  );
}

export function TerminalToolbarEnd({ children }: { children: ReactNode }) {
  return (
    <div
      className={style({
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 4,
        marginStart: "auto",
      })}
    >
      {children}
    </div>
  );
}

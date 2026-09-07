import type { ReactNode } from "react";

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
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="dh-terminal__toolbar flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
        {toolbar}
      </div>
      {children}
    </div>
  );
}

export function TerminalToolbarStart({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2">{children}</div>;
}

export function TerminalToolbarEnd({ children }: { children: ReactNode }) {
  return <div className="ms-auto flex flex-wrap items-center gap-1">{children}</div>;
}

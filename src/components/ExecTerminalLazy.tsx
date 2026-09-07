import { Suspense, lazy } from "react";
import { TerminalFrame, TerminalToolbarStart } from "@/components/TerminalChrome";

/**
 * xterm.js is the single largest dependency in the bundle (~83 KB gzipped) and
 * is only needed once someone opens a shell tab, so it is split out of the
 * initial load. ExecTerminal already only mounts inside an active TabsContent;
 * this makes the *import* lazy too.
 */
const ExecTerminal = lazy(() =>
  import("@/components/ExecTerminal").then((m) => ({ default: m.ExecTerminal })),
);

function TerminalLoading({ title }: { title: string }) {
  return (
    <TerminalFrame tall toolbar={<TerminalToolbarStart>{title}</TerminalToolbarStart>}>
      <div className="p-3 text-xs text-muted-foreground">loading terminal…</div>
    </TerminalFrame>
  );
}

export function ExecTerminalLazy({ wsUrl, title = "Terminal" }: { wsUrl: string; title?: string }) {
  return (
    <Suspense fallback={<TerminalLoading title={title} />}>
      <ExecTerminal wsUrl={wsUrl} title={title} />
    </Suspense>
  );
}

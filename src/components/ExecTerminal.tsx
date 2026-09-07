import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { RefreshCw } from "lucide-react";
import { lucideProps } from "@/components/Icon";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  TerminalFrame,
  TerminalToolbarEnd,
  TerminalToolbarStart,
} from "@/components/TerminalChrome";
import { Tip } from "@/components/Tip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Shell = "sh" | "bash" | "ash";

const TERM_THEME = {
  background: "#1B1B1B",
  foreground: "#E8E8E8",
  cursor: "#E8E8E8",
  cursorAccent: "#1B1B1B",
  selectionBackground: "rgba(20, 115, 230, 0.35)",
  selectionInactiveBackground: "rgba(110, 110, 110, 0.35)",
  black: "#1B1B1B",
  red: "#F15B50",
  green: "#49B87A",
  yellow: "#E8C47C",
  blue: "#5AA6F0",
  magenta: "#C98BE8",
  cyan: "#5EC4C4",
  white: "#E8E8E8",
  brightBlack: "#6E6E6E",
  brightRed: "#FF7B72",
  brightGreen: "#6DD49A",
  brightYellow: "#F0D78C",
  brightBlue: "#79BBF5",
  brightMagenta: "#D4A0E8",
  brightCyan: "#7ED4D4",
  brightWhite: "#FFFFFF",
} as const;

/** Interactive TTY over WebSocket (xterm.js). */
export function ExecTerminal({
  wsUrl,
  title = "Terminal",
}: {
  /** Base WebSocket URL; `shell` query is appended. */
  wsUrl: string;
  title?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [shell, setShell] = useState<Shell>("sh");
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      lineHeight: 1.4,
      fontFamily:
        '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      theme: TERM_THEME,
      scrollback: 8000,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const url = new URL(wsUrl);
    url.searchParams.set("shell", shell);
    setStatus("connecting");
    term.writeln(`\x1b[90mconnecting · ${shell}\x1b[0m`);

    const ws = new WebSocket(url.toString());
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const sendResize = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };

    ws.onopen = () => {
      setStatus("open");
      term.reset();
      sendResize();
      term.focus();
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        term.write(ev.data);
        return;
      }
      term.write(new Uint8Array(ev.data as ArrayBuffer));
    };

    ws.onerror = () => {
      term.writeln("\r\n\x1b[31mconnection error\x1b[0m");
    };

    ws.onclose = () => {
      setStatus("closed");
      term.writeln("\r\n\x1b[90mdisconnected — reconnect for a new shell\x1b[0m");
    };

    const onData = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const ro = new ResizeObserver(() => sendResize());
    ro.observe(host);
    window.addEventListener("resize", sendResize);

    return () => {
      window.removeEventListener("resize", sendResize);
      ro.disconnect();
      onData.dispose();
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [wsUrl, shell, nonce]);

  const statusLabel =
    status === "open" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected";

  return (
    <TerminalFrame
      tall
      toolbar={
        <>
          <TerminalToolbarStart>
            <span
              className={cn(
                "size-2 rounded-full",
                status === "open"
                  ? "bg-emerald-500"
                  : status === "connecting"
                    ? "bg-amber-500"
                    : "bg-red-500",
              )}
              aria-label={statusLabel}
            />
            <div className="flex flex-col gap-1 min-w-0">
              <span className={["dh-terminal__title", "text-sm font-medium"].join(" ")}>
                {title}
              </span>
              <span className={["dh-terminal__meta", "text-xs"].join(" ")}>
                {statusLabel} · {shell}
              </span>
            </div>
          </TerminalToolbarStart>
          <TerminalToolbarEnd>
            <SegmentedControl
              aria-label="Shell"
              value={shell}
              onChange={setShell}
              options={[
                { id: "sh", label: "sh", "aria-label": "Shell: /bin/sh" },
                { id: "bash", label: "bash", "aria-label": "Shell: /bin/bash" },
                { id: "ash", label: "ash", "aria-label": "Shell: /bin/ash" },
              ]}
            />
            <Tip label="Reconnect">
              <Button
                aria-label="Reconnect shell"
                variant="ghost"
                size="icon-sm"
                onClick={() => setNonce((n) => n + 1)}
              >
                <RefreshCw {...lucideProps("S")} />
              </Button>
            </Tip>
          </TerminalToolbarEnd>
        </>
      }
    >
      <div
        ref={hostRef}
        className={["dh-xterm-host", "flex-1 min-h-0"].join(" ")}
        onClick={() => termRef.current?.focus()}
      />
    </TerminalFrame>
  );
}

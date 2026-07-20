import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import {
  ActionButton,
  StatusLight,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import { style, iconStyle } from "@react-spectrum/s2/style" with { type: "macro" };
import Refresh from "@react-spectrum/s2/icons/Refresh";
import {
  TerminalFrame,
  TerminalToolbarEnd,
  TerminalToolbarStart,
} from "@/components/TerminalChrome";

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
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
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
        '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
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

  const statusVariant =
    status === "open" ? "positive" : status === "connecting" ? "notice" : "neutral";
  const statusLabel =
    status === "open" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected";

  return (
    <TerminalFrame
      tall
      toolbar={
        <>
          <TerminalToolbarStart>
            <StatusLight size="S" variant={statusVariant} aria-label={statusLabel} />
            <div className={style({ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 })}>
              <span className={["dh-terminal__title", style({ font: "ui-sm", fontWeight: "medium" })].join(" ")}>
                {title}
              </span>
              <span className={["dh-terminal__meta", style({ font: "detail-sm" })].join(" ")}>
                {statusLabel} · {shell}
              </span>
            </div>
          </TerminalToolbarStart>
          <TerminalToolbarEnd>
            <ToggleButtonGroup
              aria-label="Shell"
              selectionMode="single"
              selectedKeys={[shell]}
              onSelectionChange={(keys) => {
                const next = [...keys][0] as Shell | undefined;
                if (next) setShell(next);
              }}
              density="compact"
              size="S"
              staticColor="white"
              isQuiet
            >
              <ToggleButton id="sh" aria-label="Shell: /bin/sh">
                sh
              </ToggleButton>
              <ToggleButton id="bash" aria-label="Shell: /bin/bash">
                bash
              </ToggleButton>
              <ToggleButton id="ash" aria-label="Shell: /bin/ash">
                ash
              </ToggleButton>
            </ToggleButtonGroup>
            <TooltipTrigger placement="bottom">
              <ActionButton
                aria-label="Reconnect shell"
                isQuiet
                staticColor="white"
                size="S"
                onPress={() => setNonce((n) => n + 1)}
              >
                <Refresh styles={iconStyle({ size: "S" })} />
              </ActionButton>
              <Tooltip>Reconnect</Tooltip>
            </TooltipTrigger>
          </TerminalToolbarEnd>
        </>
      }
    >
      <div
        ref={hostRef}
        className={["dh-xterm-host", style({ minHeight: 0, flexGrow: 1 })].join(" ")}
        onClick={() => termRef.current?.focus()}
      />
    </TerminalFrame>
  );
}

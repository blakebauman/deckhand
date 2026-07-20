import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import {
  ActionButton,
  StatusLight,
  Text,
  ToggleButton,
  ToggleButtonGroup,
} from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

type Shell = "sh" | "bash" | "ash";

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
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      theme: {
        background: "#0a0a0a",
        foreground: "#e8e8e8",
        cursor: "#e8e8e8",
        selectionBackground: "rgba(110, 110, 110, 0.45)",
      },
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
    term.writeln(`\x1b[90mconnecting (${shell})…\x1b[0m`);

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
      term.writeln("\r\n\x1b[90mdisconnected — reconnect to open a new shell\x1b[0m");
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

  return (
    <div
      className={style({
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        borderRadius: "xl",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "gray-300",
        backgroundColor: "black",
      })}
    >
      <div
        className={style({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderBottomWidth: 1,
          borderStyle: "solid",
          borderColor: "gray-700",
          paddingX: 12,
          paddingY: 8,
        })}
      >
        <div className={style({ display: "flex", alignItems: "center", gap: 8 })}>
          <StatusLight size="S" variant={statusVariant} aria-label={status} />
          <Text
            styles={style({
              font: "detail",
              fontWeight: "medium",
              color: "gray-400",
            })}
          >
            {title}
          </Text>
        </div>
        <div className={style({ display: "flex", alignItems: "center", gap: 4 })}>
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
          <ActionButton
            aria-label="Reconnect shell"
            isQuiet
            staticColor="white"
            size="S"
            onPress={() => setNonce((n) => n + 1)}
          >
            <Text>Reconnect</Text>
          </ActionButton>
        </div>
      </div>
      <div
        ref={hostRef}
        className={style({
          minHeight: 240,
          flexGrow: 1,
          paddingX: 8,
          paddingY: 8,
        })}
      />
    </div>
  );
}

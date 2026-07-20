import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionButton,
  SearchField,
  StatusLight,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import { style, iconStyle } from "@react-spectrum/s2/style" with { type: "macro" };
import Download from "@react-spectrum/s2/icons/Download";
import Pause from "@react-spectrum/s2/icons/Pause";
import Play from "@react-spectrum/s2/icons/Play";
import Delete from "@react-spectrum/s2/icons/Delete";
import { CopyButton } from "@/components/CopyButton";
import {
  TerminalFrame,
  TerminalToolbarEnd,
  TerminalToolbarStart,
} from "@/components/TerminalChrome";

/** Streaming console for container/pod logs. */
export function ConsolePanel({
  url,
  title = "Console",
  follow = true,
  downloadName,
}: {
  url: string | null;
  title?: string;
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
  follow?: boolean;
  downloadName?: string;
}) {
  const [lines, setLines] = useState("");
  const [live, setLive] = useState(follow);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLPreElement>(null);
  const stickBottom = useRef(true);

  useEffect(() => {
    if (!url || !live) {
      return;
    }
    const ac = new AbortController();
    setError(null);

    (async () => {
      try {
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok || !res.body) throw new Error(res.statusText || "stream failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setLines((prev) => {
            const next = prev + chunk;
            return next.length > 400_000 ? next.slice(-350_000) : next;
          });
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e.message || "console disconnected");
      }
    })();

    return () => ac.abort();
  }, [url, live]);

  useEffect(() => {
    setLines("");
    setFilter("");
  }, [url]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return lines;
    return lines
      .split("\n")
      .filter((line) => line.toLowerCase().includes(needle))
      .join("\n");
  }, [filter, lines]);

  const matchCount = useMemo(() => {
    if (!filter.trim()) return null;
    if (!filtered) return 0;
    return filtered.split("\n").filter(Boolean).length;
  }, [filter, filtered]);

  useEffect(() => {
    if (stickBottom.current && scroller.current && !filter) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [filtered, filter]);

  const download = () => {
    const blob = new Blob([lines || ""], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = downloadName || `${title.replace(/\s+/g, "-").toLowerCase()}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const emptyLabel = filter
    ? "No matching lines"
    : url
      ? live
        ? "Waiting for output…"
        : "Stream paused"
      : "No stream selected";

  const body = filter ? filtered || emptyLabel : lines || emptyLabel;
  const isPlaceholder = !lines || (filter && !filtered);

  return (
    <TerminalFrame
      tall
      toolbar={
        <>
          <TerminalToolbarStart>
            <StatusLight
              size="S"
              variant={error ? "negative" : live ? "positive" : "neutral"}
              aria-label={error ? "Error" : live ? "Live" : "Paused"}
            />
            <div className={style({ display: "flex", flexDirection: "column", minWidth: 0, gap: 2 })}>
              <span className={["dh-terminal__title", style({ font: "ui-sm", fontWeight: "medium" })].join(" ")}>
                {title}
              </span>
              <span className={["dh-terminal__meta", style({ font: "detail-sm" })].join(" ")}>
                {error ? "Disconnected" : live ? "Live stream" : "Paused"}
                {matchCount != null ? ` · ${matchCount} match${matchCount === 1 ? "" : "es"}` : ""}
              </span>
            </div>
          </TerminalToolbarStart>
          <TerminalToolbarEnd>
            <SearchField
              aria-label="Filter logs"
              value={filter}
              onChange={setFilter}
              placeholder="Filter lines…"
              size="S"
              styles={style({ width: 180 })}
            />
            <CopyButton value={filter ? filtered : lines} label="Copy" iconOnly dark />
            <TooltipTrigger placement="bottom">
              <ActionButton
                aria-label="Download full log"
                isQuiet
                staticColor="white"
                size="S"
                isDisabled={!lines}
                onPress={download}
              >
                <Download styles={iconStyle({ size: "S" })} />
              </ActionButton>
              <Tooltip>Download log</Tooltip>
            </TooltipTrigger>
            <TooltipTrigger placement="bottom">
              <ActionButton
                aria-label={live ? "Pause log stream" : "Resume log stream"}
                isQuiet
                staticColor="white"
                size="S"
                onPress={() => setLive((v) => !v)}
              >
                {live ? (
                  <Pause styles={iconStyle({ size: "S" })} />
                ) : (
                  <Play styles={iconStyle({ size: "S" })} />
                )}
              </ActionButton>
              <Tooltip>{live ? "Pause" : "Resume"}</Tooltip>
            </TooltipTrigger>
            <TooltipTrigger placement="bottom">
              <ActionButton
                aria-label="Clear logs"
                isQuiet
                staticColor="white"
                size="S"
                isDisabled={!lines}
                onPress={() => setLines("")}
              >
                <Delete styles={iconStyle({ size: "S" })} />
              </ActionButton>
              <Tooltip>Clear</Tooltip>
            </TooltipTrigger>
          </TerminalToolbarEnd>
        </>
      }
    >
      {error ? (
        <div className="dh-terminal__banner">
          <span className={["dh-terminal__banner-text", style({ font: "body-xs" })].join(" ")}>
            {error}
          </span>
        </div>
      ) : null}
      <pre
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className={[
          "dh-terminal__body",
          isPlaceholder ? "is-muted" : "",
          style({
            minHeight: 0,
            flexGrow: 1,
            overflow: "auto",
            paddingX: 16,
            paddingY: 16,
            margin: 0,
            font: "code-xs",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }),
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {body}
      </pre>
    </TerminalFrame>
  );
}

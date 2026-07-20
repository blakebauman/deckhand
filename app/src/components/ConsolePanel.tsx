import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionButton,
  SearchField,
  StatusLight,
  Text,
  Tooltip,
  TooltipTrigger,
} from "@react-spectrum/s2";
import { style, iconStyle } from "@react-spectrum/s2/style" with { type: "macro" };
import Download from "@react-spectrum/s2/icons/Download";
import { CopyButton } from "@/components/CopyButton";

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
          flexWrap: "wrap",
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
        <div className={style({ display: "flex", minWidth: 0, alignItems: "center", gap: 8 })}>
          <StatusLight
            size="S"
            variant={live ? "positive" : "neutral"}
            aria-label={live ? "Live" : "Paused"}
          />
          <Text
            styles={style({
              font: "detail",
              fontWeight: "medium",
              color: "gray-400",
            })}
          >
            {title}
          </Text>
          {matchCount != null ? (
            <Text styles={style({ font: "detail", color: "gray-500" })}>
              {matchCount} match{matchCount === 1 ? "" : "es"}
            </Text>
          ) : null}
        </div>
        <div className={style({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 })}>
          <SearchField
            aria-label="Filter logs"
            value={filter}
            onChange={setFilter}
            placeholder="Filter…"
            size="S"
            styles={style({ width: 160 })}
          />
          <CopyButton value={filter ? filtered : lines} label="Copy" dark />
          {lines ? (
            <TooltipTrigger placement="bottom">
              <ActionButton
                aria-label="Download full log"
                isQuiet
                staticColor="white"
                size="S"
                onPress={download}
              >
                <Download styles={iconStyle({ size: "S" })} />
              </ActionButton>
              <Tooltip>Download full log</Tooltip>
            </TooltipTrigger>
          ) : (
            <ActionButton
              aria-label="Download full log"
              isQuiet
              staticColor="white"
              size="S"
              isDisabled
            >
              <Download styles={iconStyle({ size: "S" })} />
            </ActionButton>
          )}
          <ActionButton
            aria-label={live ? "Pause log stream" : "Resume log stream"}
            isQuiet
            staticColor="white"
            size="S"
            onPress={() => setLive((v) => !v)}
          >
            <Text>{live ? "Pause" : "Resume"}</Text>
          </ActionButton>
          <ActionButton
            aria-label="Clear logs"
            isQuiet
            staticColor="white"
            size="S"
            onPress={() => setLines("")}
          >
            <Text>Clear</Text>
          </ActionButton>
        </div>
      </div>
      {error ? (
        <div className={style({ paddingX: 12, paddingY: 8 })}>
          <Text styles={style({ font: "body-xs", color: "notice-900" })}>{error}</Text>
        </div>
      ) : null}
      <pre
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className={style({
          minHeight: 240,
          flexGrow: 1,
          overflow: "auto",
          padding: 16,
          margin: 0,
          font: "code-xs",
          color: "chartreuse-400",
        })}
      >
        {filter
          ? filtered || "No matching lines"
          : lines || (url ? "Waiting for output…" : "No stream")}
      </pre>
    </div>
  );
}

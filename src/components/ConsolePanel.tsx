import { Download, Pause, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { lucideProps } from "@/components/Icon";
import {
  TerminalFrame,
  TerminalToolbarEnd,
  TerminalToolbarStart,
} from "@/components/TerminalChrome";
import { Tip } from "@/components/Tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Streaming console for container/pod logs. */
export function ConsolePanel({
  url,
  title = "Console",
  follow = true,
  downloadName,
}: {
  url: string | null;
  title?: string;
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
            <span
              className={cn(
                "size-2 rounded-full",
                error ? "bg-red-500" : live ? "bg-emerald-500" : "bg-muted-foreground/60",
              )}
              aria-label={error ? "Error" : live ? "Live" : "Paused"}
            />
            <div className="flex flex-col gap-1 min-w-0">
              <span className={["dh-terminal__title", "text-sm font-medium"].join(" ")}>
                {title}
              </span>
              <span className={["dh-terminal__meta", "text-xs"].join(" ")}>
                {error ? "Disconnected" : live ? "Live stream" : "Paused"}
                {matchCount != null ? ` · ${matchCount} match${matchCount === 1 ? "" : "es"}` : ""}
              </span>
            </div>
          </TerminalToolbarStart>
          <TerminalToolbarEnd>
            <Input
              aria-label="Filter logs"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter lines…"
              className="w-[180px]"
            />
            <CopyButton value={filter ? filtered : lines} label="Copy" iconOnly dark />
            <Tip label="Download log">
              <Button
                aria-label="Download full log"
                variant="ghost"
                size="icon-sm"
                disabled={!lines}
                onClick={download}
              >
                <Download {...lucideProps("S")} />
              </Button>
            </Tip>
            <Tip label={live ? "Pause" : "Resume"}>
              <Button
                aria-label={live ? "Pause log stream" : "Resume log stream"}
                variant="ghost"
                size="icon-sm"
                onClick={() => setLive((v) => !v)}
              >
                {live ? <Pause {...lucideProps("S")} /> : <Play {...lucideProps("S")} />}
              </Button>
            </Tip>
            <Tip label="Clear">
              <Button
                aria-label="Clear logs"
                variant="ghost"
                size="icon-sm"
                disabled={!lines}
                onClick={() => setLines("")}
              >
                <Trash2 {...lucideProps("S")} />
              </Button>
            </Tip>
          </TerminalToolbarEnd>
        </>
      }
    >
      {error ? (
        <div className="dh-terminal__banner">
          <span className={["dh-terminal__banner-text", "text-xs"].join(" ")}>{error}</span>
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
          "flex-1 px-4 py-4 m-0 min-h-0 overflow-auto font-mono text-xs min-h-0",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {body}
      </pre>
    </TerminalFrame>
  );
}

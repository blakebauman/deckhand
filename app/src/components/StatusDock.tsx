import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button, Text, Tooltip, TooltipTrigger } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api, subscribeDockerEvents } from "@/lib/api";
import {
  parseDockerEvent,
  relativeEventTime,
  type DockEvent,
} from "@/lib/dockerEvents";
import { GlassSheet } from "@/components/GlassSheet";
import { LogoMark } from "@/components/Logo";
import { StatusBadge } from "@/components/spectrum/StatusBadge";
import { StatusHalo } from "@/components/StatusHalo";
import { useUIStore } from "@/stores/uiStore";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;
const MAX_EVENTS = 40;

function TipTop({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <TooltipTrigger placement="top" delay={400}>
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

const chipBtn = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: "default",
  borderWidth: 0,
  backgroundColor: "transparent",
  paddingX: 12,
  paddingY: 8,
  cursor: "pointer",
  color: "neutral",
  minWidth: 0,
});

const eventChipBtn = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: "default",
  borderWidth: 0,
  backgroundColor: "transparent",
  paddingX: 12,
  paddingY: 8,
  cursor: "pointer",
  color: "neutral",
  minWidth: 0,
  maxWidth: "full",
});

function RuntimeChip({
  label,
  ok,
  detail,
  warn,
  tip,
  onClick,
}: {
  label: string;
  ok: boolean;
  detail?: string;
  warn?: boolean;
  tip: string;
  onClick?: () => void;
}) {
  // Green / red only when decisive — soft offline stays monotone.
  const tone = ok ? "ok" : warn ? "idle" : "error";

  return (
    <TipTop label={tip}>
      <button type="button" className={`dh-chip ${chipBtn}`} onClick={onClick}>
        <StatusHalo tone={tone} pulse={ok} size="sm" />
        <Text styles={style({ font: "ui-sm" })}>{label}</Text>
        {detail ? (
          <Text
            styles={style({
              font: "code-xs",
              color: "neutral-subdued",
            })}
          >
            {detail}
          </Text>
        ) : null}
      </button>
    </TipTop>
  );
}

function badgeTone(t: DockEvent["tone"]): "success" | "destructive" | "muted" {
  switch (t) {
    case "ok":
      return "success";
    case "error":
      return "destructive";
    default:
      return "muted";
  }
}

function haloTone(t: DockEvent["tone"]): "ok" | "error" | "idle" {
  if (t === "error") return "error";
  if (t === "ok") return "ok";
  return "idle";
}

export function StatusDock() {
  const navigate = useNavigate();
  const setMode = useUIStore((s) => s.setMode);
  const setPendingContainerId = useUIStore((s) => s.setPendingContainerId);
  const reduceMotion = useReducedMotion();
  const status = useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 5000 });
  const [events, setEvents] = useState<DockEvent[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const seq = useRef(0);
  const dockerOk = !!status.data?.docker.connected;
  const k8sOk = !!status.data?.kubernetes.connected;
  const statusDown = status.isError;

  useEffect(() => {
    if (!dockerOk) {
      setEvents([]);
      return;
    }
    const unsub = subscribeDockerEvents((ev) => {
      seq.current += 1;
      const parsed = parseDockerEvent(ev, seq.current);
      if (!parsed) return;
      setEvents((prev) => [parsed, ...prev].slice(0, MAX_EVENTS));
    });
    return unsub;
  }, [dockerOk]);

  // Keep relative timestamps fresh while the chip is visible.
  useEffect(() => {
    if (!events.length) return;
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, [events.length]);

  const latest = events[0];

  const openContainer = (ev: DockEvent) => {
    if (!ev.containerId) return;
    setSheetOpen(false);
    setMode("docker");
    setPendingContainerId(ev.containerId);
    navigate({ to: "/containers" });
  };

  const dockerTip = dockerOk
    ? "Open Docker dashboard"
    : status.data?.docker.error || "Docker unreachable — start the Docker engine";

  const k8sTip = k8sOk
    ? `Open Kubernetes · ${status.data?.kubernetes.version || "cluster"}`
    : status.data?.kubernetes.error || "No reachable cluster in kubeconfig";

  return (
    <>
      <div
        className={style({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          maxWidth: 1800,
          marginX: "auto",
          paddingEnd: 40,
        })}
        // 80 sidebar + 40 page pad — outside the Spectrum spacing scale
        style={{ paddingInlineStart: 120 }}
      >
        <div
          className={style({
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          })}
        >
          <TipTop label="Local-first Docker & Kubernetes desktop">
            <button
              type="button"
              className={`dh-chip ${chipBtn}`}
              onClick={() => {
                setMode("docker");
                navigate({ to: "/" });
              }}
            >
              <LogoMark size={22} />
              <Text styles={style({ font: "title-sm" })}>Deckhand</Text>
            </button>
          </TipTop>
          <RuntimeChip
            label="Docker"
            ok={dockerOk && !statusDown}
            detail={statusDown || !dockerOk ? "offline" : "engine"}
            tip={statusDown ? "Sidecar status unavailable" : dockerTip}
            onClick={() => {
              setMode("docker");
              navigate({ to: "/" });
            }}
          />
          <RuntimeChip
            label="Kubernetes"
            ok={k8sOk && !statusDown}
            warn={!k8sOk || statusDown}
            detail={k8sOk && !statusDown ? status.data?.kubernetes.version : "offline"}
            tip={statusDown ? "Sidecar status unavailable" : k8sTip}
            onClick={() => {
              setMode("kubernetes");
              navigate({ to: "/k8s" });
            }}
          />
          {status.data?.firecracker.available ? (
            <RuntimeChip
              label="Firecracker"
              ok
              detail="kvm"
              tip="Open MicroVMs"
              onClick={() => {
                setMode("microvms");
                navigate({ to: "/microvms" });
              }}
            />
          ) : null}
        </div>
        <div
          className={style({
            display: "flex",
            minWidth: 0,
            maxWidth: 480,
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "end",
            gap: 8,
            // Hairline lives here (not on the sidebar) — separates engine chips from activity.
            borderStartWidth: 1,
            borderStyle: "solid",
            borderColor: "gray-300",
            paddingStart: 12,
          })}
        >
          {latest ? (
            <TipTop label="Open activity — recent engine events with detail">
              <button
                type="button"
                className={`dh-chip ${eventChipBtn}`}
                onClick={() => setSheetOpen(true)}
              >
                <motion.span
                  key={latest.id}
                  initial={reduceMotion ? false : { scale: 0.7, opacity: 0.35 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: easeOutExpo }}
                  className={style({ display: "inline-flex", flexShrink: 0 })}
                >
                  <StatusHalo tone={haloTone(latest.tone)} pulse size="sm" />
                </motion.span>
                <div
                  className={style({
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "start",
                    minWidth: 0,
                    flexGrow: 1,
                    gap: 2,
                    overflow: "hidden",
                  })}
                >
                  <div
                    className={style({
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      minWidth: 0,
                      maxWidth: "full",
                    })}
                  >
                    <Text styles={style({ font: "detail-sm", color: "neutral-subdued" })}>
                      {latest.verb}
                    </Text>
                    <Text styles={style({ font: "detail-sm", color: "neutral-subdued" })}>
                      {relativeEventTime(latest.at, now)}
                    </Text>
                  </div>
                  <span
                    className={style({
                      position: "relative",
                      display: "block",
                      font: "ui-sm",
                      fontWeight: "medium",
                      minWidth: 0,
                      maxWidth: "full",
                      width: "full",
                      height: 18,
                      overflow: "hidden",
                    })}
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={latest.id}
                        initial={
                          reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, y: 8, filter: "blur(3px)" }
                        }
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={
                          reduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, y: -8, filter: "blur(3px)" }
                        }
                        transition={{ duration: 0.32, ease: easeOutExpo }}
                        className={style({
                          position: "absolute",
                          insetX: 0,
                          top: 0,
                          truncate: true,
                          minWidth: 0,
                          maxWidth: "full",
                        })}
                      >
                        {latest.subject}
                        {latest.image && latest.image !== latest.subject
                          ? ` · ${latest.image}`
                          : ""}
                        {latest.exitCode != null && latest.exitCode !== ""
                          ? ` · exit ${latest.exitCode}`
                          : ""}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </div>
              </button>
            </TipTop>
          ) : (
            <TipTop
              label={
                dockerOk
                  ? "Container start/stop and image activity will show here"
                  : "Connect Docker to stream engine activity here"
              }
            >
              <button
                type="button"
                className={`dh-chip ${chipBtn}`}
                aria-label="Activity idle"
                onClick={() => dockerOk && setSheetOpen(true)}
              >
                <StatusHalo tone={dockerOk ? "ok" : "idle"} size="sm" />
                <Text
                  styles={style({
                    font: "ui-xs",
                    color: "neutral-subdued",
                  })}
                >
                  {dockerOk ? "Listening…" : "local-first"}
                </Text>
              </button>
            </TipTop>
          )}
        </div>
      </div>

      <GlassSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Engine activity"
        description="Recent Docker events — start, stop, images, and networks. Exec attach noise is filtered out."
        size="lg"
        footer={
          <Button variant="secondary" onPress={() => setSheetOpen(false)}>
            Close
          </Button>
        }
      >
        {events.length === 0 ? (
          <Text styles={style({ font: "body-sm", color: "neutral-subdued" })}>
            No recent activity yet. Start or stop a container to see it here.
          </Text>
        ) : (
          <div className={style({ display: "flex", flexDirection: "column", gap: 4 })}>
            {events.map((ev) => (
              <div
                key={ev.id}
                className={style({
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  paddingX: 12,
                  paddingY: 8,
                  borderRadius: "lg",
                  backgroundColor: "gray-100",
                  minWidth: 0,
                })}
              >
                <div
                  className={style({
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    flexGrow: 1,
                    minWidth: 0,
                  })}
                >
                  <div
                    className={style({
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                    })}
                  >
                    <StatusBadge tone={badgeTone(ev.tone)}>{ev.verb}</StatusBadge>
                    <StatusBadge tone="muted">{ev.type}</StatusBadge>
                    <Text styles={style({ font: "detail-sm", color: "neutral-subdued" })}>
                      {relativeEventTime(ev.at, now)}
                    </Text>
                  </div>
                  <Text styles={style({ font: "ui-sm", fontWeight: "medium" })}>{ev.subject}</Text>
                  <div className={style({ font: "body-xs", color: "neutral-subdued" })}>
                    {[ev.image && ev.image !== ev.subject ? ev.image : null, ev.exitCode != null && ev.exitCode !== "" ? `exit ${ev.exitCode}` : null, ev.containerId ? ev.containerId.slice(0, 12) : null]
                      .filter(Boolean)
                      .join(" · ") || ev.detail}
                  </div>
                </div>
                {ev.containerId ? (
                  <Button size="S" variant="secondary" fillStyle="outline" onPress={() => openContainer(ev)}>
                    Open
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </GlassSheet>
    </>
  );
}

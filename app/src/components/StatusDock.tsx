import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { api, subscribeDockerEvents } from "@/lib/api";
import {
  parseDockerEvent,
  relativeEventTime,
  type DockEvent,
} from "@/lib/dockerEvents";
import { GlassSheet } from "@/components/GlassSheet";
import { LogoMark } from "@/components/Logo";
import { StatusBadge } from "@/components/StatusBadge";
import { Tip } from "@/components/Tip";
import { StatusHalo } from "@/components/StatusHalo";
import { useUIStore } from "@/stores/uiStore";
import { Button } from "@/components/ui/button";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;
const MAX_EVENTS = 40;

const chipBtn =
  "dh-chip inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-3 py-2 text-foreground";

const eventChipBtn =
  "dh-chip inline-flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-3 py-2 text-foreground";

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
    <Tip label={tip} placement="top">
      <button type="button" className={chipBtn} onClick={onClick}>
        <StatusHalo tone={tone} pulse={ok} size="sm" />
        <span className="text-sm">{label}</span>
        {detail ? <span className="font-mono text-xs text-muted-foreground">{detail}</span> : null}
      </button>
    </Tip>
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

  const dockerTip = statusDown
    ? "Sidecar status unavailable"
    : dockerOk
      ? "Open Docker dashboard"
      : status.data?.docker.error || "Docker unreachable — start the engine, then retry from Settings";

  const k8sTip = k8sOk
    ? `Open Kubernetes · ${status.data?.kubernetes.version || "cluster"}`
    : status.data?.kubernetes.error || "No reachable cluster in kubeconfig";

  return (
    <>
      <div className="mx-auto box-border flex w-full max-w-[1800px] items-center justify-between gap-3 px-6 md:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Tip label="Local-first Docker & Kubernetes desktop" placement="top">
            <button
              type="button"
              className={chipBtn}
              onClick={() => {
                setMode("docker");
                navigate({ to: "/" });
              }}
            >
              <LogoMark size={22} />
              <span className="text-sm font-semibold">Deckhand</span>
            </button>
          </Tip>
          <RuntimeChip
            label="Docker"
            ok={dockerOk && !statusDown}
            // Sidecar up + engine down is soft (monotone); sidecar down is hard red.
            warn={!statusDown && !dockerOk}
            detail={statusDown || !dockerOk ? "offline" : "engine"}
            tip={dockerTip}
            onClick={() => {
              setMode("docker");
              navigate({ to: statusDown || !dockerOk ? "/settings" : "/" });
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
        <div className="flex max-w-[480px] min-w-0 flex-1 items-center justify-end gap-2">
          {latest ? (
            <Tip label="Open activity — recent engine events with detail" placement="top">
              <button
                type="button"
                className={eventChipBtn}
                onClick={() => setSheetOpen(true)}
              >
                <motion.span
                  key={latest.id}
                  initial={reduceMotion ? false : { scale: 0.7, opacity: 0.35 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, ease: easeOutExpo }}
                  className="inline-flex shrink-0"
                >
                  <StatusHalo tone={haloTone(latest.tone)} pulse size="sm" />
                </motion.span>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 overflow-hidden">
                  <div className="flex max-w-full min-w-0 gap-2">
                    <span className="text-xs text-muted-foreground">{latest.verb}</span>
                    <span className="text-xs text-muted-foreground">
                      {relativeEventTime(latest.at, now)}
                    </span>
                  </div>
                  <span className="relative block h-[18px] w-full min-w-0 overflow-hidden text-sm font-medium">
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
                        className="absolute inset-x-0 top-0 max-w-full min-w-0 truncate"
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
            </Tip>
          ) : (
            <Tip
              label={
                dockerOk
                  ? "Container start/stop and image activity will show here"
                  : "Connect Docker to stream engine activity here"
              }
              placement="top"
            >
              <button
                type="button"
                className={chipBtn}
                aria-label="Activity idle"
                onClick={() => dockerOk && setSheetOpen(true)}
              >
                <StatusHalo tone="idle" size="sm" />
                <span className="text-sm text-muted-foreground">
                  {dockerOk ? "No activity" : "local-first"}
                </span>
              </button>
            </Tip>
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
          <Button variant="secondary" onClick={() => setSheetOpen(false)}>
            Close
          </Button>
        }
      >
        {events.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            No recent activity yet. Start or stop a container to see it here.
          </span>
        ) : (
          <div className="flex flex-col gap-1">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex min-w-0 items-center gap-3 rounded-lg bg-muted px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={badgeTone(ev.tone)}>{ev.verb}</StatusBadge>
                    <StatusBadge tone="muted">{ev.type}</StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {relativeEventTime(ev.at, now)}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{ev.subject}</span>
                  <div className="text-xs text-muted-foreground">
                    {[
                      ev.image && ev.image !== ev.subject ? ev.image : null,
                      ev.exitCode != null && ev.exitCode !== "" ? `exit ${ev.exitCode}` : null,
                      ev.containerId ? ev.containerId.slice(0, 12) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || ev.detail}
                  </div>
                </div>
                {ev.containerId ? (
                  <Button size="sm" variant="secondary" onClick={() => openContainer(ev)}>
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

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Text, Tooltip, TooltipTrigger } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { api, subscribeDockerEvents } from "@/lib/api";
import { LogoMark } from "@/components/Logo";
import { StatusHalo } from "@/components/StatusHalo";
import { useUIStore } from "@/stores/uiStore";

type DockEvent = { id: number; line: string };

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

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
  const tone = ok ? "ok" : warn ? "warn" : "error";

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

function formatEvent(ev: any): string {
  const action = ev?.Action || ev?.action || "event";
  const typ = ev?.Type || ev?.type || "docker";
  const from = ev?.Actor?.Attributes?.name || ev?.Actor?.Attributes?.image || ev?.from || "";
  const id = ev?.Actor?.ID ? String(ev.Actor.ID).slice(0, 12) : "";
  return [typ, action, from || id].filter(Boolean).join(" · ");
}

export function StatusDock() {
  const navigate = useNavigate();
  const setMode = useUIStore((s) => s.setMode);
  const reduceMotion = useReducedMotion();
  const status = useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 5000 });
  const [events, setEvents] = useState<DockEvent[]>([]);
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
      const line = formatEvent(ev);
      if (!line) return;
      seq.current += 1;
      const id = seq.current;
      setEvents((prev) => [{ id, line }, ...prev].slice(0, 8));
    });
    return unsub;
  }, [dockerOk]);

  const latest = events[0];

  const dockerTip = dockerOk
    ? "Open Docker dashboard"
    : status.data?.docker.error || "Docker unreachable — start the Docker engine";

  const k8sTip = k8sOk
    ? `Open Kubernetes · ${status.data?.kubernetes.version || "cluster"}`
    : status.data?.kubernetes.error || "No reachable cluster in kubeconfig";

  return (
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
          maxWidth: 448,
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "end",
          gap: 8,
        })}
      >
        {latest ? (
          <TipTop
            label={
              <div
                className={style({
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                })}
              >
                <Text
                  styles={style({
                    font: "detail-sm",
                    color: "neutral-subdued",
                    display: "block",
                  })}
                >
                  Recent Docker events
                </Text>
                {events.slice(0, 4).map((e) => (
                  <Text key={e.id} styles={style({ font: "code-xs", display: "block" })}>
                    {e.line}
                  </Text>
                ))}
              </div>
            }
          >
            <button
              type="button"
              className={`dh-chip ${eventChipBtn}`}
              onClick={() => {
                setMode("docker");
                navigate({ to: "/containers" });
              }}
            >
              <motion.span
                key={latest.id}
                initial={reduceMotion ? false : { scale: 0.7, opacity: 0.35 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: easeOutExpo }}
                className={style({ display: "inline-flex", flexShrink: 0 })}
              >
                <StatusHalo tone="ok" pulse size="sm" />
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
                <Text styles={style({ font: "detail-sm", color: "neutral-subdued" })}>Event</Text>
                <span
                  className={style({
                    position: "relative",
                    display: "block",
                    font: "code-xs",
                    minWidth: 0,
                    maxWidth: "full",
                    width: "full",
                    height: 16,
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
                      {latest.line}
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
                ? "Live Docker events will appear here"
                : "Connect Docker to stream engine events here"
            }
          >
            <button type="button" className={`dh-chip ${chipBtn}`} aria-label="local-first">
              <StatusHalo tone={dockerOk ? "ok" : "warn"} size="sm" />
              <Text
                styles={style({
                  font: "ui-xs",
                  color: "neutral-subdued",
                })}
              >
                local-first
              </Text>
            </button>
          </TipTop>
        )}
      </div>
    </div>
  );
}

/** Parsed Docker engine event for the status dock / activity sheet. */

export type DockEvent = {
  id: number;
  at: number;
  type: string;
  action: string;
  name: string;
  image?: string;
  containerId?: string;
  exitCode?: string;
  /** Short chip line, e.g. "nginx". */
  subject: string;
  /** Verb for the chip eyebrow, e.g. "Started". */
  verb: string;
  /** One-line detail for lists. */
  detail: string;
  tone: "ok" | "warn" | "error" | "info";
};

const NOISE = new Set([
  "exec_create",
  "exec_start",
  "exec_die",
  "exec_detach",
  "attach",
  "detach",
  "resize",
  "top",
  "export",
]);

function attr(ev: any, key: string): string {
  return String(ev?.Actor?.Attributes?.[key] || "").trim();
}

function titleCaseAction(action: string): string {
  const a = action.replace(/_/g, " ");
  return a ? a.charAt(0).toUpperCase() + a.slice(1) : "Event";
}

/** Human verb for common container lifecycle actions. */
function verbFor(type: string, action: string): string {
  if (type === "container") {
    switch (action) {
      case "start":
        return "Started";
      case "stop":
      case "kill":
        return "Stopped";
      case "die":
        return "Exited";
      case "create":
        return "Created";
      case "destroy":
        return "Removed";
      case "pause":
        return "Paused";
      case "unpause":
        return "Resumed";
      case "restart":
        return "Restarted";
      case "oom":
        return "OOM killed";
      default:
        return titleCaseAction(action);
    }
  }
  if (type === "image") {
    switch (action) {
      case "pull":
        return "Pulled";
      case "tag":
        return "Tagged";
      case "untag":
        return "Untagged";
      case "delete":
      case "prune":
        return "Removed image";
      default:
        return titleCaseAction(action);
    }
  }
  if (type === "network") {
    switch (action) {
      case "connect":
        return "Connected";
      case "disconnect":
        return "Disconnected";
      case "create":
        return "Network created";
      case "destroy":
        return "Network removed";
      default:
        return titleCaseAction(action);
    }
  }
  if (type === "volume") {
    switch (action) {
      case "create":
        return "Volume created";
      case "destroy":
        return "Volume removed";
      default:
        return titleCaseAction(action);
    }
  }
  return titleCaseAction(action);
}

function toneFor(type: string, action: string, exitCode?: string): DockEvent["tone"] {
  if (type === "container") {
    if (action === "oom") return "error";
    if (action === "die" || action === "kill") {
      if (exitCode && exitCode !== "0") return "warn";
      return "info";
    }
    if (action === "start" || action === "unpause" || action === "restart") return "ok";
    if (action === "destroy") return "warn";
  }
  if (action === "delete" || action === "destroy" || action === "prune") return "warn";
  return "info";
}

/**
 * Normalize a Docker events API payload. Returns null for noisy/low-value events
 * (exec attach spam, etc.).
 */
export function parseDockerEvent(ev: any, id: number): DockEvent | null {
  const type = String(ev?.Type || ev?.type || "docker").toLowerCase();
  const action = String(ev?.Action || ev?.action || "event").toLowerCase();
  if (NOISE.has(action) || action.startsWith("exec_")) return null;

  const name = attr(ev, "name") || attr(ev, "container") || "";
  const image = attr(ev, "image") || (type === "image" ? name : "");
  const containerId = type === "container" && ev?.Actor?.ID ? String(ev.Actor.ID) : "";
  const exitCode = attr(ev, "exitCode") || undefined;
  const network = attr(ev, "name") && type === "network" ? attr(ev, "name") : attr(ev, "network");

  let subject = name || image || (containerId ? containerId.slice(0, 12) : type);
  if (type === "network" && action === "connect") {
    subject = name || "container";
  }

  const verb = verbFor(type, action);
  const parts: string[] = [];
  if (type === "container") {
    parts.push(subject);
    if (image && image !== subject) parts.push(image);
    if (action === "die" && exitCode != null && exitCode !== "") parts.push(`exit ${exitCode}`);
  } else if (type === "network" && (action === "connect" || action === "disconnect")) {
    parts.push(name || "container");
    if (network) parts.push(`→ ${network}`);
  } else if (type === "image") {
    parts.push(image || subject);
  } else {
    parts.push(subject);
  }

  const detail = `${verb} · ${parts.filter(Boolean).join(" · ")}`;
  const time = typeof ev?.time === "number" ? ev.time * 1000 : Date.now();
  const timeNano = typeof ev?.timeNano === "number" ? Math.floor(ev.timeNano / 1e6) : 0;

  return {
    id,
    at: timeNano || time || Date.now(),
    type,
    action,
    name: name || subject,
    image: image || undefined,
    containerId: containerId || undefined,
    exitCode,
    subject,
    verb,
    detail,
    tone: toneFor(type, action, exitCode),
  };
}

export function relativeEventTime(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

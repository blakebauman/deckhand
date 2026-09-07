import type { ComposeProject } from "@/lib/api";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export function composeProjectKey(p: ComposeProject) {
  // Stable across engine/scan merge so selection survives status refresh.
  return `${p.name}::${p.path || p.configFiles?.[0] || ""}`;
}

export function composeStatusLabel(p: ComposeProject) {
  if (p.running) return "running";
  if (p.source === "scan") return "scan";
  const status = (p.status || "").toLowerCase();
  if (!status || status === "discovered") return "stopped";
  if (status.startsWith("exited") || status.startsWith("stopped")) return "stopped";
  // Keep short engine labels like "running(2)" / "exited(1)" readable.
  const m = /^(running|exited|stopped|created|restarting|paused|dead)/i.exec(p.status || "");
  return m ? m[1].toLowerCase() : "stopped";
}

import { isTauriShell } from "@/lib/platform";

/** Open a URL in the system browser (Tauri) or a new tab (web). */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (isTauriShell()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      return;
    } catch {
      /* fall through */
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Prefer domain proxy URL when domains are enabled; else first published localhost port. */
export function containerBrowseUrl(opts: {
  name: string;
  ports?: { PublicPort?: number; PrivatePort?: number; Type?: string }[];
  labels?: Record<string, string>;
  domainsEnabled?: boolean;
  domainHttpPort?: string; // e.g. 8787
}): string | null {
  const custom = parseDomainLabels(opts.labels);
  if (opts.domainsEnabled && opts.domainHttpPort) {
    const host = custom[0] || (opts.name ? `${opts.name}.deckhand.local` : "");
    if (host) {
      return `http://${host}:${opts.domainHttpPort}`;
    }
  }
  const pub = (opts.ports || []).find((p) => p.PublicPort && p.PublicPort > 0);
  if (pub?.PublicPort) {
    return `http://127.0.0.1:${pub.PublicPort}`;
  }
  return null;
}

export function parseDomainLabels(labels?: Record<string, string>): string[] {
  if (!labels) return [];
  const raw =
    labels["dev.deckhand.domains"] ||
    labels["dev.orbstack.domains"] ||
    "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

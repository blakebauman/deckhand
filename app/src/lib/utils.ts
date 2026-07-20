export function shortId(id?: string, n = 12) {
  if (!id) return "";
  return id.length > n ? id.slice(0, n) : id;
}

export function containerName(names?: string[]) {
  if (!names?.length) return "—";
  return names[0].replace(/^\//, "");
}

export type PublishedPort = {
  IP?: string;
  PrivatePort?: number;
  PublicPort?: number;
  Type?: string;
};

/** Deduped host publish map for list/detail chrome (skips unbound + IPv6 duplicates). */
export function formatPublishedPorts(ports?: PublishedPort[], limit = 3): string {
  if (!ports?.length) return "";
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const p of ports) {
    if (!p.PublicPort) continue;
    const key = `${p.PublicPort}:${p.PrivatePort ?? ""}:${p.Type || "tcp"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(
      p.PrivatePort && p.PrivatePort !== p.PublicPort
        ? `${p.PublicPort}→${p.PrivatePort}`
        : String(p.PublicPort),
    );
  }
  if (!parts.length) return "";
  if (parts.length <= limit) return parts.join(", ");
  return `${parts.slice(0, limit).join(", ")} +${parts.length - limit}`;
}

export function formatBytes(bytes?: number) {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

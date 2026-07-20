export function shortId(id?: string, n = 12) {
  if (!id) return "";
  return id.length > n ? id.slice(0, n) : id;
}

export function containerName(names?: string[]) {
  if (!names?.length) return "—";
  return names[0].replace(/^\//, "");
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

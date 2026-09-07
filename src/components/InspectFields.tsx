import type { ReactNode } from "react";
import { CopyButton } from "@/components/CopyButton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function InspectFields({
  rows,
}: {
  rows: { label: string; value?: ReactNode; copy?: string; mono?: boolean }[];
}) {
  const visible = rows.filter((r) => r.value != null && r.value !== "");
  if (!visible.length) return null;

  return (
    <dl className="m-0 overflow-hidden rounded-2xl bg-card">
      {visible.map((r, i) => (
        <div key={r.label}>
          {i > 0 ? <Separator /> : null}
          <div className="flex items-start justify-between gap-3 px-3.5 py-2">
            <dt>
              <span className="text-xs font-medium text-muted-foreground">{r.label}</span>
            </dt>
            <dd className="m-0 min-w-0 flex-1 text-end">
              <span className="inline-flex max-w-full items-center justify-end gap-2">
                <span
                  className={
                    r.mono
                      ? "min-w-0 overflow-hidden font-mono text-xs"
                      : "min-w-0 overflow-hidden text-sm"
                  }
                >
                  {r.value}
                </span>
                {r.copy ? <CopyButton value={r.copy} label="Copy" iconOnly /> : null}
              </span>
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export function LabelChips({ labels }: { labels?: Record<string, string> | null }) {
  const entries = Object.entries(labels || {});
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Labels">
      {entries.map(([k, v]) => (
        <Badge key={k} variant="secondary" className="max-w-full truncate font-mono text-[11px]">
          {k}={v}
        </Badge>
      ))}
    </div>
  );
}

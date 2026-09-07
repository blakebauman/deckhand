import type { CSSProperties, ReactNode } from "react";
import { CloudOff } from "lucide-react";
import { lucideProps } from "@/components/Icon";
import { useWindowDragProps } from "@/components/TitleBarDragRegion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const drag = useWindowDragProps();

  return (
    <div className={cn("min-h-full", className)}>
      <div className="mb-5 flex items-end justify-between gap-4" {...drag}>
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div
            className="flex shrink-0 items-center gap-2"
            data-no-drag
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl bg-card px-8 py-10 text-center">
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
        <CloudOff {...lucideProps("L")} />
      </div>
      <h2 className="m-0 text-sm font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

function MetricTileBody({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="mt-2 block text-3xl font-semibold tracking-tight">{value}</span>
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  tip,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tip?: string;
  onClick?: () => void;
}) {
  const tile = (
    <button
      type="button"
      aria-label={tip || label}
      onClick={onClick}
      className={cn(
        "dh-metric-tile relative w-full overflow-hidden rounded-2xl bg-card px-5 py-5 text-start",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      <MetricTileBody label={label} value={value} hint={hint} />
    </button>
  );

  if (!tip) return tile;

  return (
    <Tooltip>
      <TooltipTrigger render={tile} />
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

import { List } from "lucide-react";
import { type CSSProperties, forwardRef, type ReactNode, type Ref } from "react";
import { lucideProps } from "@/components/Icon";
import { useWindowDragProps } from "@/components/TitleBarDragRegion";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Master list shell (compound pieces + convenience wrapper). */
export function ListPaneRoot({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-[360px] max-w-[360px] shrink-0 flex-col overflow-visible",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 end-0 z-30 w-px bg-border" />
      {children}
    </div>
  );
}

export function ListPaneHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const drag = useWindowDragProps();
  return (
    <div className={cn("z-20 shrink-0 bg-background py-2.5 ps-2.5 pe-4", className)} {...drag}>
      {children}
    </div>
  );
}

export function ListPaneTitleRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mb-2 flex min-w-0 flex-nowrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

export function ListPaneTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h2
      className={cn(
        "m-0 min-w-0 flex-1 truncate px-1 text-lg font-semibold tracking-tight",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function ListPaneActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("ms-auto flex shrink-0 items-center gap-2", className)}
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function ListPaneSearch({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div data-no-drag style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("w-full", className)}
      />
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton placeholders, never reordered
          key={i}
          className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-2.5 py-2"
          style={{ opacity: 1 - i * 0.1 }}
        >
          <Skeleton className="h-3 w-full max-w-[180px]" />
          <Skeleton className="h-2.5 w-full max-w-[120px]" />
        </div>
      ))}
    </div>
  );
}

export function ListEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <div className="mb-1 flex size-9 items-center justify-center rounded-full bg-muted">
        <List {...lucideProps("M")} />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="max-w-64 text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ListPaneScroll({
  className,
  style: inlineStyle,
  children,
  empty,
  loading,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  empty?: ReactNode;
  loading?: boolean;
}) {
  const hasItems = Array.isArray(children)
    ? children.length > 0
    : children != null && children !== false;

  return (
    <div
      className={cn("h-full min-h-0 flex-1 overflow-x-hidden overflow-y-auto ps-2 pe-4", className)}
      style={inlineStyle}
    >
      <div className="flex flex-col gap-1 pb-10">
        {loading ? (
          <ListSkeleton />
        ) : hasItems ? (
          children
        ) : (
          <div className="px-1">
            {typeof empty === "string" || empty == null ? (
              <ListEmpty title={typeof empty === "string" ? empty : "Nothing here yet"} />
            ) : (
              empty
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Convenience API used by existing pages. */
export function ListPane({
  title,
  actions,
  children,
  className,
  search,
  empty,
  loading,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  empty?: ReactNode;
  loading?: boolean;
}) {
  return (
    <ListPaneRoot className={className}>
      <ListPaneHeader>
        <ListPaneTitleRow>
          <ListPaneTitle>{title}</ListPaneTitle>
          {actions ? <ListPaneActions>{actions}</ListPaneActions> : null}
        </ListPaneTitleRow>
        {search ? (
          <ListPaneSearch
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
          />
        ) : null}
      </ListPaneHeader>
      <ListPaneScroll empty={empty} loading={loading}>
        {children}
      </ListPaneScroll>
    </ListPaneRoot>
  );
}

export const ListItem = forwardRef<
  HTMLButtonElement | HTMLDivElement,
  {
    active?: boolean;
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
  }
>(function ListItem({ active, onClick, children, className }, ref) {
  const classes = cn(
    "dh-list-item mb-0 flex w-full min-w-0 flex-col gap-0.5 rounded-lg border-0 px-2 py-1.5 text-start text-foreground",
    onClick ? "cursor-pointer" : "",
    active ? "dh-list-item-selected bg-muted" : "bg-transparent hover:bg-muted/60",
    className,
  );
  const style = { WebkitAppRegion: "no-drag" } as CSSProperties;

  // Rows without an onClick are display-only (K8sResourcesPage renders them
  // that way). They previously still carried role="button" and tabIndex={0},
  // so they sat in the tab order announcing themselves as controls that did
  // nothing. Render a plain div for those and a real button otherwise, which
  // also gets Enter/Space handling for free instead of hand-rolling it.
  if (!onClick) {
    return (
      <div
        ref={ref as Ref<HTMLDivElement>}
        className={classes}
        aria-current={active ? "true" : undefined}
        style={style}
        data-no-drag
      >
        {children}
      </div>
    );
  }

  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      className={classes}
      aria-current={active ? "true" : undefined}
      style={style}
      data-no-drag
    >
      {children}
    </button>
  );
});

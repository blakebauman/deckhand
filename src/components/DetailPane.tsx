import { MousePointerClick } from "lucide-react";
import type { ReactNode } from "react";
import { lucideProps } from "@/components/Icon";
import { cn } from "@/lib/utils";

/** Detail title — matches ListPaneTitle for list/detail alignment. */
export function DetailHeading({ children }: { children: ReactNode }) {
  return <h2 className="m-0 min-w-0 truncate text-lg font-semibold tracking-tight">{children}</h2>;
}

export function DetailEmpty({
  title = "Nothing selected",
  description,
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  /** Optional custom icon node. Defaults to MousePointerClick. */
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-1 flex-col items-center justify-center rounded-2xl bg-card/80 px-8 py-10 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
        {icon ?? <MousePointerClick {...lucideProps("L")} />}
      </div>
      <h3 className="m-0 text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Master–detail content pane. Remounts on selectionKey change. */
export function DetailPane({
  selectionKey,
  empty,
  header,
  children,
  className,
}: {
  selectionKey: string | null;
  empty?: ReactNode;
  /** Sticky chrome above the scroll body when an item is selected. */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const emptyNode =
    empty == null || typeof empty === "string" ? (
      <DetailEmpty title={typeof empty === "string" ? empty : "Select an item"} />
    ) : (
      empty
    );

  return (
    <div className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col pt-3", className)}>
      {!selectionKey ? (
        <div key="empty" className="flex min-h-0 flex-1 flex-col">
          {emptyNode}
        </div>
      ) : (
        <div key={selectionKey} className="flex min-h-0 flex-1 flex-col">
          {header ? <div className="min-w-0 shrink-0 pb-3">{header}</div> : null}
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-10 pe-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

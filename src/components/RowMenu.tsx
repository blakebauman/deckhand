import type { CSSProperties, ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type RowMenuItem = {
  id: string;
  label: string;
  onAction: () => void;
  destructive?: boolean;
};

/**
 * Overflow actions for list rows.
 * When `active` / `onSelect` are set, the highlight fills the full row.
 */
export function RowMenu({
  children,
  items,
  suffix,
  leading,
  active,
  onSelect,
}: {
  children: ReactNode;
  items: RowMenuItem[];
  /** Trailing chrome (badges) — rendered between content and the ⋮ menu. */
  suffix?: ReactNode;
  /** Leading chrome (e.g. checkbox) — sits inside the selection fill. */
  leading?: ReactNode;
  active?: boolean;
  onSelect?: () => void;
}) {
  const selectable = !!onSelect;

  const menuItems: ReactNode[] = [];
  items.forEach((item, i) => {
    if (item.id.startsWith("sep-")) {
      menuItems.push(<DropdownMenuSeparator key={item.id || `sep-${i}`} />);
      return;
    }
    menuItems.push(
      <DropdownMenuItem
        key={item.id}
        variant={item.destructive ? "destructive" : "default"}
        onClick={(e) => {
          e.stopPropagation();
          item.onAction();
        }}
      >
        {item.label}
      </DropdownMenuItem>,
    );
  });

  return (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={cn(
        "flex w-full min-w-0 items-center gap-2",
        selectable &&
          "dh-list-item mb-0 cursor-pointer rounded-lg border-0 px-2 py-1.5 text-start text-foreground",
        selectable && (active ? "dh-list-item-selected bg-muted" : "bg-transparent hover:bg-muted/60"),
      )}
      aria-current={active ? "true" : undefined}
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      data-no-drag
    >
      {leading ? (
        <div
          className="flex shrink-0 items-center pe-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {leading}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
      {suffix ? <div className="flex shrink-0 items-center gap-1">{suffix}</div> : null}
      <div
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">{menuItems}</DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "default" | "accent" | "success" | "muted" | "warn" | "destructive" | "info";

const toneClass: Record<Tone, string> = {
  default: "",
  accent:
    "border-transparent bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  success:
    "border-transparent bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  muted: "border-transparent bg-secondary text-secondary-foreground",
  warn: "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300",
  destructive: "border-transparent bg-destructive/15 text-destructive",
  info: "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

/** Compact semantic status badge for list rows and headers. */
export function StatusBadge({ children, tone = "default" }: { children?: ReactNode; tone?: Tone }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 max-w-36 shrink-0 truncate rounded-md px-1.5 text-[11px] font-medium",
        toneClass[tone],
      )}
    >
      {children}
    </Badge>
  );
}

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { lucideProps } from "@/components/Icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

/** Small info affordance next to labels. */
export function HelpHint({
  label,
  title,
  side = "top",
}: {
  label: ReactNode;
  /** Optional popover title; omit for tip-only content. */
  title?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={title || "More info"}
            className="size-6 text-muted-foreground"
          >
            <Info {...lucideProps("S")} />
          </Button>
        }
      />
      <PopoverContent side={side} className="max-w-xs text-sm">
        {title ? <p className="mb-1 font-semibold">{title}</p> : null}
        <div className="text-muted-foreground">{label}</div>
      </PopoverContent>
    </Popover>
  );
}

import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Placement = "top" | "bottom" | "left" | "right" | "start" | "end";

const sideMap: Record<Placement, "top" | "bottom" | "left" | "right"> = {
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
  start: "left",
  end: "right",
};

/**
 * Tooltip for a single focusable child (button, link, etc.).
 */
export function Tip({
  label,
  children,
  placement = "bottom",
}: {
  label: ReactNode;
  children: ReactElement;
  placement?: Placement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={sideMap[placement]}>{label}</TooltipContent>
    </Tooltip>
  );
}

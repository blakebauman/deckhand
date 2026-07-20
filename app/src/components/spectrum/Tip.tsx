import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipTrigger } from "@react-spectrum/s2";

type Placement = "top" | "bottom" | "left" | "right" | "start" | "end";

/**
 * Spectrum tooltip for a single focusable child (button, link, etc.).
 * No wrapper span — extra inline-flex shells skew alignment next to icon buttons.
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
    <TooltipTrigger placement={placement} delay={400}>
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

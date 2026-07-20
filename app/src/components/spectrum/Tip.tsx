import type { ReactElement } from "react";
import { Tooltip, TooltipTrigger } from "@react-spectrum/s2";

/** Spectrum tooltip for a single focusable child (button, link, etc.). */
export function Tip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
  /** @deprecated Unused — TooltipTrigger placement is fixed. */
  side?: "top" | "bottom" | "left" | "right";
  /** @deprecated Unused — kept for call-site compatibility. */
  delayDuration?: number;
}) {
  return (
    <TooltipTrigger delay={400}>
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

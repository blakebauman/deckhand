import type { ReactNode } from "react";
import { Content, ContextualHelp, Heading } from "@react-spectrum/s2";

const placementMap = {
  top: "top",
  right: "right",
  bottom: "bottom",
  left: "left",
} as const;

/** Small info affordance — Spectrum ContextualHelp next to labels. */
export function HelpHint({
  label,
  title,
  side = "top",
}: {
  label: ReactNode;
  /** Optional popover title; omit for tip-only content. */
  title?: string;
  side?: "top" | "right" | "bottom" | "left";
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
}) {
  return (
    <ContextualHelp variant="info" placement={placementMap[side]} size="XS">
      {title ? <Heading>{title}</Heading> : null}
      <Content>{label}</Content>
    </ContextualHelp>
  );
}

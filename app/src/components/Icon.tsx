import type { LucideIcon, LucideProps } from "lucide-react";

export type IconSize = "S" | "M" | "L";

const SIZE_PX: Record<IconSize, number> = {
  S: 14,
  M: 18,
  L: 22,
};

/** Stroke width tuned to sit next to Spectrum S2 chrome. */
export const ICON_STROKE = 1.75;

/** Shared Lucide props for Deckhand UI (size tokens + stroke). */
export function lucideProps(size: IconSize = "M", extra?: LucideProps): LucideProps {
  return {
    size: SIZE_PX[size],
    strokeWidth: ICON_STROKE,
    "aria-hidden": true,
    ...extra,
  };
}

/** Render a Lucide icon at an S / M / L size token. */
export function Icon({
  icon: Lucide,
  size = "M",
  ...props
}: { icon: LucideIcon; size?: IconSize } & Omit<LucideProps, "ref" | "size">) {
  return <Lucide {...lucideProps(size, props)} />;
}

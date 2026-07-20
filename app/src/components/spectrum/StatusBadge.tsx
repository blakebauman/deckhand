import type { ReactNode } from "react";
import { Badge, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

type Tone = "default" | "accent" | "success" | "muted" | "warn" | "destructive" | "info";

const toneMap: Record<
  Tone,
  "accent" | "positive" | "neutral" | "notice" | "negative" | "informative"
> = {
  default: "neutral",
  accent: "accent",
  success: "positive",
  muted: "neutral",
  // Monotone until green/red — no amber notice for status.
  warn: "neutral",
  destructive: "negative",
  info: "informative",
};

/** Semantic status badge — Spectrum 2 `Badge` with list-safe shrink behavior. */
export function StatusBadge({
  children,
  tone,
  variant,
  fillStyle = "bold",
}: {
  children?: ReactNode;
  tone?: Tone;
  /** @deprecated use tone */
  variant?: Tone;
  fillStyle?: "bold" | "outline" | "subtle";
}) {
  const resolved = tone ?? variant ?? "default";
  return (
    <Badge
      variant={toneMap[resolved]}
      size="S"
      fillStyle={fillStyle}
      overflowMode="truncate"
      styles={style({ flexShrink: 0, maxWidth: 160 })}
    >
      {typeof children === "string" || typeof children === "number" ? <Text>{children}</Text> : children}
    </Badge>
  );
}

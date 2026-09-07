import { cn } from "@/lib/utils";

/** Chromatic only for ok/error — warn is aliased to idle (monotone). */
export type StatusHaloTone = "ok" | "warn" | "error" | "idle";

function resolveTone(tone: StatusHaloTone): "ok" | "error" | "idle" {
  if (tone === "ok") return "ok";
  if (tone === "error") return "error";
  return "idle";
}

const toneBg = {
  ok: "bg-emerald-500",
  error: "bg-red-500",
  idle: "bg-muted-foreground/50",
} as const;

/** Compact status indicator: solid core + optional soft halo when live. */
export function StatusHalo({
  tone = "idle",
  pulse = false,
  className,
  size = "md",
}: {
  tone?: StatusHaloTone;
  pulse?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const t = resolveTone(tone);
  const wrap = size === "sm" ? "size-2" : "size-3";
  const core = size === "sm" ? "size-1.5" : "size-2";
  const halo = size === "sm" ? "size-2" : "size-3";

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", wrap, className)}
      aria-hidden
    >
      {pulse ? (
        <span className={cn("absolute rounded-full opacity-35", halo, toneBg[t])} />
      ) : null}
      <span className={cn("relative inline-flex rounded-full", core, toneBg[t])} />
    </span>
  );
}

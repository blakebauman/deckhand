import { style } from "@react-spectrum/s2/style" with { type: "macro" };

/** Chromatic only for ok/error — warn is aliased to idle (monotone). */
export type StatusHaloTone = "ok" | "warn" | "error" | "idle";

const wrapSm = style({
  position: "relative",
  display: "inline-flex",
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  size: 8,
});

const wrapMd = style({
  position: "relative",
  display: "inline-flex",
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  size: 12,
});

const coreSmOk = style({
  position: "relative",
  display: "inline-flex",
  borderRadius: "full",
  backgroundColor: "positive",
});
const coreSmError = style({
  position: "relative",
  display: "inline-flex",
  borderRadius: "full",
  backgroundColor: "negative",
});
const coreSmIdle = style({
  position: "relative",
  display: "inline-flex",
  borderRadius: "full",
  backgroundColor: "gray-500",
});
const coreMdOk = style({
  position: "relative",
  display: "inline-flex",
  borderRadius: "full",
  size: 8,
  backgroundColor: "positive",
});
const coreMdError = style({
  position: "relative",
  display: "inline-flex",
  borderRadius: "full",
  size: 8,
  backgroundColor: "negative",
});
const coreMdIdle = style({
  position: "relative",
  display: "inline-flex",
  borderRadius: "full",
  size: 8,
  backgroundColor: "gray-500",
});

const haloSmOk = style({
  position: "absolute",
  borderRadius: "full",
  opacity: 0.35,
  size: 8,
  backgroundColor: "positive",
});
const haloSmError = style({
  position: "absolute",
  borderRadius: "full",
  opacity: 0.35,
  size: 8,
  backgroundColor: "negative",
});
const haloSmIdle = style({
  position: "absolute",
  borderRadius: "full",
  opacity: 0.35,
  size: 8,
  backgroundColor: "gray-500",
});
const haloMdOk = style({
  position: "absolute",
  borderRadius: "full",
  opacity: 0.35,
  size: 12,
  backgroundColor: "positive",
});
const haloMdError = style({
  position: "absolute",
  borderRadius: "full",
  opacity: 0.35,
  size: 12,
  backgroundColor: "negative",
});
const haloMdIdle = style({
  position: "absolute",
  borderRadius: "full",
  opacity: 0.35,
  size: 12,
  backgroundColor: "gray-500",
});

function resolveTone(tone: StatusHaloTone): "ok" | "error" | "idle" {
  if (tone === "ok") return "ok";
  if (tone === "error") return "error";
  return "idle";
}

function coreClass(size: "sm" | "md", tone: StatusHaloTone) {
  const t = resolveTone(tone);
  if (size === "sm") {
    if (t === "ok") return coreSmOk;
    if (t === "error") return coreSmError;
    return coreSmIdle;
  }
  if (t === "ok") return coreMdOk;
  if (t === "error") return coreMdError;
  return coreMdIdle;
}

function haloClass(size: "sm" | "md", tone: StatusHaloTone) {
  const t = resolveTone(tone);
  if (size === "sm") {
    if (t === "ok") return haloSmOk;
    if (t === "error") return haloSmError;
    return haloSmIdle;
  }
  if (t === "ok") return haloMdOk;
  if (t === "error") return haloMdError;
  return haloMdIdle;
}

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
  // 6px is not a valid S2 size token — keep the sm core pixel-perfect via inline style.
  const smCoreStyle = size === "sm" ? { width: 6, height: 6 } : undefined;

  return (
    <span
      className={[size === "sm" ? wrapSm : wrapMd, className].filter(Boolean).join(" ")}
      aria-hidden
    >
      {pulse ? <span className={haloClass(size, tone)} /> : null}
      <span className={coreClass(size, tone)} style={smCoreStyle} />
    </span>
  );
}

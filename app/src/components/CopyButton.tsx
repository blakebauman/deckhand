import { useState } from "react";
import { ActionButton, Text, Tooltip, TooltipTrigger } from "@react-spectrum/s2";
import { Check, Copy } from "lucide-react";
import { lucideProps } from "@/components/Icon";

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

/** Compact copy control for IDs, inspect JSON, and console output. */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  iconOnly,
  dark,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
  iconOnly?: boolean;
  /** Prefer quiet static color on dark console chrome */
  dark?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!value) return;
    try {
      await writeClipboard(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  const button = (
    <ActionButton
      aria-label={copied ? copiedLabel : label}
      isQuiet
      isDisabled={!value}
      staticColor={dark ? "white" : undefined}
      onPress={() => void onCopy()}
      data-no-drag
    >
      {copied ? (
        <Check {...lucideProps("S", { color: "var(--spectrum-positive-visual-color, #0e6e3c)" })} />
      ) : (
        <Copy {...lucideProps("S")} />
      )}
      {!iconOnly ? <Text>{copied ? copiedLabel : label}</Text> : null}
    </ActionButton>
  );

  // Disabled controls cannot host tooltips — omit tip when there is nothing to copy.
  if (!value) return button;

  return (
    <TooltipTrigger delay={400} placement="bottom">
      {button}
      <Tooltip>{copied ? copiedLabel : label}</Tooltip>
    </TooltipTrigger>
  );
}

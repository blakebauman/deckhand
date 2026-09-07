import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { lucideProps } from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    <Button
      aria-label={copied ? copiedLabel : label}
      variant="ghost"
      size={iconOnly ? "icon-sm" : "sm"}
      disabled={!value}
      onClick={() => void onCopy()}
      data-no-drag
      className={cn(dark && "text-white hover:bg-white/10 hover:text-white")}
    >
      {copied ? (
        <Check {...lucideProps("S", { color: "#0e6e3c" })} />
      ) : (
        <Copy {...lucideProps("S")} />
      )}
      {!iconOnly ? <span>{copied ? copiedLabel : label}</span> : null}
    </Button>
  );

  if (!value) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="bottom">{copied ? copiedLabel : label}</TooltipContent>
    </Tooltip>
  );
}

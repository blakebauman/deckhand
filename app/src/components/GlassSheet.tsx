import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";

const sizeClass = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

/** Overlay sheet for deploy output, logs, and exec results. */
export function GlassSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "lg",
  mono,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
  mono?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(sizeClass[size], "max-h-[85vh] overflow-hidden flex flex-col")} showCloseButton={!footer}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className={cn("min-h-0 flex-1 overflow-y-auto", mono && "font-mono text-xs")}>{children}</div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Dark output block for build/pull/compose streams in sheets. */
export function TerminalBlock({
  children,
  copyValue,
}: {
  children: ReactNode;
  copyValue?: string;
}) {
  const text = copyValue ?? (typeof children === "string" ? children : "");
  const hasCopyable = Boolean(text.trim());

  return (
    <div className="dh-terminal dh-terminal-block">
      {hasCopyable ? (
        <div className="dh-terminal-block__copy">
          <CopyButton value={text} label="Copy" iconOnly dark />
        </div>
      ) : null}
      <pre className={hasCopyable ? "dh-terminal-block__pre" : "dh-terminal-block__pre is-muted"}>
        {children}
      </pre>
    </div>
  );
}

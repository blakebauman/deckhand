// biome-ignore-all lint/a11y/useSemanticElements: a set of related buttons is
// ARIA role="group"; the rule suggests <fieldset>, which is for grouping form
// controls and would be wrong here.

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Option<T extends string> = {
  id: T;
  label: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
};

/** Compact single-select control for theme, shell, engine mode, etc. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-full bg-muted p-1", className)}
    >
      {options.map((opt) => (
        <Button
          key={opt.id}
          type="button"
          size="sm"
          variant={value === opt.id ? "default" : "ghost"}
          disabled={opt.disabled}
          aria-label={opt["aria-label"]}
          aria-pressed={value === opt.id}
          className="h-7 rounded-full px-3"
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

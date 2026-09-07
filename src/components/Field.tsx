import type { KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Controlled string input with a familiar onChange(string) API. */
export function Field({
  value,
  onChange,
  placeholder,
  isDisabled,
  onKeyDown,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  onKeyDown?: (e: KeyboardEvent) => void;
  "aria-label"?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={isDisabled}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel || placeholder}
      className="w-full"
    />
  );
}

export function Area({
  value,
  onChange,
  placeholder,
  isDisabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={isDisabled}
      aria-label={placeholder}
      className="w-full"
    />
  );
}

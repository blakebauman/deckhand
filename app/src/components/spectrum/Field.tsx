import type { KeyboardEvent } from "react";
import { TextArea, TextField } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

/** Controlled string TextField with a familiar onChange(string) API. */
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
    <TextField
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isDisabled={isDisabled}
      onKeyDown={onKeyDown as never}
      aria-label={ariaLabel || placeholder}
      styles={style({ width: "full" })}
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
    <TextArea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isDisabled={isDisabled}
      aria-label={placeholder}
      styles={style({ width: "full" })}
    />
  );
}

import type { CSSProperties, ReactNode } from "react";
import { ActionMenu, MenuItem, MenuSection, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

export type RowMenuItem = {
  id: string;
  label: string;
  onAction: () => void;
  destructive?: boolean;
};

const rowIdle = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "full",
  minWidth: 0,
  marginBottom: 0,
  borderRadius: "default",
  paddingX: 12,
  paddingY: 12,
  textAlign: "start",
  borderWidth: 0,
  cursor: "pointer",
  backgroundColor: "transparent",
  color: "neutral",
});

const rowSelected = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "full",
  minWidth: 0,
  marginBottom: 0,
  borderRadius: "default",
  paddingX: 12,
  paddingY: 12,
  textAlign: "start",
  borderWidth: 0,
  cursor: "pointer",
  backgroundColor: "gray-200",
  color: "neutral",
});

/**
 * Overflow actions for list rows.
 * When `active` / `onSelect` are set, the highlight fills the full row
 * (leading chrome, content, badges, and ⋮ menu).
 */
export function RowMenu({
  children,
  items,
  suffix,
  leading,
  active,
  onSelect,
}: {
  children: ReactNode;
  items: RowMenuItem[];
  /** Trailing chrome (badges) — rendered between content and the ⋮ menu. */
  suffix?: ReactNode;
  /** Leading chrome (e.g. checkbox) — sits inside the selection fill. */
  leading?: ReactNode;
  active?: boolean;
  onSelect?: () => void;
}) {
  const sections: RowMenuItem[][] = [];
  let current: RowMenuItem[] = [];
  for (const item of items) {
    if (item.id.startsWith("sep-")) {
      if (current.length) {
        sections.push(current);
        current = [];
      }
      continue;
    }
    current.push(item);
  }
  if (current.length) sections.push(current);

  const selectable = !!onSelect;

  return (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      className={[
        selectable ? "dh-list-item" : null,
        selectable && active ? "dh-list-item-selected" : null,
        selectable ? (active ? rowSelected : rowIdle) : undefined,
        !selectable
          ? style({
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "full",
              minWidth: 0,
            })
          : null,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-current={active ? "true" : undefined}
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      data-no-drag
    >
      {leading ? (
        <div
          className={style({
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            paddingEnd: 8,
          })}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {leading}
        </div>
      ) : null}
      <div className={style({ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 })}>
        {children}
      </div>
      {suffix ? (
        <div className={style({ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 })}>{suffix}</div>
      ) : null}
      <div
        className={style({ flexShrink: 0 })}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <ActionMenu aria-label="Actions" isQuiet align="end" size="S">
          {sections.map((section, i) => (
            <MenuSection key={i} aria-label={i === 0 ? "Actions" : `More actions ${i + 1}`}>
              {section.map((item) => (
                <MenuItem key={item.id} id={item.id} textValue={item.label} onAction={item.onAction}>
                  <Text
                    slot="label"
                    styles={item.destructive ? style({ color: "negative" }) : undefined}
                  >
                    {item.label}
                  </Text>
                </MenuItem>
              ))}
            </MenuSection>
          ))}
        </ActionMenu>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { ActionMenu, MenuItem, MenuSection, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

export type RowMenuItem = {
  id: string;
  label: string;
  onAction: () => void;
  destructive?: boolean;
};

/**
 * Overflow actions for list rows.
 * Pass status badges via `suffix` so they sit outside the truncating content column
 * and never clip against the ActionMenu.
 */
export function RowMenu({
  children,
  items,
  suffix,
}: {
  children: ReactNode;
  items: RowMenuItem[];
  /** Trailing chrome (badges) — rendered between content and the ⋮ menu. */
  suffix?: ReactNode;
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

  return (
    <div
      className={style({
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "full",
        minWidth: 0,
      })}
    >
      <div className={style({ flexGrow: 1, minWidth: 0 })}>{children}</div>
      {suffix ? <div className={style({ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 })}>{suffix}</div> : null}
      <div className={style({ flexShrink: 0 })}>
        <ActionMenu aria-label="Actions" isQuiet align="end" size="S">
          {sections.map((section, i) => (
            <MenuSection key={i} aria-label={i === 0 ? "Actions" : `More actions ${i + 1}`}>
              {section.map((item) => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  textValue={item.label}
                  onAction={item.onAction}
                >
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

import { Children, type ReactNode } from "react";
import { Divider, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

/** Section header + divided panel. */
export function SettingSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={style({ marginBottom: 32 })}>
      <Text
        styles={style({
          font: "detail",
          color: "neutral-subdued",
          fontWeight: "bold",
        })}
      >
        {title}
      </Text>
      {description ? (
        <p
          className={style({
            marginTop: 4,
            marginBottom: 12,
            font: "body-xs",
            color: "neutral-subdued",
          })}
        >
          {description}
        </p>
      ) : (
        <div className={style({ marginBottom: 12 })} />
      )}
      <div
        className={style({
          backgroundColor: "layer-1",
          borderRadius: "xl",
          overflow: "hidden",
        })}
      >
        {ChildrenWithDividers(children)}
      </div>
    </section>
  );
}

function ChildrenWithDividers(children: ReactNode) {
  const items = Children.toArray(children);
  return items.map((child, i) => (
    <div key={i}>
      {i > 0 ? <Divider size="S" /> : null}
      {child}
    </div>
  ));
}

/**
 * SettingRow: label left, `action` right, optional `children` full-width below
 * (sliders / multi-line fields). Legacy: `label` + `children` as the right control.
 */
export function SettingRow({
  label,
  title,
  description,
  htmlFor,
  action,
  children,
}: {
  /** @deprecated Prefer `title`. */
  label?: string;
  title?: string;
  description?: string;
  htmlFor?: string;
  /** Right-aligned control (switch, badge, pills). */
  action?: ReactNode;
  /**
   * When `action` is set: full-width content below the label row.
   * When `action` is omitted: treated as the right-aligned control (legacy Deckhand).
   */
  children?: ReactNode;
}) {
  const heading = title || label || "";
  const right = action !== undefined ? action : children;
  const below = action !== undefined ? children : undefined;

  return (
    <div className={style({ paddingX: 20, paddingY: 16 })}>
      <div
        className={style({
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        })}
      >
        <div className={style({ minWidth: 0, flexGrow: 1 })}>
          <label htmlFor={htmlFor}>
            <Text styles={style({ font: "ui", fontWeight: "medium" })}>{heading}</Text>
          </label>
          {description ? (
            <p
              className={style({
                marginTop: 2,
                marginBottom: 0,
                font: "body-xs",
                color: "neutral-subdued",
              })}
            >
              {description}
            </p>
          ) : null}
        </div>
        {right != null ? <div className={style({ flexShrink: 0, maxWidth: "full" })}>{right}</div> : null}
      </div>
      {below != null ? <div className={style({ marginTop: 12 })}>{below}</div> : null}
    </div>
  );
}

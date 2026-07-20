import type { ReactNode } from "react";
import { Divider, Tag, TagGroup, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { CopyButton } from "@/components/CopyButton";

export function InspectFields({
  rows,
}: {
  rows: { label: string; value?: ReactNode; copy?: string; mono?: boolean }[];
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
}) {
  const visible = rows.filter((r) => r.value != null && r.value !== "");
  if (!visible.length) return null;

  return (
    <dl
      className={style({
        backgroundColor: "layer-1",
        borderRadius: "xl",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "gray-200",
        overflow: "hidden",
        margin: 0,
      })}
    >
      {visible.map((r, i) => (
        <div key={r.label}>
          {i > 0 ? <Divider size="S" /> : null}
          <div
            className={style({
              display: "flex",
              alignItems: "start",
              justifyContent: "space-between",
              gap: 12,
              paddingX: 16,
              paddingY: 8,
            })}
          >
            <dt>
              <Text
                styles={style({
                  font: "detail",
                  color: "neutral-subdued",
                  fontWeight: "medium",
                })}
              >
                {r.label}
              </Text>
            </dt>
            <dd
              className={style({
                margin: 0,
                minWidth: 0,
                flexGrow: 1,
                textAlign: "end",
              })}
            >
              <span
                className={style({
                  display: "inline-flex",
                  maxWidth: "full",
                  alignItems: "center",
                  justifyContent: "end",
                  gap: 8,
                })}
              >
                <Text
                  styles={
                    r.mono
                      ? style({
                          font: "code-xs",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        })
                      : style({
                          font: "body-sm",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        })
                  }
                >
                  {r.value}
                </Text>
                {r.copy ? <CopyButton value={r.copy} label="Copy" iconOnly /> : null}
              </span>
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export function LabelChips({ labels }: { labels?: Record<string, string> | null }) {
  const entries = Object.entries(labels || {});
  if (!entries.length) return null;
  return (
    <TagGroup aria-label="Labels" size="S">
      {entries.map(([k, v]) => (
        <Tag key={k} id={`${k}=${v}`} textValue={`${k}=${v}`}>
          {k}={v}
        </Tag>
      ))}
    </TagGroup>
  );
}

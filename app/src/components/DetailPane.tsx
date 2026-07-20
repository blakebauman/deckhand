import type { ReactNode } from "react";
import { Heading, Text } from "@react-spectrum/s2";
import { MousePointerClick } from "lucide-react";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { lucideProps } from "@/components/Icon";

/** Detail title — matches ListPaneTitle (heading-lg) for list/detail alignment. */
export function DetailHeading({ children }: { children: ReactNode }) {
  return (
    <Heading
      styles={style({
        font: "heading-lg",
        margin: 0,
        truncate: true,
        minWidth: 0,
      })}
    >
      {children}
    </Heading>
  );
}

export function DetailEmpty({
  title = "Nothing selected",
  description,
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  /** Optional custom icon node. Defaults to MousePointerClick. */
  icon?: ReactNode;
}) {
  return (
    <div
      className={style({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
        minHeight: 224,
        backgroundColor: "layer-1",
        borderRadius: "xl",
        paddingX: 32,
        paddingY: 40,
        textAlign: "center",
      })}
    >
      <div
        className={style({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          size: 44,
          marginBottom: 16,
          borderRadius: "full",
          borderWidth: 0,
          backgroundColor: "gray-100",
        })}
      >
        {icon ?? <MousePointerClick {...lucideProps("L")} />}
      </div>
      <Heading
        styles={style({
          font: "title-sm",
          margin: 0,
        })}
      >
        {title}
      </Heading>
      {description ? (
        <Text
          styles={style({
            font: "body-sm",
            color: "neutral-subdued",
            display: "block",
            marginTop: 8,
            maxWidth: 384,
          })}
        >
          {description}
        </Text>
      ) : null}
      {action ? (
        <div className={style({ marginTop: 16 })}>{action}</div>
      ) : null}
    </div>
  );
}

/** Master–detail content pane. Remounts on selectionKey change. */
export function DetailPane({
  selectionKey,
  empty,
  header,
  children,
  className,
}: {
  selectionKey: string | null;
  empty?: ReactNode;
  /** Sticky chrome above the scroll body when an item is selected. */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const emptyNode =
    empty == null || typeof empty === "string" ? (
      <DetailEmpty title={typeof empty === "string" ? empty : "Select an item"} />
    ) : (
      empty
    );

  return (
    <div
      className={[
        style({
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          minWidth: 0,
          flexGrow: 1,
          paddingTop: 12,
        }),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!selectionKey ? (
        <div
          key="empty"
          className={style({
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            flexGrow: 1,
          })}
        >
          {emptyNode}
        </div>
      ) : (
        <div
          key={selectionKey}
          className={style({
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            flexGrow: 1,
          })}
        >
          {header ? (
            <div className={style({ flexShrink: 0, paddingBottom: 12, minWidth: 0 })}>{header}</div>
          ) : null}
          {/* Native overflow — Console/Exec need nested scroll. */}
          <div
            className={style({
              minHeight: 0,
              flexGrow: 1,
              overflowY: "auto",
              overflowX: "hidden",
              paddingBottom: 40,
              paddingEnd: 4,
            })}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

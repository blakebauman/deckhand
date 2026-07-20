import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { Heading, SearchField, Text, Skeleton } from "@react-spectrum/s2";
import ViewList from "@react-spectrum/s2/icons/ViewList";
import { style, iconStyle } from "@react-spectrum/s2/style" with { type: "macro" };
import { useWindowDragProps } from "@/components/TitleBarDragRegion";

/** Master list shell (compound pieces + convenience wrapper). */
export function ListPaneRoot({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={[
        style({
          position: "relative",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          height: "full",
          minHeight: 0,
          width: 420,
          maxWidth: 420,
          // Clip only the scroll body — header buttons sit on the end edge and
          // overflow:hidden here shaved their pill / label.
          overflow: "visible",
        }),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={style({
          pointerEvents: "none",
          position: "absolute",
          insetY: 0,
          insetEnd: 0,
          zIndex: 30,
          width: 1,
          backgroundColor: "gray-300",
        })}
      />
      {children}
    </div>
  );
}

export function ListPaneHeader({ className, children }: { className?: string; children: ReactNode }) {
  const drag = useWindowDragProps();
  return (
    <div
      className={[
        style({
          flexShrink: 0,
          zIndex: 20,
          paddingStart: 12,
          paddingEnd: 20,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: "base",
        }),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...drag}
    >
      {children}
    </div>
  );
}

export function ListPaneTitleRow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={[
        style({
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          minWidth: 0,
        }),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function ListPaneTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Heading
      styles={style({
        font: "heading-lg",
        margin: 0,
        paddingX: 4,
        truncate: true,
        minWidth: 0,
        flexGrow: 1,
        flexShrink: 1,
      })}
      UNSAFE_className={className}
    >
      {children}
    </Heading>
  );
}

export function ListPaneActions({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={[
        style({
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginStart: "auto",
          flexShrink: 0,
        }),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function ListPaneSearch({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div data-no-drag style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
      <SearchField
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        styles={style({ width: "full" })}
        UNSAFE_className={className}
      />
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className={style({
        display: "flex",
        flexDirection: "column",
        gap: 8,
      })}
      aria-hidden
    >
      <Skeleton isLoading>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={style({
              backgroundColor: "gray-100",
              borderRadius: "lg",
              paddingX: 12,
              paddingY: 12,
            })}
            style={{ opacity: 1 - i * 0.1 }}
          >
            <Text styles={style({ font: "ui", display: "block", marginBottom: 8 })}>
              Loading item title placeholder
            </Text>
            <Text styles={style({ font: "body-xs", display: "block" })}>
              Secondary loading detail line
            </Text>
          </div>
        ))}
      </Skeleton>
    </div>
  );
}

export function ListEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={style({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        paddingX: 16,
        paddingY: 48,
        textAlign: "center",
      })}
    >
      <div
        className={style({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          size: 36,
          marginBottom: 4,
          borderRadius: "full",
          backgroundColor: "gray-100",
        })}
      >
        <ViewList styles={iconStyle({ size: "M", color: "neutral" })} />
      </div>
      <Text styles={style({ font: "title-sm" })}>{title}</Text>
      {description ? (
        <Text
          styles={style({
            font: "body-xs",
            color: "neutral-subdued",
            maxWidth: 256,
          })}
        >
          {description}
        </Text>
      ) : null}
      {action ? <div className={style({ marginTop: 8 })}>{action}</div> : null}
    </div>
  );
}

export function ListPaneScroll({
  className,
  contentClassName,
  style: inlineStyle,
  children,
  empty,
  loading,
}: {
  className?: string;
  /** @deprecated Unused — header is no longer absolutely positioned. */
  contentClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
  empty?: ReactNode;
  loading?: boolean;
  /** @deprecated Unused — header is no longer absolutely positioned. */
  hasSearch?: boolean;
}) {
  const hasItems = Array.isArray(children)
    ? children.length > 0
    : children != null && children !== false;

  return (
    <div
      className={[
        style({
          height: "full",
          minHeight: 0,
          flexGrow: 1,
          overflowX: "hidden",
          overflowY: "auto",
          paddingStart: 8,
          paddingEnd: 16,
        }),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={inlineStyle}
    >
      <div
        className={style({
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingBottom: 32,
        })}
      >
        {loading ? (
          <ListSkeleton />
        ) : hasItems ? (
          children
        ) : (
          <div className={style({ paddingX: 4 })}>
            {typeof empty === "string" || empty == null ? (
              <ListEmpty title={typeof empty === "string" ? empty : "Nothing here yet"} />
            ) : (
              empty
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Convenience API used by existing pages. */
export function ListPane({
  title,
  actions,
  children,
  className,
  search,
  empty,
  loading,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  empty?: ReactNode;
  loading?: boolean;
}) {
  return (
    <ListPaneRoot className={className}>
      <ListPaneHeader>
        <ListPaneTitleRow>
          <ListPaneTitle>{title}</ListPaneTitle>
          {actions ? <ListPaneActions>{actions}</ListPaneActions> : null}
        </ListPaneTitleRow>
        {search ? (
          <ListPaneSearch
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
          />
        ) : null}
      </ListPaneHeader>
      <ListPaneScroll hasSearch={!!search} empty={empty} loading={loading}>
        {children}
      </ListPaneScroll>
    </ListPaneRoot>
  );
}

const listItemIdle = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
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

const listItemSelected = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
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

export const ListItem = forwardRef<
  HTMLDivElement,
  {
    active?: boolean;
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    children: React.ReactNode;
    className?: string;
  }
>(function ListItem({ active, onClick, onContextMenu, children, className }, ref) {
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onContextMenu={onContextMenu}
      className={[
        "dh-list-item",
        active ? "dh-list-item-selected" : null,
        active ? listItemSelected : listItemIdle,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-current={active ? "true" : undefined}
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      data-no-drag
    >
      {children}
    </div>
  );
});

import type { ReactNode } from "react";
import {
  ButtonGroup,
  Content,
  Dialog,
  DialogContainer,
  Heading,
  Header,
  Text,
} from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { CopyButton } from "@/components/CopyButton";

const sizeMap = {
  md: "M",
  lg: "L",
  xl: "XL",
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
    <DialogContainer onDismiss={() => onOpenChange(false)}>
      {open ? (
        <Dialog size={sizeMap[size]} isDismissible={!footer}>
          {() => (
            <>
              <Heading slot="title">{title}</Heading>
              {description ? (
                <Header>
                  <Text
                    styles={style({
                      font: "body-sm",
                      color: "neutral-subdued",
                    })}
                  >
                    {description}
                  </Text>
                </Header>
              ) : null}
              <Content>
                <div
                  className={
                    mono
                      ? style({
                          font: "code-xs",
                        })
                      : undefined
                  }
                >
                  {children}
                </div>
              </Content>
              {footer ? <ButtonGroup>{footer}</ButtonGroup> : null}
            </>
          )}
        </Dialog>
      ) : null}
    </DialogContainer>
  );
}

export function TerminalBlock({
  children,
  copyValue,
}: {
  children: ReactNode;
  /** @deprecated Unused — kept for call-site compatibility. */
  className?: string;
  copyValue?: string;
}) {
  const text = copyValue ?? (typeof children === "string" ? children : "");
  return (
    <div className={style({ position: "relative" })}>
      {text ? (
        <div
          className={style({
            position: "absolute",
            top: 8,
            insetEnd: 8,
            zIndex: 1,
          })}
        >
          <CopyButton value={text} label="Copy" dark />
        </div>
      ) : null}
      <pre
        className={
          text
            ? style({
                maxHeight: "50vh",
                overflow: "auto",
                borderRadius: "xl",
                backgroundColor: "black",
                padding: 16,
                paddingTop: 44,
                font: "code-xs",
                color: "chartreuse-400",
              })
            : style({
                maxHeight: "50vh",
                overflow: "auto",
                borderRadius: "xl",
                backgroundColor: "black",
                padding: 16,
                font: "code-xs",
                color: "chartreuse-400",
              })
        }
      >
        {children}
      </pre>
    </div>
  );
}

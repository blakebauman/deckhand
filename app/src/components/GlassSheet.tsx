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

/** Dark output block for build/pull/compose streams in sheets. */
export function TerminalBlock({
  children,
  copyValue,
}: {
  children: ReactNode;
  copyValue?: string;
}) {
  const text = copyValue ?? (typeof children === "string" ? children : "");
  const hasCopyable = Boolean(text.trim());

  return (
    <div className="dh-terminal dh-terminal-block">
      {hasCopyable ? (
        <div className="dh-terminal-block__copy">
          <CopyButton value={text} label="Copy" iconOnly dark />
        </div>
      ) : null}
      <pre className={hasCopyable ? "dh-terminal-block__pre" : "dh-terminal-block__pre is-muted"}>
        {children}
      </pre>
    </div>
  );
}

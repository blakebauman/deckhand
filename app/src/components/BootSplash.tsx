import { Heading, ProgressCircle, Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import { LogoMark } from "@/components/Logo";

export function BootSplash({ message = "Starting sidecar…" }: { message?: string }) {
  return (
    <div
      className={style({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        height: "screen",
        overflow: "hidden",
        backgroundColor: "base",
      })}
    >
      <LogoMark size={88} alt="Deckhand" />
      <div
        className={style({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          textAlign: "center",
        })}
      >
        <Heading
          styles={style({
            font: "heading-lg",
            margin: 0,
          })}
        >
          Deckhand
        </Heading>
        <div
          className={style({
            display: "flex",
            alignItems: "center",
            gap: 12,
          })}
        >
          <ProgressCircle aria-label={message} isIndeterminate size="S" />
          <Text
            styles={style({
              font: "body-sm",
              color: "neutral-subdued",
            })}
          >
            {message}
          </Text>
        </div>
      </div>
    </div>
  );
}

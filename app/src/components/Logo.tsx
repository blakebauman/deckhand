import { Text } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };
import markUrl from "@/assets/brand/mark.svg";
import markMonoUrl from "@/assets/brand/mark-mono.svg";

/** Deckhand mark tile (Adobe red + white anchor). */
export function LogoMark({
  size = 36,
  alt = "Deckhand",
  className,
}: {
  size?: number;
  alt?: string;
  /** Optional passthrough; prefer `size` over Tailwind utility classes. */
  className?: string;
}) {
  return (
    <img
      src={markUrl}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      className={
        className ??
        style({
          flexShrink: 0,
          display: "block",
        })
      }
    />
  );
}

/** Monochrome mark for currentColor contexts. */
export function LogoMarkMono({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={markMonoUrl}
      alt=""
      width={size}
      height={size}
      draggable={false}
      aria-hidden
      className={
        className ??
        style({
          flexShrink: 0,
          display: "block",
        })
      }
    />
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        style({
          display: "flex",
          alignItems: "center",
          gap: 12,
        })
      }
    >
      <LogoMark size={36} />
      <div>
        <Text
          styles={style({
            font: "title",
            display: "block",
          })}
        >
          Deckhand
        </Text>
        <Text
          styles={style({
            font: "detail-sm",
            color: "neutral-subdued",
            display: "block",
            marginTop: 4,
          })}
        >
          Local container ops
        </Text>
      </div>
    </div>
  );
}

import markUrl from "@/assets/brand/mark.svg";
import markMonoUrl from "@/assets/brand/mark-mono.svg";
import { cn } from "@/lib/utils";

/** Deckhand mark tile (Obsidian violet + white anchor). */
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
      className={cn("block shrink-0", className)}
    />
  );
}

/** Monochrome mark for currentColor contexts. */
export function LogoMarkMono({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <img
      src={markMonoUrl}
      alt=""
      width={size}
      height={size}
      draggable={false}
      aria-hidden
      className={cn("block shrink-0", className)}
    />
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={36} />
      <div>
        <span className="block text-base font-semibold">Deckhand</span>
        <span className="mt-1 block text-xs text-muted-foreground">Local container ops</span>
      </div>
    </div>
  );
}

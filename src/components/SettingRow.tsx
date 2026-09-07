import { Children, type ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

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
    <section className="mb-5">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </span>
      {description ? (
        <p className="mt-1 mb-2 text-xs text-muted-foreground">{description}</p>
      ) : (
        <div className="mb-2" />
      )}
      <div className="overflow-hidden rounded-2xl bg-card">{ChildrenWithDividers(children)}</div>
    </section>
  );
}

function ChildrenWithDividers(children: ReactNode) {
  const items = Children.toArray(children);
  return items.map((child, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: dividers are positional by definition
    <div key={i}>
      {i > 0 ? <Separator /> : null}
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
    <div className="px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={htmlFor}>
            <span className="text-sm font-medium">{heading}</span>
          </label>
          {description ? (
            <p className="mt-0.5 mb-0 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {right != null ? <div className="max-w-full shrink-0">{right}</div> : null}
      </div>
      {below != null ? <div className="mt-2">{below}</div> : null}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared visual model for activity feeds.
 *
 * Presentation only — Dashboard and Reports keep their own data shapes,
 * label logic and expansion behaviour.
 *
 * `compact`  — dense dashboard feed, description inlined after the title.
 * `detailed` — reports log, description on its own line plus optional
 *              expandable details rendered as `children`.
 */
export function ActivityItem({
  title,
  description,
  meta,
  timestamp,
  trailing,
  children,
  density = "compact",
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Actor line + related links. */
  meta?: ReactNode;
  timestamp?: ReactNode;
  /** Right-aligned control, e.g. an expand toggle. */
  trailing?: ReactNode;
  children?: ReactNode;
  density?: "compact" | "detailed";
  className?: string;
}) {
  const detailed = density === "detailed";

  return (
    <li className={cn("flex gap-2.5", detailed ? "py-3" : "py-2", className)}>
      <span
        className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60")}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 leading-snug">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-sm font-medium text-foreground">
            {title}
            {description && !detailed && (
              <span className="font-normal text-muted-foreground"> — {description}</span>
            )}
          </p>
          {(timestamp || trailing) && (
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {timestamp}
              {trailing}
            </div>
          )}
        </div>
        {description && detailed && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        {meta && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {meta}
          </p>
        )}
        {children}
      </div>
    </li>
  );
}

/** Wrapper giving feeds consistent separators. */
export function ActivityFeed({
  children,
  className,
  bordered = true,
}: {
  children: ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <ol
      className={cn(
        "divide-y divide-border",
        bordered && "border-y border-border",
        className,
      )}
    >
      {children}
    </ol>
  );
}

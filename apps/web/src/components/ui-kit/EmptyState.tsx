import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable empty state.
 *
 * `compact` (default) — healthy / expected emptiness. A thin dashed strip.
 * `full` — only when the empty condition genuinely dominates the page.
 */
export function EmptyState({
  variant = "compact",
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: {
  variant?: "compact" | "full";
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <div
        role="status"
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-dashed border-border bg-surface-muted px-3.5 py-2.5",
          className,
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description && (
          <span className="text-[13px] text-muted-foreground">{description}</span>
        )}
        {(action || secondaryAction) && (
          <span className="ml-auto flex items-center gap-2">
            {action}
            {secondaryAction}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <p className="text-[15px] font-semibold tracking-tight text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

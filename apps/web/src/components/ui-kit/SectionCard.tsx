import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Restrained container for a meaningful grouped concept.
 * Do not nest SectionCards, and do not use it as a generic wrapper.
 */
export function SectionCard({
  id,
  title,
  description,
  action,
  children,
  footer,
  className,
  bodyClassName,
  padded = true,
}: {
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Set false when the body is a full-bleed table or list. */
  padded?: boolean;
}) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <Card
      className={cn("gap-0 overflow-hidden border-border/70 py-0 shadow-xs", className)}
      aria-labelledby={headingId}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2
                id={headingId}
                className="text-[15px] font-semibold tracking-tight text-foreground"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(padded && "px-4 py-3.5", bodyClassName)}>{children}</div>
      {footer && (
        <div className="border-t border-border/70 bg-surface-muted px-4 py-2.5 text-[13px] text-muted-foreground">
          {footer}
        </div>
      )}
    </Card>
  );
}

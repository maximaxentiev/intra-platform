import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PropertyItem = {
  label: string;
  /** Rendered value. Falls back to `emptyText` when nullish or empty string. */
  value?: ReactNode;
  /** Renders the value as an internal link. */
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  /** Renders the value as an external link. */
  href?: string;
  className?: string;
};

/**
 * Accessible label/value display for detail screens.
 * Uses a real <dl> so screen readers announce term/definition pairs.
 */
export function PropertyList({
  items,
  columns = 2,
  emptyText = "—",
  className,
}: {
  items: PropertyItem[];
  columns?: 1 | 2 | 3;
  emptyText?: string;
  className?: string;
}) {
  const cols = {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
  } as const;

  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3.5", cols[columns], className)}>
      {items.map((item) => {
        const hasValue =
          item.value !== null && item.value !== undefined && item.value !== "";
        let rendered: ReactNode = hasValue ? item.value : (
          <span className="text-muted-foreground">{emptyText}</span>
        );

        if (hasValue && item.to) {
          rendered = (
            <Link
              to={item.to as never}
              params={item.params as never}
              search={item.search as never}
              className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.value}
            </Link>
          );
        } else if (hasValue && item.href) {
          rendered = (
            <a
              href={item.href}
              className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.value}
            </a>
          );
        }

        return (
          <div key={item.label} className={cn("min-w-0", item.className)}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-1 flex min-w-0 flex-wrap items-center gap-2 break-words text-sm text-foreground">
              {rendered}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MetricTile } from "@/components/ui-kit/MetricTile";

/** Section wrapper giving every Dashboard block the same heading rhythm. */
export function DashboardSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={cn("space-y-3", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2
            id={`${id}-heading`}
            className="text-[15px] font-semibold tracking-tight text-foreground"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Compact metric tile. Renders as a link when `to` is provided. */
export function DashboardMetric({
  label,
  value,
  icon,
  to,
  search,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  /** Optional — Today cards intentionally render without decorative icons. */
  icon?: ComponentType<{ className?: string }>;

  to?: string;
  search?: Record<string, unknown>;
  tone?: "neutral" | "primary" | "warning" | "success";
}) {
  return (
    <MetricTile
      layout="tile"
      label={label}
      value={value}
      icon={icon}
      tone={tone}
      to={to}
      search={search}
    />
  );
}


export function DashboardFooterLink({
  to,
  search,
  params,
  children,
}: {
  to: string;
  search?: Record<string, unknown>;
  params?: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <Link
      to={to as any}
      search={search as any}
      params={params as any}
      className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {children} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

export function DashboardEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-3.5 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard</span>
      <Card className="border-border/70 p-4 shadow-xs">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
        ))}
      </div>
      <Card className="border-border/70 p-4 shadow-xs">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-xl" />
        ))}
      </div>
      <Card className="border-border/70 p-4 shadow-xs">
        <Skeleton className="h-4 w-36" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

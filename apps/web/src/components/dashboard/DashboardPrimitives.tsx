import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
            className="text-base font-semibold tracking-tight text-foreground"
          >
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
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
  icon: Icon,
  to,
  search,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  to?: string;
  search?: Record<string, unknown>;
  tone?: "neutral" | "primary" | "warning" | "success";
}) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
  } as const;

  const inner = (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {value}
        </div>
      </div>
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tones[tone])}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
  );

  if (!to) {
    return <Card className="border-border/70 py-0 shadow-xs">{inner}</Card>;
  }

  return (
    <Link
      to={to as any}
      search={search as any}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="border-border/70 py-0 shadow-xs transition-all group-hover:border-primary/40 group-hover:shadow-sm group-active:translate-y-px">
        {inner}
      </Card>
    </Link>
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
    <div className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-6 text-center">
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

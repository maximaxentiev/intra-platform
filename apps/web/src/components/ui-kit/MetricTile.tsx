import { Link } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type MetricTone = "neutral" | "primary" | "warning" | "success" | "info" | "muted";

export const METRIC_TONE_CLASSES: Record<MetricTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
};

/**
 * Shared metric visual primitive behind DashboardMetric and ReportMetricCard.
 *
 * `layout="tile"`  — dense dashboard tile with optional trailing icon.
 * `layout="card"`  — report card with a tone-chipped label above the value.
 */
export function MetricTile({
  label,
  value,
  supportingText,
  icon: Icon,
  tone = "neutral",
  layout = "tile",
  loading,
  to,
  search,
  params,
  className,
}: {
  label: string;
  value: number | string;
  supportingText?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: MetricTone;
  layout?: "tile" | "card";
  loading?: boolean;
  to?: string;
  search?: Record<string, unknown>;
  params?: Record<string, string>;
  className?: string;
}) {
  const body =
    layout === "card" ? (
      <div className="p-4">
        <div
          className={cn(
            "inline-flex rounded-lg px-2 py-1 text-xs font-medium",
            tone === "neutral" ? "bg-muted text-foreground" : METRIC_TONE_CLASSES[tone],
          )}
        >
          {label}
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-9 w-20" />
        ) : (
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
        )}
        {supportingText && !loading && (
          <p className="mt-1 text-[13px] text-muted-foreground">{supportingText}</p>
        )}
      </div>
    ) : (
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {value}
            </div>
          )}
          {supportingText && !loading && (
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{supportingText}</p>
          )}
        </div>
        {Icon && (
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
              METRIC_TONE_CLASSES[tone],
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
    );

  if (!to) {
    return (
      <Card className={cn("border-border/70 py-0 shadow-xs", className)}>{body}</Card>
    );
  }

  return (
    <Link
      to={to as never}
      search={search as never}
      params={params as never}
      className={cn(
        "group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <Card className="border-border/70 py-0 shadow-xs transition-all group-hover:border-primary/40 group-hover:shadow-sm group-active:translate-y-px">
        {body}
      </Card>
    </Link>
  );
}

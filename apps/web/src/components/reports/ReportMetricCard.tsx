import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MetricTile } from "@/components/ui-kit/MetricTile";
import { cn } from "@/lib/utils";

/** Report metric card — thin wrapper over the shared MetricTile primitive. */
export function ReportMetricCard({
  label,
  value,
  loading,
  tone = "default",
}: {
  label: string;
  value: string | number;
  loading?: boolean;
  tone?: "default" | "primary" | "warning" | "success" | "muted";
}) {
  return (
    <MetricTile
      layout="card"
      label={label}
      value={value}
      loading={loading}
      tone={tone === "default" ? "neutral" : tone}
    />
  );
}

export function ReportMetricGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>{children}</div>;
}

export type { LucideIcon };

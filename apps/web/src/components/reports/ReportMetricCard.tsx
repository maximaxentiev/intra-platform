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
  plainLabel = false,
  supportingText,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
  plainLabel?: boolean;
  supportingText?: string;
  tone?: "default" | "primary" | "warning" | "success" | "muted" | "info" | "destructive";
}) {
  return (
    <MetricTile
      layout="card"
      label={label}
      value={value}
      loading={loading}
      plainLabel={plainLabel}
      supportingText={supportingText}
      tone={
        tone === "default"
          ? "neutral"
          : tone === "destructive"
            ? "destructive"
            : tone
      }
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

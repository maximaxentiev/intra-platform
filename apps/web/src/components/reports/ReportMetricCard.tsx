import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  const tones = {
    default: "bg-muted text-foreground",
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    muted: "bg-muted text-muted-foreground",
  } as const;

  return (
    <Card className="border-border/70 shadow-xs">
      <CardContent className="p-4">
        <div className={`inline-flex rounded-lg px-2 py-1 text-xs font-medium ${tones[tone]}`}>
          {label}
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-9 w-20" />
        ) : (
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
        )}
      </CardContent>
    </Card>
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

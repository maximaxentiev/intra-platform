import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Shape-matched loading primitives. Never a large central spinner. */

function Busy({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className} aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Rows matching a list or data table body. */
export function ListLoading({
  rows = 6,
  className,
  label = "Loading results",
}: {
  rows?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Busy label={label} className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </Busy>
  );
}

/** Header + two-column body matching a detail screen. */
export function DetailLoadingState({ className }: { className?: string }) {
  return (
    <Busy label="Loading details" className={cn("space-y-6", className)}>
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40 md:col-span-1" />
        <Skeleton className="h-40 md:col-span-2" />
      </div>
    </Busy>
  );
}

/** A single card/section placeholder. */
export function SectionLoading({
  rows = 3,
  className,
  label = "Loading section",
}: {
  rows?: number;
  className?: string;
  label?: string;
}) {
  return (
    <Busy label={label} className={className}>
      <Card className="border-border/70 p-4 shadow-xs">
        <Skeleton className="h-4 w-36" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </Busy>
  );
}

/** Row of metric tiles. */
export function MetricsLoading({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <Busy
      label="Loading metrics"
      className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
      ))}
    </Busy>
  );
}

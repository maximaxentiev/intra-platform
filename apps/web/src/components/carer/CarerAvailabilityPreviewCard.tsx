import {
  formatAvailabilityWindowDisplay,
  formatDashboardAvailabilityDateLabel,
} from "@/lib/carer-availability-dates";
import { cn } from "@/lib/utils";

type CarerAvailabilityPreviewCardProps = {
  calendarDate: string;
  windows: Array<{ startTime: string; endTime: string }>;
  className?: string;
};

export function CarerAvailabilityPreviewCard({
  calendarDate,
  windows,
  className,
}: CarerAvailabilityPreviewCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-xs",
        className,
      )}
    >
      <p className="text-sm font-semibold text-muted-foreground">Date</p>
      <p className="mt-1 text-base font-medium text-foreground">
        {formatDashboardAvailabilityDateLabel(calendarDate)}
      </p>
      <div aria-hidden="true" className="my-3 h-px bg-border" />
      <p className="text-sm font-semibold text-muted-foreground">Time</p>
      <p className="mt-1 text-base font-medium tabular-nums text-foreground">
        {windows
          .map((window) => formatAvailabilityWindowDisplay(window.startTime, window.endTime))
          .join(", ")}
      </p>
    </div>
  );
}

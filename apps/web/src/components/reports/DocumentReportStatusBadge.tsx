import { AlertCircle, CalendarClock, CalendarX2, CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  documentReportStatusLabel,
  type DocumentReportStatus,
} from "@/lib/reports-document-labels";

const pillBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap";

const STATUS_TONES: Record<
  DocumentReportStatus,
  { cls: string; icon: typeof Circle }
> = {
  not_submitted: { cls: "bg-muted text-muted-foreground border-border", icon: Circle },
  pending_review: { cls: "bg-info-soft text-info border-info/25", icon: Clock },
  approved: { cls: "bg-success-soft text-success border-success/25", icon: CheckCircle2 },
  issue_flagged: { cls: "bg-destructive/8 text-destructive border-destructive/30", icon: AlertCircle },
  expiring_soon: { cls: "bg-warning-soft text-warning border-warning/30", icon: CalendarClock },
  expired: { cls: "bg-destructive/8 text-destructive border-destructive/30", icon: CalendarX2 },
};

export function DocumentReportStatusBadge({
  status,
  optional,
  className,
}: {
  status: DocumentReportStatus;
  optional?: boolean;
  className?: string;
}) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.not_submitted;
  const Icon = tone.icon;
  const label = documentReportStatusLabel(status, optional);

  return (
    <span className={cn(pillBase, tone.cls, className)} title={label}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}

export function OverallComplianceBadge({
  status,
  className,
}: {
  status: "needs_attention" | "expiring_soon" | "compliant";
  className?: string;
}) {
  const map = {
    needs_attention: STATUS_TONES.pending_review,
    expiring_soon: STATUS_TONES.expiring_soon,
    compliant: STATUS_TONES.approved,
  } as const;
  const tone = map[status];
  const Icon = tone.icon;
  const label =
    status === "needs_attention"
      ? "Pending Review"
      : status === "expiring_soon"
        ? "Expiring Soon"
        : "Approved";

  return (
    <span className={cn(pillBase, tone.cls, className)} title={label}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}

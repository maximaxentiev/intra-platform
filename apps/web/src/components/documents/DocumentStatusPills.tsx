import { AlertCircle, CalendarClock, CalendarX2, CheckCircle2, Circle, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { expiryDisplayLabel, reviewStatusLabel } from "@/lib/carer-documents";

const pillBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap";

const REVIEW_TONES: Record<string, { cls: string; icon: typeof Circle }> = {
  not_submitted: { cls: "bg-muted text-muted-foreground border-border", icon: Circle },
  pending_review: { cls: "bg-info-soft text-info border-info/25", icon: Clock },
  approved: { cls: "bg-success-soft text-success border-success/25", icon: CheckCircle2 },
  issue_flagged: { cls: "bg-destructive/8 text-destructive border-destructive/30", icon: AlertCircle },
};

const EXPIRY_TONES: Record<string, { cls: string; icon: typeof Circle }> = {
  current: { cls: "bg-success-soft/60 text-success border-success/20", icon: ShieldCheck },
  expiring_soon: { cls: "bg-warning-soft text-warning border-warning/30", icon: CalendarClock },
  expired: { cls: "bg-destructive/8 text-destructive border-destructive/30", icon: CalendarX2 },
};

/** Review status of the current submission (distinct from expiry status). */
export function ReviewStatusPill({ status, className }: { status: string; className?: string }) {
  const tone = REVIEW_TONES[status] ?? REVIEW_TONES.not_submitted;
  const Icon = tone.icon;
  const label = reviewStatusLabel(status);
  return (
    <span className={cn(pillBase, tone.cls, className)} title={`Review status: ${label}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="sr-only">Review status: </span>
      {label}
    </span>
  );
}

/** Expiry status derived on the backend (current / expiring soon / expired). */
export function ExpiryStatusPill({ display, className }: { display: string; className?: string }) {
  const label = expiryDisplayLabel(display);
  if (!label) return null;
  const tone = EXPIRY_TONES[display] ?? EXPIRY_TONES.current;
  const Icon = tone.icon;
  return (
    <span className={cn(pillBase, tone.cls, className)} title={`Expiry status: ${label}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="sr-only">Expiry status: </span>
      {label}
    </span>
  );
}

/** Required / optional marker for a document category. */
export function RequirementPill({ required, className }: { required: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        required
          ? "border-primary/25 bg-primary/8 text-primary"
          : "border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {required ? "Required" : "Optional"}
    </span>
  );
}

/** Unsaved local-draft marker. */
export function UnsavedPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        pillBase,
        "border-dashed border-warning/40 bg-warning-soft text-warning",
        className,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warning" />
      Unsaved
    </span>
  );
}

/** Ops-flagged issue note, visually separated from ordinary helper text. */
export function IssueNoteCallout({ note, className }: { note: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3",
        className,
      )}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-destructive">Action required</p>
        <p className="min-w-0 break-words text-sm text-destructive/90">{note}</p>
      </div>
    </div>
  );
}

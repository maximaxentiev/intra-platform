import { cn } from "@/lib/utils";
import {
  staffDocumentListStatusLabel,
  type StaffDocumentListStatus,
} from "@/lib/ops-staff-documents";
import { AlertCircle, CheckCircle2, Circle, Clock } from "lucide-react";

const TONES: Record<
  StaffDocumentListStatus,
  { cls: string; icon: typeof Circle }
> = {
  no_documents_submitted: {
    cls: "bg-muted text-muted-foreground border-border",
    icon: Circle,
  },
  pending_review: {
    cls: "bg-warning-soft text-warning border-warning/25",
    icon: Clock,
  },
  warning: {
    cls: "bg-warning-soft text-warning border-warning/25",
    icon: AlertCircle,
  },
  approved: {
    cls: "bg-success-soft text-success border-success/25",
    icon: CheckCircle2,
  },
};

/** Staff list aggregate document compliance status from the backend. */
export function DocumentStatusBadge({
  status,
  className,
  size = "sm",
}: {
  status: string;
  className?: string;
  size?: "xs" | "sm";
}) {
  const key = status as StaffDocumentListStatus;
  const tone = TONES[key] ?? TONES.no_documents_submitted;
  const Icon = tone.icon;
  const label = staffDocumentListStatusLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        tone.cls,
        size === "xs" ? "text-[10.5px] px-1.5 py-0.5 gap-1" : "text-xs px-2 py-0.5 gap-1.5",
        className,
      )}
      title={`Document status: ${label}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

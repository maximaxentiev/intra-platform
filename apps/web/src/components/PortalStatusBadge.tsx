import { cn } from "@/lib/utils";
import {
  PORTAL_ACCOUNT_STATUS_LABELS,
  type PortalAccountDisplayStatus,
} from "@/lib/portal-account-status";
import { CheckCircle2, Clock, CircleSlash, Circle, AlertCircle } from "lucide-react";

const TONES: Record<PortalAccountDisplayStatus, { cls: string; icon: any }> = {
  no_account: { cls: "bg-muted text-muted-foreground border-border", icon: Circle },
  invited: { cls: "bg-info-soft text-info border-info/25", icon: Clock },
  incomplete: { cls: "bg-warning-soft text-warning border-warning/25", icon: AlertCircle },
  active: { cls: "bg-success-soft text-success border-success/25", icon: CheckCircle2 },
  disabled: { cls: "bg-destructive/10 text-destructive border-destructive/25", icon: CircleSlash },
};

/** Consistent portal-account status pill used in the staff list and profile. */
export function PortalStatusBadge({
  status,
  className,
  size = "sm",
}: {
  status: PortalAccountDisplayStatus;
  className?: string;
  size?: "xs" | "sm";
}) {
  const tone = TONES[status] ?? TONES.no_account;
  const Icon = tone.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        tone.cls,
        size === "xs" ? "text-[10.5px] px-1.5 py-0.5 gap-1" : "text-xs px-2 py-0.5 gap-1.5",
        className,
      )}
      title={`Portal: ${PORTAL_ACCOUNT_STATUS_LABELS[status]}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {PORTAL_ACCOUNT_STATUS_LABELS[status]}
    </span>
  );
}

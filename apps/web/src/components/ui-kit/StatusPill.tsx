import type { ComponentType, ReactNode } from "react";
import { CircleDot, CheckCircle2, XCircle, Clock, Circle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared high-level operational status pill.
 *
 * Use for object lifecycle / account states (Pending, Filled, Completed,
 * Cancelled, Active, Inactive, Disabled, Neutral).
 *
 * Do NOT use for document-workflow semantics — those keep the specialized
 * DocumentPill family in `@/components/documents/DocumentStatusPills`.
 */
export type StatusPillTone =
  | "pending"
  | "filled"
  | "completed"
  | "cancelled"
  | "active"
  | "inactive"
  | "disabled"
  | "neutral";

export type StatusPillSize = "xs" | "sm" | "md";

const TONES: Record<StatusPillTone, { cls: string; icon: ComponentType<{ className?: string }> }> = {
  pending: { cls: "bg-warning-soft text-warning border-warning/25", icon: Clock },
  filled: { cls: "bg-info-soft text-info border-info/25", icon: CircleDot },
  completed: { cls: "bg-success-soft text-success border-success/25", icon: CheckCircle2 },
  cancelled: { cls: "bg-muted text-muted-foreground border-border", icon: XCircle },
  active: { cls: "bg-success-soft text-success border-success/25", icon: CheckCircle2 },
  inactive: { cls: "bg-muted text-muted-foreground border-border", icon: Circle },
  disabled: { cls: "bg-muted text-muted-foreground border-border", icon: Ban },
  neutral: { cls: "bg-muted text-muted-foreground border-border", icon: Circle },
};

/** Resolves an arbitrary status string to a known tone (never throws). */
export function resolveStatusTone(status: string): StatusPillTone {
  return (Object.prototype.hasOwnProperty.call(TONES, status) ? status : "neutral") as StatusPillTone;
}

const SIZES: Record<StatusPillSize, { pill: string; icon: string }> = {
  xs: { pill: "text-[10.5px] px-1.5 py-0.5 gap-1", icon: "h-3 w-3" },
  sm: { pill: "text-xs px-2 py-0.5 gap-1.5", icon: "h-3 w-3" },
  md: { pill: "text-sm px-2.5 py-1 gap-1.5", icon: "h-3.5 w-3.5" },
};

export function StatusPill({
  status,
  children,
  className,
  showIcon = true,
  size = "sm",
}: {
  status: StatusPillTone | string;
  children?: ReactNode;
  className?: string;
  showIcon?: boolean;
  size?: StatusPillSize;
}) {
  const tone = TONES[resolveStatusTone(String(status))];
  const Icon = tone.icon;
  const sizing = SIZES[size];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium capitalize whitespace-nowrap",
        tone.cls,
        sizing.pill,
        className,
      )}
    >
      {/* Icon is decorative: the label always carries the state (no colour-only meaning). */}
      {showIcon && <Icon className={sizing.icon} aria-hidden />}
      {children ?? String(status)}
    </span>
  );
}

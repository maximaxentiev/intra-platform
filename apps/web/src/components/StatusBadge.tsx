import { cn } from "@/lib/utils";
import { CircleDot, CheckCircle2, XCircle, Clock, Circle } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "pending" | "filled" | "completed" | "cancelled" | "active" | "inactive" | "neutral";

const TONES: Record<Tone, { cls: string; icon: any; label?: string }> = {
  pending:   { cls: "bg-warning-soft text-warning border-warning/25", icon: Clock },
  filled:    { cls: "bg-info-soft text-info border-info/25", icon: CircleDot },
  completed: { cls: "bg-success-soft text-success border-success/25", icon: CheckCircle2 },
  cancelled: { cls: "bg-muted text-muted-foreground border-border", icon: XCircle },
  active:    { cls: "bg-success-soft text-success border-success/25", icon: CheckCircle2 },
  inactive:  { cls: "bg-muted text-muted-foreground border-border", icon: Circle },
  neutral:   { cls: "bg-muted text-muted-foreground border-border", icon: Circle },
};

export function StatusBadge({
  status,
  children,
  className,
  showIcon = true,
  size = "sm",
}: {
  status: Tone | string;
  children?: ReactNode;
  className?: string;
  showIcon?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  const tone = (TONES as any)[status] ?? TONES.neutral;
  const Icon = tone.icon;
  const sizeCls =
    size === "xs" ? "text-[10.5px] px-1.5 py-0.5 gap-1"
    : size === "md" ? "text-sm px-2.5 py-1 gap-1.5"
    : "text-xs px-2 py-0.5 gap-1.5";
  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium capitalize whitespace-nowrap",
        tone.cls,
        sizeCls,
        className,
      )}
    >
      {showIcon && <Icon className={iconSize} aria-hidden />}
      {children ?? String(status)}
    </span>
  );
}

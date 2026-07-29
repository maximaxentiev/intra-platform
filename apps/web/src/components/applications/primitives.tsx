import type { ReactNode } from "react";
import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/applications";

const STATUS_CLASSES: Record<ApplicationStatus, string> = {
  new: "bg-info-soft text-info border-info/25",
  contacted: "bg-warning-soft text-warning border-warning/25",
  hired: "bg-success-soft text-success border-success/25",
  rejected: "bg-destructive/10 text-destructive border-destructive/25",
};

export function ApplicationStatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Subtle dash for empty values. */
export function Dash() {
  return <span className="text-muted-foreground/50">—</span>;
}

/** Truncated text with full value available on hover/focus. */
export function Trunc({ value, className }: { value: ReactNode; className?: string }) {
  if (value === null || value === undefined || value === "") return <Dash />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("block truncate outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm", className)}>
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-pre-wrap">{value}</TooltipContent>
    </Tooltip>
  );
}

/** Yes / No / unknown indicator. */
export function YesNo({ value, unknownLabel }: { value: boolean | null; unknownLabel?: string }) {
  if (value === null)
    return unknownLabel ? (
      <span className="text-xs text-muted-foreground">{unknownLabel}</span>
    ) : (
      <Dash />
    );
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        value ? "text-success" : "text-muted-foreground",
      )}
    >
      {value ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {value ? "Yes" : "No"}
    </span>
  );
}

export function Chips({ values, max = 2 }: { values: string[]; max?: number }) {
  if (!values.length) return <Dash />;
  const shown = values.slice(0, max);
  const rest = values.slice(max);
  return (
    <span className="flex items-center gap-1">
      {shown.map((v) => (
        <span
          key={v}
          className="inline-flex max-w-[9rem] truncate rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] text-foreground/80"
        >
          {v}
        </span>
      ))}
      {rest.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="inline-flex rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              +{rest.length}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{rest.join(", ")}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-3 py-2 border-b border-border/60 last:border-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground min-w-0 break-words">{children ?? <Dash />}</dd>
    </div>
  );
}

export function EmptyValue({ children }: { children?: ReactNode }) {
  return <span className="text-muted-foreground/60 inline-flex items-center gap-1"><Minus className="h-3 w-3" />{children}</span>;
}

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FilterChip = {
  id: string;
  /** Short field name, e.g. "Centre". Optional for standalone chips. */
  field?: string;
  /** Human-readable current value, e.g. "TEST CENTRE". */
  label: string;
  onRemove?: () => void;
};

/** Readable, keyboard-accessible summary of active filters. */
export function FilterChipBar({
  chips,
  onClearAll,
  clearAllLabel = "Clear all",
  className,
}: {
  chips: FilterChip[];
  onClearAll?: () => void;
  clearAllLabel?: string;
  className?: string;
}) {
  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} aria-label="Active filters">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 py-1 pl-2.5 pr-1 text-xs"
        >
          <span className="truncate">
            {chip.field && <span className="text-muted-foreground">{chip.field}: </span>}
            <span className="font-medium text-foreground">{chip.label}</span>
          </span>
          {chip.onRemove && (
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter ${chip.field ? `${chip.field}: ` : ""}${chip.label}`}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </span>
      ))}
      {onClearAll && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClearAll}
        >
          {clearAllLabel}
        </Button>
      )}
    </div>
  );
}

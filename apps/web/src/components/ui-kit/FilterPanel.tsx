import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Presentation-only filter shell.
 *
 * It owns no filter state, no URL serialization and no validation — callers
 * keep their existing search-param + Zod logic and just render into the slots.
 */
export function FilterPanel({
  children,
  advanced,
  advancedLabel = "More filters",
  onApply,
  applyLabel = "Apply",
  applyDisabled,
  onClear,
  clearLabel = "Clear all",
  clearDisabled,
  resultContext,
  chips,
  className,
  defaultAdvancedOpen = false,
}: {
  /** Always-visible common filters. */
  children: ReactNode;
  /** Optional advanced filters revealed by a disclosure button. */
  advanced?: ReactNode;
  advancedLabel?: string;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  clearDisabled?: boolean;
  /** e.g. "Showing 1–25 of 312 shifts". */
  resultContext?: ReactNode;
  /** Usually a <FilterChipBar />. */
  chips?: ReactNode;
  className?: string;
  defaultAdvancedOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultAdvancedOpen);
  const advancedId = useId();

  return (
    <Card className={cn("flex max-h-full min-h-0 flex-col gap-0 overflow-hidden border-border/70 p-0 shadow-xs", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>

      {advanced && (
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 px-2 text-muted-foreground hover:text-foreground"
            aria-expanded={open}
            aria-controls={advancedId}
            onClick={() => setOpen((value) => !value)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {advancedLabel}
            <ChevronDown
              className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")}
              aria-hidden
            />
          </Button>
          <div id={advancedId} hidden={!open} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {advanced}
          </div>
        </div>
      )}

      {chips && <div className="mt-2">{chips}</div>}

      </div>

      {(onApply || onClear || resultContext) && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-t border-border/70 px-4 py-2">
          <p className="text-[13px] text-muted-foreground" aria-live="polite">
            {resultContext}
          </p>
          <div className="flex items-center gap-2">
            {onClear && (
              <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={clearDisabled}>
                {clearLabel}
              </Button>
            )}
            {onApply && (
              <Button type="button" size="sm" onClick={onApply} disabled={applyDisabled}>
                {applyLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

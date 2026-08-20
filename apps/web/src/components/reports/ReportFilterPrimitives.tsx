import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ReportMetricRangeFieldsProps = {
  label: string;
  minId: string;
  maxId: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
  inputMode?: "numeric" | "decimal";
};

export function ReportMetricRangeFields({
  label,
  minId,
  maxId,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minPlaceholder = "Min",
  maxPlaceholder = "Max",
  inputMode = "numeric",
}: ReportMetricRangeFieldsProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          id={minId}
          type="text"
          inputMode={inputMode}
          value={minValue}
          onChange={(event) => onMinChange(event.target.value)}
          placeholder={minPlaceholder}
          className="h-9"
          aria-label={`${label} minimum`}
        />
        <Input
          id={maxId}
          type="text"
          inputMode={inputMode}
          value={maxValue}
          onChange={(event) => onMaxChange(event.target.value)}
          placeholder={maxPlaceholder}
          className="h-9"
          aria-label={`${label} maximum`}
        />
      </div>
    </div>
  );
}

type ReportActiveFilterChip = {
  id: string;
  label: string;
  onRemove?: () => void;
};

type ReportActiveFilterChipsProps = {
  chips: ReportActiveFilterChip[];
  onClearAdvanced?: () => void;
};

export function ReportActiveFilterChips({ chips, onClearAdvanced }: ReportActiveFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs"
        >
          {chip.label}
          {chip.onRemove ? (
            <button
              type="button"
              className="rounded-full px-1 text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${chip.label}`}
              onClick={chip.onRemove}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
      {onClearAdvanced ? (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearAdvanced}>
          Clear advanced filters
        </Button>
      ) : null}
    </div>
  );
}

type ReportMoreFiltersSectionProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function ReportMoreFiltersSection({
  open,
  onOpenChange,
  children,
}: ReportMoreFiltersSectionProps) {
  return (
    <div className="space-y-3 border-t border-border/70 pt-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {open ? "Hide filters" : "More filters"}
      </Button>
      {open ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
      ) : null}
    </div>
  );
}

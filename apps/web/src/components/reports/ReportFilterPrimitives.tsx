import { ChevronDown, ChevronUp } from "lucide-react";
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

export function ReportFilterSectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="col-span-full text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h4>;
}

type ReportCheckboxFilterGroupProps = {
  legend: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  values: string[];
  onToggle: (value: string, checked: boolean) => void;
  optionalNotSubmittedLabel?: string;
};

export function ReportCheckboxFilterGroup({
  legend,
  options,
  values,
  onToggle,
  optionalNotSubmittedLabel,
}: ReportCheckboxFilterGroupProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-input"
              checked={values.includes(option.value)}
              onChange={(event) => onToggle(option.value, event.target.checked)}
              aria-label={`${legend}: ${option.label}`}
            />
            <span>
              {optionalNotSubmittedLabel && option.value === "not_submitted"
                ? optionalNotSubmittedLabel
                : option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type ReportDateRangeFieldsProps = {
  label: string;
  fromId: string;
  toId: string;
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

export function ReportDateRangeFields({
  label,
  fromId,
  toId,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: ReportDateRangeFieldsProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={fromId} className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id={fromId}
            type="date"
            value={fromValue}
            onChange={(event) => onFromChange(event.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={toId} className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id={toId}
            type="date"
            value={toValue}
            onChange={(event) => onToChange(event.target.value)}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}

export function ReportMoreFiltersSection({
  open,
  onOpenChange,
  children,
}: ReportMoreFiltersSectionProps) {
  return (
    <div className="space-y-3 border-t border-border/70 pt-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {open ? "Hide filters" : "More filters"}
        {open ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
      {open ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
      ) : null}
    </div>
  );
}

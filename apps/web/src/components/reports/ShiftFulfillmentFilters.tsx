import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Centre } from "@/lib/db";
import { ReportCentreMultiSelect } from "@/components/reports/CentreUsageFilters";
import { ReportFilterRuleBuilder } from "@/components/reports/ReportFilterRuleBuilder";
import {
  SHIFT_FULFILLMENT_METRICS,
  type ReportFilterRule,
} from "@/lib/report-filter-rules";
import {
  centreSelectionLabel,
  type CentreSelectionState,
} from "@/lib/reports-centre-selection";

type ShiftFulfillmentFiltersProps = {
  dateFrom: string;
  dateTo: string;
  centres: Centre[];
  selection: CentreSelectionState;
  rules: ReportFilterRule[];
  validationError: string | null;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSelectionChange: (selection: CentreSelectionState) => void;
  onRulesChange: (rules: ReportFilterRule[]) => void;
  onClearRules: () => void;
  onApply: () => void;
  onReset: () => void;
};

export function ShiftFulfillmentFilters({
  dateFrom,
  dateTo,
  centres,
  selection,
  rules,
  validationError,
  onDateFromChange,
  onDateToChange,
  onSelectionChange,
  onRulesChange,
  onClearRules,
  onApply,
  onReset,
}: ShiftFulfillmentFiltersProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 shadow-xs space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="shift-fulfillment-date-from" className="text-xs font-medium text-muted-foreground">
            From
          </Label>
          <Input
            id="shift-fulfillment-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shift-fulfillment-date-to" className="text-xs font-medium text-muted-foreground">
            To
          </Label>
          <Input
            id="shift-fulfillment-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="shift-fulfillment-centres" className="text-xs font-medium text-muted-foreground">
            Centres
          </Label>
          <ReportCentreMultiSelect
            centres={centres}
            selection={selection}
            onSelectionChange={onSelectionChange}
          />
        </div>
      </div>

      <ReportFilterRuleBuilder
        idPrefix="sf"
        metrics={SHIFT_FULFILLMENT_METRICS}
        rules={rules}
        onRulesChange={onRulesChange}
        onClearRules={onClearRules}
      />

      {validationError ? (
        <p className="text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
        <Button variant="ghost" size="sm" type="button" onClick={onReset}>
          Reset
        </Button>
        <Button size="sm" type="button" onClick={onApply} disabled={Boolean(validationError)}>
          Apply
        </Button>
      </div>
    </div>
  );
}

export { centreSelectionLabel };

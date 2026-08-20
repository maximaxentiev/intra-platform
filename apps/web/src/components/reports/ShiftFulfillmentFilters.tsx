import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Centre } from "@/lib/db";
import { ReportCentreMultiSelect } from "@/components/reports/CentreUsageFilters";
import {
  ReportActiveFilterChips,
  ReportMetricRangeFields,
  ReportMoreFiltersSection,
} from "@/components/reports/ReportFilterPrimitives";
import {
  centreSelectionLabel,
  type CentreSelectionState,
} from "@/lib/reports-centre-selection";

export type ShiftFulfillmentAdvancedFilters = {
  totalShiftsMin: string;
  totalShiftsMax: string;
  fillRateMin: string;
  fillRateMax: string;
  pendingMin: string;
  pendingMax: string;
  filledMin: string;
  filledMax: string;
  completedMin: string;
  completedMax: string;
  cancelledMin: string;
  cancelledMax: string;
};

export const EMPTY_SHIFT_FULFILLMENT_ADVANCED: ShiftFulfillmentAdvancedFilters = {
  totalShiftsMin: "",
  totalShiftsMax: "",
  fillRateMin: "",
  fillRateMax: "",
  pendingMin: "",
  pendingMax: "",
  filledMin: "",
  filledMax: "",
  completedMin: "",
  completedMax: "",
  cancelledMin: "",
  cancelledMax: "",
};

type ShiftFulfillmentFiltersProps = {
  dateFrom: string;
  dateTo: string;
  centres: Centre[];
  selection: CentreSelectionState;
  advanced: ShiftFulfillmentAdvancedFilters;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSelectionChange: (selection: CentreSelectionState) => void;
  onAdvancedChange: (advanced: ShiftFulfillmentAdvancedFilters) => void;
  onApply: () => void;
  onReset: () => void;
  activeAdvancedChips?: Array<{ id: string; label: string; onRemove?: () => void }>;
  onClearAdvanced?: () => void;
};

export function ShiftFulfillmentFilters({
  dateFrom,
  dateTo,
  centres,
  selection,
  advanced,
  onDateFromChange,
  onDateToChange,
  onSelectionChange,
  onAdvancedChange,
  onApply,
  onReset,
  activeAdvancedChips = [],
  onClearAdvanced,
}: ShiftFulfillmentFiltersProps) {
  const [moreOpen, setMoreOpen] = useState(activeAdvancedChips.length > 0);

  function updateAdvanced(patch: Partial<ShiftFulfillmentAdvancedFilters>) {
    onAdvancedChange({ ...advanced, ...patch });
  }

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

      <ReportMoreFiltersSection open={moreOpen} onOpenChange={setMoreOpen}>
        <ReportMetricRangeFields
          label="Total Shifts"
          minId="sf-total-min"
          maxId="sf-total-max"
          minValue={advanced.totalShiftsMin}
          maxValue={advanced.totalShiftsMax}
          onMinChange={(value) => updateAdvanced({ totalShiftsMin: value })}
          onMaxChange={(value) => updateAdvanced({ totalShiftsMax: value })}
        />
        <ReportMetricRangeFields
          label="Fill Rate (%)"
          minId="sf-fill-min"
          maxId="sf-fill-max"
          minValue={advanced.fillRateMin}
          maxValue={advanced.fillRateMax}
          onMinChange={(value) => updateAdvanced({ fillRateMin: value })}
          onMaxChange={(value) => updateAdvanced({ fillRateMax: value })}
          inputMode="decimal"
        />
        <ReportMetricRangeFields
          label="Pending"
          minId="sf-pending-min"
          maxId="sf-pending-max"
          minValue={advanced.pendingMin}
          maxValue={advanced.pendingMax}
          onMinChange={(value) => updateAdvanced({ pendingMin: value })}
          onMaxChange={(value) => updateAdvanced({ pendingMax: value })}
        />
        <ReportMetricRangeFields
          label="Filled"
          minId="sf-filled-min"
          maxId="sf-filled-max"
          minValue={advanced.filledMin}
          maxValue={advanced.filledMax}
          onMinChange={(value) => updateAdvanced({ filledMin: value })}
          onMaxChange={(value) => updateAdvanced({ filledMax: value })}
        />
        <ReportMetricRangeFields
          label="Completed"
          minId="sf-completed-min"
          maxId="sf-completed-max"
          minValue={advanced.completedMin}
          maxValue={advanced.completedMax}
          onMinChange={(value) => updateAdvanced({ completedMin: value })}
          onMaxChange={(value) => updateAdvanced({ completedMax: value })}
        />
        <ReportMetricRangeFields
          label="Cancelled"
          minId="sf-cancelled-min"
          maxId="sf-cancelled-max"
          minValue={advanced.cancelledMin}
          maxValue={advanced.cancelledMax}
          onMinChange={(value) => updateAdvanced({ cancelledMin: value })}
          onMaxChange={(value) => updateAdvanced({ cancelledMax: value })}
        />
      </ReportMoreFiltersSection>

      <ReportActiveFilterChips chips={activeAdvancedChips} onClearAdvanced={onClearAdvanced} />

      <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
        <Button variant="ghost" size="sm" type="button" onClick={onReset}>
          Reset
        </Button>
        <Button size="sm" type="button" onClick={onApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

export { centreSelectionLabel };

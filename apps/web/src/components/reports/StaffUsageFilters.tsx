import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { displayStaff, type Staff } from "@/lib/db";
import { ReportFilterRuleBuilder } from "@/components/reports/ReportFilterRuleBuilder";
import { STAFF_USAGE_METRICS, type ReportFilterRule } from "@/lib/report-filter-rules";
import {
  staffSelectionLabel,
  type StaffSelectionState,
} from "@/lib/reports-staff-selection";
import { cn } from "@/lib/utils";

type ReportStaffMultiSelectProps = {
  staffMembers: Staff[];
  selection: StaffSelectionState;
  onSelectionChange: (selection: StaffSelectionState) => void;
};

export function ReportStaffMultiSelect({
  staffMembers,
  selection,
  onSelectionChange,
}: ReportStaffMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const options = useMemo(
    () =>
      [...staffMembers]
        .map((member) => ({
          id: member.id,
          name: displayStaff(member),
          status: member.status,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [staffMembers],
  );

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.name.toLowerCase().includes(query));
  }, [options, search]);

  const selectedSet = useMemo(
    () => new Set(selection.mode === "subset" ? selection.staffIds : []),
    [selection],
  );

  function selectAllStaff() {
    onSelectionChange({ mode: "all", staffIds: [] });
  }

  function clearSelection() {
    onSelectionChange({ mode: "all", staffIds: [] });
  }

  function toggleStaff(staffId: string, checked: boolean) {
    if (checked) {
      const nextIds =
        selection.mode === "all"
          ? [staffId]
          : [...new Set([...selection.staffIds, staffId])];
      onSelectionChange({ mode: "subset", staffIds: nextIds });
      return;
    }

    const nextIds = selection.staffIds.filter((id) => id !== staffId);
    if (nextIds.length === 0) {
      onSelectionChange({ mode: "all", staffIds: [] });
      return;
    }
    onSelectionChange({ mode: "subset", staffIds: nextIds });
  }

  const triggerLabel = staffSelectionLabel(selection, options);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select staff"
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(var(--radix-popover-trigger-width),calc(100vw-2rem))] p-0"
        align="start"
      >
        <div className="space-y-2 p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search staff..."
              aria-label="Search staff"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={selectAllStaff}>
              Select all
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
              Clear selection
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto border-t border-border/70 p-2">
          {filteredOptions.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No staff found.</p>
          ) : (
            <ul className="space-y-1">
              {filteredOptions.map((option) => {
                const checked = selection.mode === "all" ? false : selectedSet.has(option.id);
                const checkboxId = `report-staff-${option.id}`;
                return (
                  <li key={option.id}>
                    <label
                      htmlFor={checkboxId}
                      className={cn(
                        "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60",
                      )}
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        onCheckedChange={(value) => toggleStaff(option.id, value === true)}
                      />
                      <span className="leading-snug">
                        {option.name}
                        {option.status === "inactive" ? (
                          <span className="ml-2 text-xs text-muted-foreground">Inactive</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type StaffUsageFiltersProps = {
  dateFrom: string;
  dateTo: string;
  staffMembers: Staff[];
  selection: StaffSelectionState;
  rules: ReportFilterRule[];
  validationError: string | null;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSelectionChange: (selection: StaffSelectionState) => void;
  onRulesChange: (rules: ReportFilterRule[]) => void;
  onClearRules: () => void;
  onApply: () => void;
  onReset: () => void;
};

export function StaffUsageFilters({
  dateFrom,
  dateTo,
  staffMembers,
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
}: StaffUsageFiltersProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 shadow-xs space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="staff-usage-date-from" className="text-xs font-medium text-muted-foreground">
            From
          </Label>
          <Input
            id="staff-usage-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-usage-date-to" className="text-xs font-medium text-muted-foreground">
            To
          </Label>
          <Input
            id="staff-usage-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="staff-usage-staff" className="text-xs font-medium text-muted-foreground">
            Staff
          </Label>
          <ReportStaffMultiSelect
            staffMembers={staffMembers}
            selection={selection}
            onSelectionChange={onSelectionChange}
          />
        </div>
      </div>

      <ReportFilterRuleBuilder
        idPrefix="su"
        metrics={STAFF_USAGE_METRICS}
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

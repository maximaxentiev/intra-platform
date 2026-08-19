import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Centre } from "@/lib/db";
import {
  centreSelectionLabel,
  type CentreSelectionState,
} from "@/lib/reports-centre-selection";
import { cn } from "@/lib/utils";

type ReportCentreMultiSelectProps = {
  centres: Centre[];
  selection: CentreSelectionState;
  onSelectionChange: (selection: CentreSelectionState) => void;
};

export function ReportCentreMultiSelect({
  centres,
  selection,
  onSelectionChange,
}: ReportCentreMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const sortedCentres = useMemo(
    () => [...centres].sort((a, b) => a.name.localeCompare(b.name)),
    [centres],
  );

  const filteredCentres = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedCentres;
    return sortedCentres.filter((centre) => centre.name.toLowerCase().includes(query));
  }, [search, sortedCentres]);

  const selectedSet = useMemo(
    () => new Set(selection.mode === "subset" ? selection.centreIds : []),
    [selection],
  );

  function selectAllCentres() {
    onSelectionChange({ mode: "all", centreIds: [] });
  }

  function clearSelection() {
    onSelectionChange({ mode: "all", centreIds: [] });
  }

  function toggleCentre(centreId: string, checked: boolean) {
    if (checked) {
      const nextIds =
        selection.mode === "all"
          ? [centreId]
          : [...new Set([...selection.centreIds, centreId])];
      onSelectionChange({ mode: "subset", centreIds: nextIds });
      return;
    }

    const nextIds = selection.centreIds.filter((id) => id !== centreId);
    if (nextIds.length === 0) {
      onSelectionChange({ mode: "all", centreIds: [] });
      return;
    }
    onSelectionChange({ mode: "subset", centreIds: nextIds });
  }

  const triggerLabel = centreSelectionLabel(selection, centres);

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
          aria-label="Select centres"
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
              placeholder="Search centres..."
              aria-label="Search centres"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={selectAllCentres}>
              Select all
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
              Clear selection
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto border-t border-border/70 p-2">
          {filteredCentres.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No centres found.</p>
          ) : (
            <ul className="space-y-1">
              {filteredCentres.map((centre) => {
                const checked = selection.mode === "all" ? false : selectedSet.has(centre.id);
                const checkboxId = `report-centre-${centre.id}`;
                return (
                  <li key={centre.id}>
                    <label
                      htmlFor={checkboxId}
                      className={cn(
                        "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60",
                      )}
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        onCheckedChange={(value) => toggleCentre(centre.id, value === true)}
                      />
                      <span className="leading-snug">{centre.name}</span>
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

type CentreUsageFiltersProps = {
  dateFrom: string;
  dateTo: string;
  centres: Centre[];
  selection: CentreSelectionState;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSelectionChange: (selection: CentreSelectionState) => void;
  onApply: () => void;
  onReset: () => void;
};

export function CentreUsageFilters({
  dateFrom,
  dateTo,
  centres,
  selection,
  onDateFromChange,
  onDateToChange,
  onSelectionChange,
  onApply,
  onReset,
}: CentreUsageFiltersProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 shadow-xs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="centre-usage-date-from" className="text-xs font-medium text-muted-foreground">
            From
          </Label>
          <Input
            id="centre-usage-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="centre-usage-date-to" className="text-xs font-medium text-muted-foreground">
            To
          </Label>
          <Input
            id="centre-usage-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="centre-usage-centres" className="text-xs font-medium text-muted-foreground">
            Centres
          </Label>
          <ReportCentreMultiSelect
            centres={centres}
            selection={selection}
            onSelectionChange={onSelectionChange}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border/70 pt-3">
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

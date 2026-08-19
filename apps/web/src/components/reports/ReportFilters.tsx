import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Centre } from "@/lib/db";

type ReportFiltersProps = {
  dateFrom: string;
  dateTo: string;
  centreId: string;
  centres: Centre[];
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onCentreChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

export function ReportFilters({
  dateFrom,
  dateTo,
  centreId,
  centres,
  onDateFromChange,
  onDateToChange,
  onCentreChange,
  onApply,
  onReset,
}: ReportFiltersProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 shadow-xs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="report-date-from" className="text-xs font-medium text-muted-foreground">
            From
          </Label>
          <Input
            id="report-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-date-to" className="text-xs font-medium text-muted-foreground">
            To
          </Label>
          <Input
            id="report-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="report-centre" className="text-xs font-medium text-muted-foreground">
            Centre
          </Label>
          <Select value={centreId} onValueChange={onCentreChange}>
            <SelectTrigger id="report-centre" className="h-10">
              <SelectValue placeholder="All centres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All centres</SelectItem>
              {centres.map((centre) => (
                <SelectItem key={centre.id} value={centre.id}>
                  {centre.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

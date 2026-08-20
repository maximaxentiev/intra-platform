import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Staff } from "@/lib/db";
import {
  DOCUMENT_STATUS_FILTER_OPTIONS,
  DOCUMENT_TYPE_FILTER_OPTIONS,
} from "@/lib/reports-document-labels";
import { type StaffSelectionState } from "@/lib/reports-staff-selection";
import { ReportStaffMultiSelect } from "@/components/reports/StaffUsageFilters";

type DocumentComplianceFiltersProps = {
  staffMembers: Staff[];
  selection: StaffSelectionState;
  status: string;
  documentType: string;
  onSelectionChange: (selection: StaffSelectionState) => void;
  onStatusChange: (value: string) => void;
  onDocumentTypeChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
};

export function DocumentComplianceFilters({
  staffMembers,
  selection,
  status,
  documentType,
  onSelectionChange,
  onStatusChange,
  onDocumentTypeChange,
  onApply,
  onReset,
}: DocumentComplianceFiltersProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 shadow-xs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="document-report-staff" className="text-xs font-medium text-muted-foreground">
            Staff
          </Label>
          <ReportStaffMultiSelect
            staffMembers={staffMembers}
            selection={selection}
            onSelectionChange={onSelectionChange}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="document-report-status" className="text-xs font-medium text-muted-foreground">
            Document status
          </Label>
          <Select value={status || "all"} onValueChange={onStatusChange}>
            <SelectTrigger id="document-report-status" className="h-10">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {DOCUMENT_STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="document-report-type" className="text-xs font-medium text-muted-foreground">
            Document type
          </Label>
          <Select value={documentType || "all"} onValueChange={onDocumentTypeChange}>
            <SelectTrigger id="document-report-type" className="h-10">
              <SelectValue placeholder="All document types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All document types</SelectItem>
              {DOCUMENT_TYPE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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

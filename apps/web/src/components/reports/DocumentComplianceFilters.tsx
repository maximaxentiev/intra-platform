import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { type Staff } from "@/lib/db";
import {
  ReportActiveFilterChips,
  ReportCheckboxFilterGroup,
  ReportDateRangeFields,
  ReportFilterSectionHeading,
} from "@/components/reports/ReportFilterPrimitives";
import { ReportStaffMultiSelect } from "@/components/reports/StaffUsageFilters";
import {
  COVID_STATUS_FILTER_OPTIONS,
  FIRST_AID_STATUS_FILTER_OPTIONS,
  IMMUNIZATIONS_STATUS_FILTER_OPTIONS,
  isAdvancedDocumentComplianceFilterActive,
  OVERALL_COMPLIANCE_FILTER_OPTIONS,
  REMINDER_STATUS_FILTER_OPTIONS,
  STAFF_ROLE_FILTER_OPTIONS,
  UPCOMING_REMINDER_FILTER_OPTIONS,
  VSC_STATUS_FILTER_OPTIONS,
  type DocumentComplianceFilterState,
} from "@/lib/report-document-filters";
import {
  DOCUMENT_TYPE_FILTER_OPTIONS,
  documentReportStatusLabel,
  type DocumentReportStatus,
} from "@/lib/reports-document-labels";
import { type StaffSelectionState } from "@/lib/reports-staff-selection";

type DocumentComplianceFiltersProps = {
  staffMembers: Staff[];
  selection: StaffSelectionState;
  filters: DocumentComplianceFilterState;
  dateValidationError: string | null;
  activeFilterChips: Array<{ id: string; label: string; onRemove?: () => void }>;
  onSelectionChange: (selection: StaffSelectionState) => void;
  onFiltersChange: (filters: DocumentComplianceFilterState) => void;
  onApply: () => void;
  onReset: () => void;
  onClearAdvanced?: () => void;
};

function statusOptions(values: readonly DocumentReportStatus[]) {
  return values.map((value) => ({
    value,
    label: documentReportStatusLabel(value),
  }));
}

function covidStatusOptions() {
  return COVID_STATUS_FILTER_OPTIONS.map((value) => ({
    value,
    label: documentReportStatusLabel(value, value === "not_submitted"),
  }));
}

export function DocumentComplianceFilters({
  staffMembers,
  selection,
  filters,
  dateValidationError,
  activeFilterChips,
  onSelectionChange,
  onFiltersChange,
  onApply,
  onReset,
  onClearAdvanced,
}: DocumentComplianceFiltersProps) {
  const [moreOpen, setMoreOpen] = useState(
    isAdvancedDocumentComplianceFilterActive(filters) || activeFilterChips.length > 0,
  );

  function updateFilters(patch: Partial<DocumentComplianceFilterState>) {
    onFiltersChange({ ...filters, ...patch });
  }

  function toggleListValue(list: string[], value: string, checked: boolean): string[] {
    if (checked) return [...new Set([...list, value])];
    return list.filter((item) => item !== value);
  }

  function toggleOverall(value: string, checked: boolean) {
    updateFilters({
      overallCompliance: toggleListValue(filters.overallCompliance, value, checked) as DocumentComplianceFilterState["overallCompliance"],
    });
  }

  function toggleRole(value: string, checked: boolean) {
    updateFilters({ roles: toggleListValue(filters.roles, value, checked) });
  }

  function toggleStatusField(
    field:
      | "vscStatuses"
      | "firstAidStatuses"
      | "immunizationsStatuses"
      | "covidStatuses",
    value: string,
    checked: boolean,
  ) {
    updateFilters({
      [field]: toggleListValue(filters[field], value, checked),
    } as Partial<DocumentComplianceFilterState>);
  }

  function toggleReminderField(
    field: "vscReminderStatuses" | "firstAidReminderStatuses",
    value: string,
    checked: boolean,
  ) {
    updateFilters({
      [field]: toggleListValue(filters[field], value, checked),
    });
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card p-4 shadow-xs space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
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

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">Overall Compliance</Label>
          <div className="space-y-2 rounded-md border border-border/60 p-3">
            {OVERALL_COMPLIANCE_FILTER_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={filters.overallCompliance.includes(option.value)}
                  onCheckedChange={(value) => toggleOverall(option.value, value === true)}
                  aria-label={`Overall Compliance: ${option.label}`}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="document-report-type" className="text-xs font-medium text-muted-foreground">
            Document Type
          </Label>
          <Select
            value={filters.documentType || "all"}
            onValueChange={(value) =>
              updateFilters({ documentType: value === "all" ? "" : value })
            }
          >
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

      <div className="space-y-3 border-t border-border/70 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            {moreOpen ? "Hide filters" : "More filters"}
            {moreOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={onReset}>
              Reset
            </Button>
            <Button size="sm" type="button" onClick={onApply} disabled={Boolean(dateValidationError)}>
              Apply
            </Button>
          </div>
        </div>

        {moreOpen ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <ReportFilterSectionHeading>Staff</ReportFilterSectionHeading>

        <ReportCheckboxFilterGroup
          legend="Staff Role"
          options={STAFF_ROLE_FILTER_OPTIONS.map((role) => ({ value: role, label: role }))}
          values={filters.roles}
          onToggle={toggleRole}
        />

        <ReportFilterSectionHeading>Compliance Status</ReportFilterSectionHeading>

        <ReportCheckboxFilterGroup
          legend="VSC Status"
          options={statusOptions(VSC_STATUS_FILTER_OPTIONS)}
          values={filters.vscStatuses}
          onToggle={(value, checked) => toggleStatusField("vscStatuses", value, checked)}
        />

        <ReportCheckboxFilterGroup
          legend="First Aid & CPR Status"
          options={statusOptions(FIRST_AID_STATUS_FILTER_OPTIONS)}
          values={filters.firstAidStatuses}
          onToggle={(value, checked) => toggleStatusField("firstAidStatuses", value, checked)}
        />

        <ReportCheckboxFilterGroup
          legend="Immunizations Status"
          options={statusOptions(IMMUNIZATIONS_STATUS_FILTER_OPTIONS)}
          values={filters.immunizationsStatuses}
          onToggle={(value, checked) => toggleStatusField("immunizationsStatuses", value, checked)}
        />

        <ReportCheckboxFilterGroup
          legend="COVID-19 Status"
          options={covidStatusOptions()}
          values={filters.covidStatuses}
          onToggle={(value, checked) => toggleStatusField("covidStatuses", value, checked)}
        />

        <ReportFilterSectionHeading>Dates</ReportFilterSectionHeading>

        <ReportDateRangeFields
          label="VSC Renewal Due"
          fromId="doc-vsc-renewal-from"
          toId="doc-vsc-renewal-to"
          fromValue={filters.vscRenewalDueFrom}
          toValue={filters.vscRenewalDueTo}
          onFromChange={(value) => updateFilters({ vscRenewalDueFrom: value })}
          onToChange={(value) => updateFilters({ vscRenewalDueTo: value })}
        />

        <ReportDateRangeFields
          label="First Aid Expiry"
          fromId="doc-first-aid-from"
          toId="doc-first-aid-to"
          fromValue={filters.firstAidExpiryFrom}
          toValue={filters.firstAidExpiryTo}
          onFromChange={(value) => updateFilters({ firstAidExpiryFrom: value })}
          onToChange={(value) => updateFilters({ firstAidExpiryTo: value })}
        />

        <ReportFilterSectionHeading>Reminders</ReportFilterSectionHeading>

        <ReportCheckboxFilterGroup
          legend="VSC Latest Reminder Status"
          options={[...REMINDER_STATUS_FILTER_OPTIONS]}
          values={filters.vscReminderStatuses}
          onToggle={(value, checked) => toggleReminderField("vscReminderStatuses", value, checked)}
        />

        <ReportCheckboxFilterGroup
          legend="First Aid Latest Reminder Status"
          options={[...REMINDER_STATUS_FILTER_OPTIONS]}
          values={filters.firstAidReminderStatuses}
          onToggle={(value, checked) =>
            toggleReminderField("firstAidReminderStatuses", value, checked)
          }
        />

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted-foreground">Upcoming Reminder</legend>
          <Select
            value={filters.upcomingReminder || "all"}
            onValueChange={(value) =>
              updateFilters({ upcomingReminder: value === "all" ? "" : value })
            }
          >
            <SelectTrigger className="h-9" aria-label="Upcoming reminder filter">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              {UPCOMING_REMINDER_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>
          </div>
        ) : null}
      </div>

      {dateValidationError ? (
        <p className="text-sm text-destructive" role="alert">
          {dateValidationError}
        </p>
      ) : null}

      <ReportActiveFilterChips chips={activeFilterChips} onClearAdvanced={onClearAdvanced} />
    </div>
  );
}

import { useMemo } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  STATUS_OPTIONS,
  label as toLabel,
  type ApplicationRole,
  type ApplicationRow,
} from "@/lib/applications";

export type TriState = "any" | "yes" | "no";

export interface ApplicationFilters {
  status: string;
  statusInCanada: string;
  experience: string;
  qualification: string;
  trainingCompleted: TriState;
  experienceTypes: string[];
  gtaEligible: TriState;
  vsc: TriState;
  firstAid: TriState;
  immunizations: TriState;
  covid: "any" | "yes" | "no" | "not_provided";
  gender: string;
  english: string;
  languages: string[];
  submittedFrom: string;
  submittedTo: string;
  vscFrom: string;
  vscTo: string;
  cprFrom: string;
  cprTo: string;
}

export const EMPTY_FILTERS: ApplicationFilters = {
  status: "any",
  statusInCanada: "any",
  experience: "any",
  qualification: "any",
  trainingCompleted: "any",
  experienceTypes: [],
  gtaEligible: "any",
  vsc: "any",
  firstAid: "any",
  immunizations: "any",
  covid: "any",
  gender: "any",
  english: "any",
  languages: [],
  submittedFrom: "",
  submittedTo: "",
  vscFrom: "",
  vscTo: "",
  cprFrom: "",
  cprTo: "",
};

const FILTER_LABELS: Record<keyof ApplicationFilters, string> = {
  status: "Status",
  statusInCanada: "Status in Canada",
  experience: "Experience Duration",
  qualification: "Qualification",
  trainingCompleted: "Training Completed",
  experienceTypes: "Experience Types",
  gtaEligible: "GTA Eligible",
  vsc: "VSC",
  firstAid: "First Aid & CPR",
  immunizations: "Immunizations",
  covid: "COVID-19",
  gender: "Gender",
  english: "English Proficiency",
  languages: "Additional Languages",
  submittedFrom: "Submitted from",
  submittedTo: "Submitted to",
  vscFrom: "VSC date from",
  vscTo: "VSC date to",
  cprFrom: "CPR expiry from",
  cprTo: "CPR expiry to",
};

export function activeFilterChips(
  f: ApplicationFilters,
): Array<{ key: keyof ApplicationFilters; label: string; value: string }> {
  const chips: Array<{ key: keyof ApplicationFilters; label: string; value: string }> = [];
  (Object.keys(EMPTY_FILTERS) as (keyof ApplicationFilters)[]).forEach((key) => {
    const v = f[key];
    if (Array.isArray(v)) {
      if (v.length) chips.push({ key, label: FILTER_LABELS[key], value: v.map(toLabel).join(", ") });
      return;
    }
    if (v && v !== "any") {
      const display =
        key === "status"
          ? (STATUS_OPTIONS.find((o) => o.value === v)?.label ?? toLabel(v))
          : toLabel(String(v));
      chips.push({ key, label: FILTER_LABELS[key], value: display });
    }
  });
  return chips;
}

export function countActiveFilters(f: ApplicationFilters): number {
  return activeFilterChips(f).length;
}

function uniq(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== ""))).sort();
}

function OptionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function YesNoSelect({
  label,
  value,
  onChange,
  extra,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  extra?: { value: string; label: string }[];
}) {
  return (
    <OptionSelect
      label={label}
      value={value}
      onChange={onChange}
      options={[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        ...(extra ?? []),
      ]}
    />
  );
}

function DateRange({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-9" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-9" />
      </div>
    </div>
  );
}

function MultiSelect({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  if (!values.length) return null;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
        {values.map((v) => {
          const checked = selected.includes(v);
          return (
            <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={(c) =>
                  onChange(c ? [...selected, v] : selected.filter((s) => s !== v))
                }
              />
              <span className="truncate">{toLabel(v)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ApplicationsFilterPanel({
  role,
  rows,
  filters,
  onChange,
  onClear,
}: {
  role: ApplicationRole;
  rows: ApplicationRow[];
  filters: ApplicationFilters;
  onChange: (f: ApplicationFilters) => void;
  onClear: () => void;
}) {
  const opts = useMemo(() => {
    const map = (vals: string[]) => vals.map((v) => ({ value: v, label: toLabel(v) }));
    return {
      statusInCanada: map(uniq(rows.map((r) => r.eligibility.statusInCanada))),
      experience: map(uniq(rows.map((r) => r.experience.duration))),
      qualification: map(uniq(rows.map((r) => r.roleSpecific.qualificationStatus))),
      gender: map(uniq(rows.map((r) => r.applicant.gender))),
      english: map(uniq(rows.map((r) => r.languages.englishProficiency))),
      experienceTypes: uniq(rows.flatMap((r) => r.experience.nannyExperienceTypes)),
      languages: uniq(rows.flatMap((r) => r.languages.additionalLanguages.map((l) => l.language))),
    };
  }, [rows]);

  const set = <K extends keyof ApplicationFilters>(key: K, value: ApplicationFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const count = countActiveFilters(filters);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10">
          <Filter className="h-4 w-4 mr-1.5" />
          Filters
          {count > 0 && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[min(70vh,32rem)] w-[22rem] flex-col overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Filters</div>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear all
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 p-4">
            <OptionSelect
              label="Status"
              value={filters.status}
              onChange={(v) => set("status", v)}
              options={STATUS_OPTIONS}
            />
            <OptionSelect
              label="Status in Canada"
              value={filters.statusInCanada}
              onChange={(v) => set("statusInCanada", v)}
              options={opts.statusInCanada}
            />
            <OptionSelect
              label="Experience Duration"
              value={filters.experience}
              onChange={(v) => set("experience", v)}
              options={opts.experience}
            />
            {role !== "nanny" && (
              <OptionSelect
                label="Qualification"
                value={filters.qualification}
                onChange={(v) => set("qualification", v)}
                options={opts.qualification}
              />
            )}
            {role === "nanny" && (
              <>
                <YesNoSelect
                  label="Training Completed"
                  value={filters.trainingCompleted}
                  onChange={(v) => set("trainingCompleted", v as TriState)}
                />
                <MultiSelect
                  label="Experience Types"
                  values={opts.experienceTypes}
                  selected={filters.experienceTypes}
                  onChange={(v) => set("experienceTypes", v)}
                />
              </>
            )}
            <YesNoSelect
              label="GTA Eligible"
              value={filters.gtaEligible}
              onChange={(v) => set("gtaEligible", v as TriState)}
            />
            <YesNoSelect label="VSC" value={filters.vsc} onChange={(v) => set("vsc", v as TriState)} />
            <YesNoSelect
              label="First Aid & CPR"
              value={filters.firstAid}
              onChange={(v) => set("firstAid", v as TriState)}
            />
            <YesNoSelect
              label="Immunizations"
              value={filters.immunizations}
              onChange={(v) => set("immunizations", v as TriState)}
            />
            <YesNoSelect
              label="COVID-19"
              value={filters.covid}
              onChange={(v) => set("covid", v as ApplicationFilters["covid"])}
              extra={[{ value: "not_provided", label: "Not provided" }]}
            />
            <OptionSelect
              label="Gender"
              value={filters.gender}
              onChange={(v) => set("gender", v)}
              options={opts.gender}
            />
            <OptionSelect
              label="English Proficiency"
              value={filters.english}
              onChange={(v) => set("english", v)}
              options={opts.english}
            />
            <MultiSelect
              label="Additional Languages"
              values={opts.languages}
              selected={filters.languages}
              onChange={(v) => set("languages", v)}
            />
            <DateRange
              label="Submitted"
              from={filters.submittedFrom}
              to={filters.submittedTo}
              onFrom={(v) => set("submittedFrom", v)}
              onTo={(v) => set("submittedTo", v)}
            />
            <DateRange
              label="VSC Date"
              from={filters.vscFrom}
              to={filters.vscTo}
              onFrom={(v) => set("vscFrom", v)}
              onTo={(v) => set("vscTo", v)}
            />
            <DateRange
              label="CPR Expiry"
              from={filters.cprFrom}
              to={filters.cprTo}
              onFrom={(v) => set("cprFrom", v)}
              onTo={(v) => set("cprTo", v)}
            />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function ActiveFilterChips({
  filters,
  onRemove,
  onClear,
}: {
  filters: ApplicationFilters;
  onRemove: (key: keyof ApplicationFilters) => void;
  onClear: () => void;
}) {
  const chips = activeFilterChips(filters);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
      <span className="text-xs font-medium text-primary">
        {chips.length} filter{chips.length === 1 ? "" : "s"} active
      </span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onRemove(c.key)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-foreground/80 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-muted-foreground">{c.label}:</span>
          <span className="max-w-[12rem] truncate">{c.value}</span>
          <X className="h-3 w-3" />
        </button>
      ))}
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClear}>
        Clear all
      </Button>
    </div>
  );
}

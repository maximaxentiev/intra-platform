import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  STATUS_OPTIONS,
  label as toLabel,
  type ApplicationRole,
  type ApplicationRow,
} from "@/lib/applications";
import {
  EMPTY_FILTERS,
  type ApplicationFilters,
  type TriState,
} from "@/lib/application-filters-types";

export type { ApplicationFilters, TriState };
export { EMPTY_FILTERS };

const FILTER_LABELS: Partial<Record<keyof ApplicationFilters, string>> = {
  status: "Status",
  reviewed: "Reviewed",
  intakeVersion: "Intake source",
  firstName: "First name",
  lastName: "Last name",
  preferredName: "Preferred name",
  email: "Email",
  phone: "Phone",
  city: "City",
  postalCode: "Postal code",
  statusInCanada: "Status in Canada",
  experience: "Experience duration",
  qualification: "Qualification",
  trainingCompleted: "Training completed",
  hasChildcareExperience: "Childcare experience",
  experienceTypes: "Experience types",
  ageGroups: "Age groups",
  specialExperienceTypes: "Special experience",
  educationCertifications: "Education / certifications",
  gtaEligible: "GTA commute",
  vsc: "VSC (yes/no)",
  firstAid: "First Aid (yes/no)",
  vscStatusValues: "VSC status",
  firstAidStatusValues: "First Aid status",
  immunizations: "Immunizations",
  covid: "COVID-19",
  gender: "Gender",
  english: "English proficiency",
  languages: "Languages",
  accuracyConfirmed: "Accuracy confirmed",
  consentAccepted: "Consent",
  spokenEnglishMin: "Spoken English min",
  spokenEnglishMax: "Spoken English max",
  hasResume: "Resume document",
  hasVscDocument: "VSC document",
  submittedFrom: "Submitted from",
  submittedTo: "Submitted to",
  createdFrom: "Created from",
  createdTo: "Created to",
  vscFrom: "VSC date from",
  vscTo: "VSC date to",
  cprFrom: "First Aid expiry from",
  cprTo: "First Aid expiry to",
};

export function activeFilterChips(
  f: ApplicationFilters,
): Array<{ key: keyof ApplicationFilters; label: string; value: string }> {
  const chips: Array<{ key: keyof ApplicationFilters; label: string; value: string }> = [];
  (Object.keys(EMPTY_FILTERS) as (keyof ApplicationFilters)[]).forEach((key) => {
    const v = f[key];
    const label = FILTER_LABELS[key] ?? key;
    if (Array.isArray(v)) {
      if (v.length) chips.push({ key, label, value: v.map(toLabel).join(", ") });
      return;
    }
    if (typeof v === "string" && v.trim() && v !== "any") {
      const display =
        key === "status"
          ? (STATUS_OPTIONS.find((o) => o.value === v)?.label ?? toLabel(v))
          : toLabel(String(v));
      chips.push({ key, label, value: display });
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

function TriSelect({
  label,
  value,
  onChange,
  extra,
}: {
  label: string;
  value: TriState | string;
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
        { value: "missing", label: "Missing / not recorded" },
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

function FilterGroup({
  title,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50">
        <span>{title}</span>
        {count > 0 ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {count}
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t border-border p-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function groupCount(f: ApplicationFilters, keys: (keyof ApplicationFilters)[]): number {
  return activeFilterChips(f).filter((c) => keys.includes(c.key)).length;
}

export function ApplicationsFilterPanel({
  role,
  rows,
  filters,
  onApply,
  onClear,
}: {
  role: ApplicationRole;
  rows: ApplicationRow[];
  filters: ApplicationFilters;
  onApply: (f: ApplicationFilters) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ApplicationFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const opts = useMemo(() => {
    const map = (vals: string[]) => vals.map((v) => ({ value: v, label: toLabel(v) }));
    const nannyRows = rows.filter((r) => r.applicant.role === "nanny");
    return {
      statusInCanada: map(uniq(rows.map((r) => r.eligibility.statusInCanada))),
      experience: map(uniq(rows.map((r) => r.experience.duration))),
      qualification: map(uniq(rows.map((r) => r.roleSpecific.qualificationStatus))),
      gender: map(uniq(rows.map((r) => r.applicant.gender))),
      english: map(uniq(rows.map((r) => r.languages.englishProficiency))),
      experienceTypes: uniq(rows.flatMap((r) => r.experience.nannyExperienceTypes)),
      languages: uniq(rows.flatMap((r) => r.languages.additionalLanguages.map((l) => l.language))),
      vscStatus: uniq(nannyRows.map((r) => r.nanny?.compliance.vscStatus ?? r.compliance.vscStatus)),
      firstAidStatus: uniq(
        nannyRows.map((r) => r.nanny?.compliance.firstAidStatus ?? r.compliance.firstAidCprStatus),
      ),
      ageGroups: uniq(nannyRows.flatMap((r) => r.nanny?.experience.ageGroups ?? [])),
      educationCerts: uniq(nannyRows.flatMap((r) => r.nanny?.qualifications.educationCertifications ?? [])),
      specialExp: uniq(nannyRows.flatMap((r) => r.nanny?.experience.specialExperienceTypes ?? [])),
    };
  }, [rows]);

  const set = <K extends keyof ApplicationFilters>(key: K, value: ApplicationFilters[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const count = countActiveFilters(filters);
  const isNanny = role === "nanny";
  const isStaffRole = role === "eca" || role === "ece_rece";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10">
          <Filter className="h-4 w-4 mr-1.5" />
          Filters{count > 0 ? ` (${count})` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle>Application filters</SheetTitle>
          <SheetDescription>Filters apply to the full dataset before pagination.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
          <FilterGroup
            title="Application"
            count={groupCount(draft, ["status", "reviewed", "intakeVersion", "submittedFrom", "createdFrom"])}
            defaultOpen
          >
            <OptionSelect label="Status" value={draft.status} onChange={(v) => set("status", v)} options={STATUS_OPTIONS} />
            <OptionSelect
              label="Reviewed"
              value={draft.reviewed}
              onChange={(v) => set("reviewed", v as ApplicationFilters["reviewed"])}
              options={[
                { value: "yes", label: "Reviewed" },
                { value: "no", label: "Not reviewed" },
              ]}
            />
            {isNanny && (
              <MultiSelect
                label="Intake source"
                values={["legacy", "nanny_v2", "historical_import"]}
                selected={draft.intakeVersion}
                onChange={(v) => set("intakeVersion", v)}
              />
            )}
            <DateRange
              label="Submitted"
              from={draft.submittedFrom}
              to={draft.submittedTo}
              onFrom={(v) => set("submittedFrom", v)}
              onTo={(v) => set("submittedTo", v)}
            />
            <DateRange
              label="Created"
              from={draft.createdFrom}
              to={draft.createdTo}
              onFrom={(v) => set("createdFrom", v)}
              onTo={(v) => set("createdTo", v)}
            />
          </FilterGroup>

          <FilterGroup
            title="Applicant"
            count={groupCount(draft, ["firstName", "lastName", "preferredName", "email", "phone", "city", "postalCode", "gender"])}
          >
            <Input placeholder="First name contains…" value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} className="h-9" />
            <Input placeholder="Last name contains…" value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} className="h-9" />
            {isNanny && (
              <Input placeholder="Preferred name contains…" value={draft.preferredName} onChange={(e) => set("preferredName", e.target.value)} className="h-9" />
            )}
            <Input placeholder="Email contains…" value={draft.email} onChange={(e) => set("email", e.target.value)} className="h-9" />
            <Input placeholder="Phone contains…" value={draft.phone} onChange={(e) => set("phone", e.target.value)} className="h-9" />
            <Input placeholder="City contains…" value={draft.city} onChange={(e) => set("city", e.target.value)} className="h-9" />
            <Input placeholder="Postal code contains…" value={draft.postalCode} onChange={(e) => set("postalCode", e.target.value)} className="h-9" />
            <OptionSelect label="Gender" value={draft.gender} onChange={(v) => set("gender", v)} options={opts.gender} />
          </FilterGroup>

          <FilterGroup title="Eligibility & experience" count={groupCount(draft, ["statusInCanada", "experience", "qualification", "gtaEligible", "trainingCompleted", "hasChildcareExperience", "experienceTypes"])}>
            <OptionSelect label="Status in Canada" value={draft.statusInCanada} onChange={(v) => set("statusInCanada", v)} options={opts.statusInCanada} />
            <OptionSelect label="Experience duration" value={draft.experience} onChange={(v) => set("experience", v)} options={opts.experience} />
            {isStaffRole && (
              <OptionSelect label="Qualification" value={draft.qualification} onChange={(v) => set("qualification", v)} options={opts.qualification} />
            )}
            <TriSelect label="GTA commute eligible" value={draft.gtaEligible} onChange={(v) => set("gtaEligible", v as TriState)} />
            {isNanny && (
              <>
                <TriSelect label="Training completed" value={draft.trainingCompleted} onChange={(v) => set("trainingCompleted", v as TriState)} />
                <TriSelect label="Has childcare experience" value={draft.hasChildcareExperience} onChange={(v) => set("hasChildcareExperience", v as TriState)} />
                <MultiSelect label="Experience types" values={opts.experienceTypes} selected={draft.experienceTypes} onChange={(v) => set("experienceTypes", v)} />
                <MultiSelect label="Age groups" values={opts.ageGroups} selected={draft.ageGroups} onChange={(v) => set("ageGroups", v)} />
                <MultiSelect label="Special experience" values={opts.specialExp} selected={draft.specialExperienceTypes} onChange={(v) => set("specialExperienceTypes", v)} />
                <MultiSelect label="Education / certifications" values={opts.educationCerts} selected={draft.educationCertifications} onChange={(v) => set("educationCertifications", v)} />
              </>
            )}
          </FilterGroup>

          <FilterGroup title="Compliance & documents" count={groupCount(draft, ["vsc", "firstAid", "immunizations", "covid", "vscStatusValues", "firstAidStatusValues", "hasResume", "hasVscDocument", "vscFrom", "cprFrom"])}>
            <TriSelect label="VSC (yes/no)" value={draft.vsc} onChange={(v) => set("vsc", v as TriState)} />
            <TriSelect label="First Aid (yes/no)" value={draft.firstAid} onChange={(v) => set("firstAid", v as TriState)} />
            {isNanny && (
              <>
                <MultiSelect label="VSC status (exact)" values={opts.vscStatus} selected={draft.vscStatusValues} onChange={(v) => set("vscStatusValues", v)} />
                <MultiSelect label="First Aid status (exact)" values={opts.firstAidStatus} selected={draft.firstAidStatusValues} onChange={(v) => set("firstAidStatusValues", v)} />
              </>
            )}
            <TriSelect label="Immunizations" value={draft.immunizations} onChange={(v) => set("immunizations", v as TriState)} />
            <YesNoSelect label="COVID-19" value={draft.covid} onChange={(v) => set("covid", v as ApplicationFilters["covid"])} extra={[{ value: "not_provided", label: "Not provided" }]} />
            <OptionSelect
              label="Resume uploaded"
              value={draft.hasResume}
              onChange={(v) => set("hasResume", v as ApplicationFilters["hasResume"])}
              options={[
                { value: "yes", label: "Has resume" },
                { value: "no", label: "Missing resume" },
              ]}
            />
            <OptionSelect
              label="VSC document uploaded"
              value={draft.hasVscDocument}
              onChange={(v) => set("hasVscDocument", v as ApplicationFilters["hasVscDocument"])}
              options={[
                { value: "yes", label: "Has VSC document" },
                { value: "no", label: "Missing VSC document" },
              ]}
            />
            <DateRange label="VSC date" from={draft.vscFrom} to={draft.vscTo} onFrom={(v) => set("vscFrom", v)} onTo={(v) => set("vscTo", v)} />
            <DateRange label="First Aid expiry" from={draft.cprFrom} to={draft.cprTo} onFrom={(v) => set("cprFrom", v)} onTo={(v) => set("cprTo", v)} />
          </FilterGroup>

          <FilterGroup title="Language & consent" count={groupCount(draft, ["english", "languages", "spokenEnglishMin", "accuracyConfirmed", "consentAccepted"])}>
            <OptionSelect label="English proficiency" value={draft.english} onChange={(v) => set("english", v)} options={opts.english} />
            <MultiSelect label="Additional languages" values={opts.languages} selected={draft.languages} onChange={(v) => set("languages", v)} />
            {isNanny && (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="English min 1–10" value={draft.spokenEnglishMin} onChange={(e) => set("spokenEnglishMin", e.target.value)} className="h-9" />
                <Input placeholder="English max 1–10" value={draft.spokenEnglishMax} onChange={(e) => set("spokenEnglishMax", e.target.value)} className="h-9" />
              </div>
            )}
            {isNanny && (
              <>
                <TriSelect label="Accuracy confirmed" value={draft.accuracyConfirmed} onChange={(v) => set("accuracyConfirmed", v as TriState)} />
                <TriSelect label="Consent accepted" value={draft.consentAccepted} onChange={(v) => set("consentAccepted", v as TriState)} />
              </>
            )}
          </FilterGroup>
        </div>
        <SheetFooter className="border-t border-border px-4 py-3 sm:flex-row sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => { onClear(); setDraft(EMPTY_FILTERS); }}>
            Clear all
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            Apply filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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

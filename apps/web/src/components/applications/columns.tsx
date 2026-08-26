import type { ReactNode } from "react";
import { Chips, Dash, Trunc, YesNo } from "@/components/applications/primitives";
import { ChildcareExperiencePreview } from "@/components/applications/ChildcareExperiencePreview";
import { DocumentChips } from "@/components/applications/documents";
import {
  asYesNo,
  fmtDate,
  fullName,
  label as toLabel,
  type ApplicationDocument,
  type ApplicationRole,
  type ApplicationRow,
} from "@/lib/applications";
import type { ApplicationFilters } from "@/components/applications/ApplicationsFilters";

export interface AppColumn {
  key: string;
  header: string;
  minWidth: number;
  sortValue?: (r: ApplicationRow) => string | number;
  cell: (r: ApplicationRow, ctx: { openDoc: (d: ApplicationDocument) => void; openRow: (id: string) => void }) => ReactNode;
}

const langList = (r: ApplicationRow) =>
  r.languages.additionalLanguages.map((l) =>
    l.proficiency ? `${toLabel(l.language)} (${toLabel(l.proficiency)})` : toLabel(l.language),
  );

const SHARED_BEFORE: AppColumn[] = [
  {
    key: "email",
    header: "Email",
    minWidth: 210,
    sortValue: (r) => r.applicant.email.toLowerCase(),
    cell: (r) => <Trunc value={r.applicant.email} className="text-sm" />,
  },
  {
    key: "phone",
    header: "Phone",
    minWidth: 140,
    sortValue: (r) => r.applicant.phone,
    cell: (r) => <Trunc value={r.applicant.phone} className="text-sm tabular-nums" />,
  },
  {
    key: "submitted",
    header: "Submitted",
    minWidth: 120,
    sortValue: (r) => r.submittedAt ?? "",
    cell: (r) => <span className="text-sm whitespace-nowrap">{fmtDate(r.submittedAt)}</span>,
  },
  {
    key: "statusInCanada",
    header: "Status in Canada",
    minWidth: 170,
    sortValue: (r) => toLabel(r.eligibility.statusInCanada),
    cell: (r) => <Trunc value={toLabel(r.eligibility.statusInCanada)} className="text-sm" />,
  },
  {
    key: "experienceDuration",
    header: "Experience Duration",
    minWidth: 175,
    sortValue: (r) => toLabel(r.experience.duration),
    cell: (r) => <Trunc value={toLabel(r.experience.duration)} className="text-sm" />,
  },
  {
    key: "childcareExperience",
    header: "Childcare Experience",
    minWidth: 220,
    cell: (r, ctx) => (
      <ChildcareExperiencePreview
        description={r.experience.description}
        onOpen={() => ctx.openRow(r.id)}
      />
    ),
  },
];

const QUALIFICATION: AppColumn = {
  key: "qualification",
  header: "Qualification",
  minWidth: 180,
  sortValue: (r) => toLabel(r.roleSpecific.qualificationStatus),
  cell: (r) => <Trunc value={toLabel(r.roleSpecific.qualificationStatus)} className="text-sm" />,
};

const NANNY_ONLY: AppColumn[] = [
  {
    key: "experienceTypes",
    header: "Experience Types",
    minWidth: 200,
    cell: (r) => <Chips values={r.experience.nannyExperienceTypes.map(toLabel)} />,
  },
  {
    key: "trainingCompleted",
    header: "Training Completed",
    minWidth: 155,
    sortValue: (r) => (r.roleSpecific.nannyTrainingCompleted ? 1 : 0),
    cell: (r) => <YesNo value={r.roleSpecific.nannyTrainingCompleted} />,
  },
  {
    key: "trainingDescription",
    header: "Training Description",
    minWidth: 220,
    cell: (r) => <Trunc value={r.roleSpecific.nannyTrainingDescription} className="text-sm" />,
  },
];

const SHARED_AFTER: AppColumn[] = [
  {
    key: "gtaEligible",
    header: "GTA Eligible",
    minWidth: 115,
    sortValue: (r) => (r.eligibility.gtaEligible ? 1 : 0),
    cell: (r) => <YesNo value={r.eligibility.gtaEligible} />,
  },
  {
    key: "vsc",
    header: "VSC",
    minWidth: 100,
    cell: (r) => <YesNo value={asYesNo(r.compliance.vscStatus)} />,
  },
  {
    key: "vscDate",
    header: "VSC Date",
    minWidth: 115,
    sortValue: (r) => r.compliance.vscIssueOrRequestDate ?? "",
    cell: (r) =>
      r.compliance.vscIssueOrRequestDate ? (
        <span className="text-sm whitespace-nowrap">{fmtDate(r.compliance.vscIssueOrRequestDate)}</span>
      ) : (
        <Dash />
      ),
  },
  {
    key: "firstAid",
    header: "First Aid & CPR",
    minWidth: 135,
    cell: (r) => <YesNo value={asYesNo(r.compliance.firstAidCprStatus)} />,
  },
  {
    key: "cprExpiry",
    header: "CPR Expiry",
    minWidth: 115,
    sortValue: (r) => r.compliance.firstAidCprExpiry ?? "",
    cell: (r) =>
      r.compliance.firstAidCprExpiry ? (
        <span className="text-sm whitespace-nowrap">{fmtDate(r.compliance.firstAidCprExpiry)}</span>
      ) : (
        <Dash />
      ),
  },
  {
    key: "immunizations",
    header: "Immunizations",
    minWidth: 130,
    cell: (r) => <YesNo value={asYesNo(r.compliance.immunizationStatus)} />,
  },
  {
    key: "covid",
    header: "COVID-19",
    minWidth: 130,
    cell: (r) => {
      const v = asYesNo(r.compliance.covidVaccinationStatus);
      if (v === null && r.compliance.covidVaccinationStatus)
        return <Trunc value={toLabel(r.compliance.covidVaccinationStatus)} className="text-sm" />;
      return <YesNo value={v} unknownLabel="Not provided" />;
    },
  },
  {
    key: "gender",
    header: "Gender",
    minWidth: 110,
    sortValue: (r) => toLabel(r.applicant.gender),
    cell: (r) => <Trunc value={toLabel(r.applicant.gender)} className="text-sm" />,
  },
  {
    key: "english",
    header: "English Proficiency",
    minWidth: 165,
    sortValue: (r) => toLabel(r.languages.englishProficiency),
    cell: (r) => <Trunc value={toLabel(r.languages.englishProficiency)} className="text-sm" />,
  },
  {
    key: "languages",
    header: "Additional Languages",
    minWidth: 200,
    cell: (r) => <Chips values={langList(r)} />,
  },
  {
    key: "documents",
    header: "Documents",
    minWidth: 210,
    sortValue: (r) => r.documents.length,
    cell: (r, ctx) => <DocumentChips docs={r.documents} onOpen={ctx.openDoc} />,
  },
];

/** Middle columns (Applicant / Status / Actions are rendered by the table). */
export function columnsForRole(role: ApplicationRole): AppColumn[] {
  return role === "nanny"
    ? [...SHARED_BEFORE, ...NANNY_ONLY, ...SHARED_AFTER]
    : [...SHARED_BEFORE, QUALIFICATION, ...SHARED_AFTER];
}

// ---------------------------------------------------------------------------
// Search / filter / sort
// ---------------------------------------------------------------------------

export function matchesSearch(r: ApplicationRow, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  const haystack = [
    fullName(r),
    r.applicant.email,
    r.applicant.phone,
  ]
    .join(" ")
    .toLowerCase();
  if (haystack.includes(q)) return true;
  return digits.length >= 3 && r.applicant.phone.replace(/\D/g, "").includes(digits);
}

function triMatch(filter: string, value: boolean | null): boolean {
  if (filter === "any") return true;
  if (filter === "not_provided") return value === null;
  return filter === "yes" ? value === true : value === false;
}

function inRange(value: string | null, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const d = value.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function matchesFilters(r: ApplicationRow, f: ApplicationFilters): boolean {
  if (f.status !== "any" && r.status !== f.status) return false;
  if (f.statusInCanada !== "any" && r.eligibility.statusInCanada !== f.statusInCanada) return false;
  if (f.experience !== "any" && r.experience.duration !== f.experience) return false;
  if (f.qualification !== "any" && r.roleSpecific.qualificationStatus !== f.qualification) return false;
  if (!triMatch(f.trainingCompleted, r.roleSpecific.nannyTrainingCompleted)) return false;
  if (
    f.experienceTypes.length &&
    !f.experienceTypes.some((t) => r.experience.nannyExperienceTypes.includes(t))
  )
    return false;
  if (!triMatch(f.gtaEligible, r.eligibility.gtaEligible)) return false;
  if (!triMatch(f.vsc, asYesNo(r.compliance.vscStatus))) return false;
  if (!triMatch(f.firstAid, asYesNo(r.compliance.firstAidCprStatus))) return false;
  if (!triMatch(f.immunizations, asYesNo(r.compliance.immunizationStatus))) return false;
  if (!triMatch(f.covid, asYesNo(r.compliance.covidVaccinationStatus))) return false;
  if (f.gender !== "any" && r.applicant.gender !== f.gender) return false;
  if (f.english !== "any" && r.languages.englishProficiency !== f.english) return false;
  if (
    f.languages.length &&
    !f.languages.some((l) => r.languages.additionalLanguages.some((al) => al.language === l))
  )
    return false;
  if (!inRange(r.submittedAt, f.submittedFrom, f.submittedTo)) return false;
  if (!inRange(r.compliance.vscIssueOrRequestDate, f.vscFrom, f.vscTo)) return false;
  if (!inRange(r.compliance.firstAidCprExpiry, f.cprFrom, f.cprTo)) return false;
  return true;
}

export type SortState = { key: string; dir: "asc" | "desc" } | null;

const STATUS_ORDER: Record<string, number> = { new: 0, contacted: 1, hired: 2, rejected: 3 };

export function sortRows(rows: ApplicationRow[], sort: SortState, columns: AppColumn[]): ApplicationRow[] {
  if (!sort) {
    return [...rows].sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  }
  const getter: ((r: ApplicationRow) => string | number) | undefined =
    sort.key === "applicant"
      ? (r) => fullName(r).toLowerCase()
      : sort.key === "status"
        ? (r) => STATUS_ORDER[r.status] ?? 9
        : columns.find((c) => c.key === sort.key)?.sortValue;
  if (!getter) return rows;
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });
}

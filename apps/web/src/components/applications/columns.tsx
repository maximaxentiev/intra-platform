import type { ReactNode } from "react";
import { Chips, Dash, Trunc, YesNo } from "@/components/applications/primitives";
import { ChildcareExperiencePreview } from "@/components/applications/ChildcareExperiencePreview";
import { DocumentChips } from "@/components/applications/documents";
import {
  asYesNo,
  fmtDate,
  fullName,
  label as toLabel,
  complianceDocumentsForDisplay,
  resumeDocument,
  vscDocumentsForDisplay,
  type ApplicationDocument,
  type ApplicationRole,
  type ApplicationRow,
} from "@/lib/applications";
import {
  displayNannyBool,
  displayNannyText,
  displaySpokenEnglish,
  nannyView,
} from "@/lib/applications-nanny-display";
import { Button } from "@/components/ui/button";
import type { ApplicationFilters } from "@/lib/application-filters-types";

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

const nannyCell =
  (pick: (n: NonNullable<ReturnType<typeof nannyView>>) => string | null | undefined | boolean | number | string[]) =>
  (r: ApplicationRow) => {
    const n = nannyView(r);
    if (!n) return <Dash />;
    const v = pick(n);
    if (Array.isArray(v)) return <Chips values={v.map((x) => toLabel(String(x)))} />;
    if (typeof v === "boolean") return <span className="text-sm">{displayNannyBool(v)}</span>;
    if (typeof v === "number") return <span className="text-sm">{Number.isFinite(v) ? v : "—"}</span>;
    return <Trunc value={displayNannyText(typeof v === "string" ? v : null)} className="text-sm" />;
  };

const NANNY_COLUMNS: AppColumn[] = [
  { key: "firstName", header: "First Name", minWidth: 120, sortValue: (r) => r.applicant.firstName, cell: (r) => <Trunc value={r.applicant.firstName} className="text-sm" /> },
  { key: "lastName", header: "Last Name", minWidth: 120, sortValue: (r) => r.applicant.lastName, cell: (r) => <Trunc value={r.applicant.lastName} className="text-sm" /> },
  { key: "preferredName", header: "Preferred Name", minWidth: 140, cell: (r) => <Trunc value={displayNannyText(nannyView(r)?.applicant.preferredName ?? r.applicant.preferredName ?? null)} className="text-sm" /> },
  { key: "email", header: "Email Address", minWidth: 210, sortValue: (r) => r.applicant.email.toLowerCase(), cell: (r) => <Trunc value={r.applicant.email} className="text-sm" /> },
  { key: "phone", header: "Phone Number", minWidth: 140, sortValue: (r) => r.applicant.phone, cell: (r) => <Trunc value={r.applicant.phone} className="text-sm tabular-nums" /> },
  { key: "city", header: "City", minWidth: 130, cell: (r) => <Trunc value={displayNannyText(nannyView(r)?.applicant.city ?? r.applicant.city ?? null)} className="text-sm" /> },
  { key: "postalCode", header: "Postal Code", minWidth: 110, cell: (r) => <Trunc value={displayNannyText(nannyView(r)?.applicant.postalCode ?? r.applicant.postalCode ?? null)} className="text-sm" /> },
  { key: "gender", header: "Gender", minWidth: 110, cell: (r) => <Trunc value={displayNannyText(r.applicant.gender)} className="text-sm" /> },
  { key: "gtaCommute", header: "GTA Commute", minWidth: 120, cell: nannyCell((n) => n.eligibility.canCommuteGta) },
  { key: "canadaStatus", header: "Canada Status", minWidth: 170, cell: nannyCell((n) => n.eligibility.canadaStatus) },
  { key: "legalWork", header: "Legally Authorized to Work", minWidth: 190, cell: nannyCell((n) => n.eligibility.legallyAuthorizedToWork) },
  { key: "workPermitExpiry", header: "Work Permit Expiry", minWidth: 150, cell: (r) => <span className="text-sm whitespace-nowrap">{nannyView(r)?.eligibility.workPermitExpiry ? fmtDate(nannyView(r)!.eligibility.workPermitExpiry) : "—"}</span> },
  { key: "workPermitChildcare", header: "Work Permit Childcare Restrictions", minWidth: 220, cell: nannyCell((n) => n.eligibility.workPermitChildcareRestrictions) },
  { key: "offCampus", header: "Authorized Off Campus", minWidth: 170, cell: nannyCell((n) => n.eligibility.authorizedOffCampus) },
  { key: "workHourLimits", header: "Work Hour Limits", minWidth: 140, cell: nannyCell((n) => n.eligibility.workHourLimitStatus) },
  { key: "maxWeeklyHours", header: "Maximum Weekly Hours", minWidth: 170, cell: nannyCell((n) => n.eligibility.maxWeeklyWorkHours) },
  { key: "prevExperience", header: "Previous Childcare Experience", minWidth: 210, cell: nannyCell((n) => n.experience.hasChildcareExperience) },
  { key: "experienceYears", header: "Years of Childcare Experience", minWidth: 210, cell: nannyCell((n) => n.experience.years) },
  { key: "experienceTypes", header: "Types of Childcare Experience", minWidth: 220, cell: (r) => <Chips values={(nannyView(r)?.experience.types ?? r.experience.nannyExperienceTypes).map(toLabel)} /> },
  { key: "ageGroups", header: "Age Groups", minWidth: 200, cell: (r) => <Chips values={(nannyView(r)?.experience.ageGroups ?? []).map(toLabel)} /> },
  { key: "specialExperience", header: "Special Childcare Experience", minWidth: 220, cell: (r) => <Chips values={(nannyView(r)?.experience.specialExperienceTypes ?? []).map(toLabel)} /> },
  { key: "specialDetails", header: "Specialized Experience Details", minWidth: 220, cell: (r) => <Trunc value={displayNannyText(nannyView(r)?.experience.specialExperienceDescription)} className="text-sm" /> },
  { key: "education", header: "Education / Certifications", minWidth: 210, cell: (r) => <Chips values={(nannyView(r)?.qualifications.educationCertifications ?? []).map(toLabel)} /> },
  { key: "programName", header: "Program / Certification Name", minWidth: 210, cell: nannyCell((n) => n.qualifications.educationProgramName) },
  { key: "firstAid", header: "First Aid & CPR", minWidth: 150, cell: nannyCell((n) => n.compliance.firstAidStatus) },
  { key: "firstAidExpiry", header: "First Aid Expiry", minWidth: 130, cell: (r) => <span className="text-sm whitespace-nowrap">{nannyView(r)?.compliance.firstAidExpiry ? fmtDate(nannyView(r)!.compliance.firstAidExpiry) : "—"}</span> },
  { key: "vscStatus", header: "VSC Status", minWidth: 150, cell: nannyCell((n) => n.compliance.vscStatus) },
  { key: "vscIssueDate", header: "VSC Issue Date", minWidth: 130, cell: (r) => <span className="text-sm whitespace-nowrap">{nannyView(r)?.compliance.vscIssueDate ? fmtDate(nannyView(r)!.compliance.vscIssueDate) : "—"}</span> },
  {
    key: "vscDocument",
    header: "VSC Document",
    minWidth: 130,
    cell: (r, ctx) => {
      const docs = vscDocumentsForDisplay(r.documents);
      if (!docs.length) return <Dash />;
      if (docs.length === 1) {
        return (
          <Button type="button" variant="link" size="sm" className="h-auto px-0 text-sm font-normal" onClick={() => ctx.openDoc(docs[0]!)}>
            View
          </Button>
        );
      }
      return (
        <Button type="button" variant="link" size="sm" className="h-auto px-0 text-sm font-normal" onClick={() => ctx.openDoc(docs[0]!)}>
          View documents
        </Button>
      );
    },
  },
  { key: "spokenEnglish", header: "Spoken English", minWidth: 130, cell: (r) => <span className="text-sm">{displaySpokenEnglish(r)}</span> },
  {
    key: "submitted",
    header: "Submitted",
    minWidth: 120,
    sortValue: (r) => r.submittedAt ?? "",
    cell: (r) => <span className="text-sm whitespace-nowrap">{fmtDate(r.submittedAt)}</span>,
  },
  {
    key: "resume",
    header: "Resume",
    minWidth: 108,
    cell: (r, ctx) => {
      const resume = resumeDocument(r.documents);
      if (!resume) return <Dash />;
      return (
        <Button type="button" variant="link" size="sm" className="h-auto px-0 text-sm font-normal" onClick={() => ctx.openDoc(resume)}>
          View resume
        </Button>
      );
    },
  },
];

const SHARED_AFTER: AppColumn[] = [
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
    key: "resume",
    header: "Resume",
    minWidth: 108,
    cell: (r, ctx) => {
      const resume = resumeDocument(r.documents);
      if (!resume) return <Dash />;
      return (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 text-sm font-normal"
          onClick={() => ctx.openDoc(resume)}
        >
          View resume
        </Button>
      );
    },
  },
  {
    key: "documents",
    header: "Documents",
    minWidth: 210,
    sortValue: (r) => complianceDocumentsForDisplay(r.documents).length,
    cell: (r, ctx) => (
      <DocumentChips docs={complianceDocumentsForDisplay(r.documents)} onOpen={ctx.openDoc} />
    ),
  },
];

/** Middle columns (Applicant / Actions are rendered by the table). */
export function columnsForRole(role: ApplicationRole): AppColumn[] {
  return role === "nanny" ? NANNY_COLUMNS : [...SHARED_BEFORE, ...SHARED_AFTER];
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

export function sortRows(rows: ApplicationRow[], sort: SortState, columns: AppColumn[]): ApplicationRow[] {
  if (!sort) {
    return [...rows].sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  }
  const getter: ((r: ApplicationRow) => string | number) | undefined =
    sort.key === "applicant"
      ? (r) => fullName(r).toLowerCase()
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

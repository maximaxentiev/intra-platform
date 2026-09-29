// Applications domain layer — types, read-only API client, label translation.
// Data source: the existing NestJS API (cookie session auth via @/lib/api).
// No Supabase, no second API architecture.
import { api } from "@/lib/api";

export type ApplicationRole = "eca" | "ece_rece" | "nanny";
/** Backend enum. UI label for `contacted` is "Interview". */
export type ApplicationStatus = "new" | "contacted" | "hired" | "rejected";

export type DocumentCategory =
  | "training_proof"
  | "qualification_certificate"
  | "eca_diploma"
  | "ece_diploma"
  | "rece_proof"
  | "resume"
  | "vulnerable_sector_check"
  | "first_aid_cpr"
  | "immunization_records"
  | "covid19_vaccination";

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  category: DocumentCategory;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  uploadedAt: string;
}

export interface ApplicationActivityEvent {
  id: string;
  applicationId: string;
  actorUserId: string | null;
  actorType: string;
  eventType: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApplicationListItem {
  id: string;
  status: ApplicationStatus;
  role: ApplicationRole;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  submittedAt: string;
  hiredStaffId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NannyApplicationOpsView {
  intakeVersion: "legacy" | "nanny_v2" | "historical_import";
  accuracyConfirmed: boolean | null;
  applicant: {
    preferredName: string | null;
    city: string | null;
    postalCode: string | null;
  };
  eligibility: {
    canCommuteGta: boolean | null;
    canadaStatus: string | null;
    legallyAuthorizedToWork: string | null;
    workPermitExpiry: string | null;
    workPermitChildcareRestrictions: string | null;
    authorizedOffCampus: string | null;
    workHourLimitStatus: string | null;
    maxWeeklyWorkHours: number | null;
  };
  experience: {
    hasChildcareExperience: boolean | null;
    years: string | null;
    types: string[];
    ageGroups: string[];
    specialExperienceTypes: string[];
    specialExperienceDescription: string | null;
  };
  qualifications: {
    educationCertifications: string[];
    educationProgramName: string | null;
  };
  compliance: {
    firstAidStatus: string | null;
    firstAidExpiry: string | null;
    vscStatus: string | null;
    vscIssueDate: string | null;
  };
  languages: {
    spokenEnglishRating: number | null;
  };
  legacyTraining?: {
    completed: boolean | null;
    description: string | null;
  };
}

export interface ApplicationDetail {
  id: string;
  status: ApplicationStatus;
  applicant: {
    role: ApplicationRole;
    firstName: string;
    middleName: string;
    lastName: string;
    preferredName?: string;
    email: string;
    phone: string;
    city?: string;
    postalCode?: string;
    gender: string;
  };
  eligibility: { gtaEligible: boolean | null; statusInCanada: string };
  experience: { duration: string; description?: string; nannyExperienceTypes: string[] };
  roleSpecific: {
    qualificationStatus: string;
    nannyTrainingCompleted: boolean | null;
    nannyTrainingDescription: string;
  };
  compliance: {
    vscStatus: string;
    vscIssueOrRequestDate: string | null;
    firstAidCprStatus: string;
    firstAidCprExpiry: string | null;
    immunizationStatus: string;
    covidVaccinationStatus: string;
  };
  languages: {
    englishProficiency: string;
    additionalLanguages: Array<{ language: string; proficiency: string }>;
  };
  metadata: {
    formId: string;
    sourcePage: string;
    sourceUrl: string;
    consentAccepted: boolean;
    consentPolicyVersion: string;
    consentAcceptedAt: string | null;
    submittedAt: string;
    accuracyConfirmed?: boolean | null;
    payloadSnapshot: Record<string, unknown>;
  };
  nanny?: NannyApplicationOpsView;
  workflow: {
    contactedAt: string | null;
    hiredAt: string | null;
    hiredStaffId: string | null;
    rejectedAt: string | null;
    rejectionEmailSentAt: string | null;
    reviewedAt: string | null;
  };
  documents: ApplicationDocument[];
  createdAt: string;
  updatedAt: string;
}

/** A list row enriched with its detail record (used by the table). */
export interface ApplicationRow extends ApplicationDetail {
  submittedAt: string;
  reviewedAt: string | null;
}

export interface ApplicationsPage {
  items: ApplicationListItem[];
  total: number;
  limit: number;
  offset: number;
}

export const applicationsApi = {
  list: (params: { role?: ApplicationRole; status?: ApplicationStatus; limit?: number; offset?: number }) =>
    api.get<ApplicationsPage>("/applications", params),
  get: (id: string) => api.get<ApplicationDetail>(`/applications/${id}`),
  activity: (id: string) => api.get<ApplicationActivityEvent[]>(`/applications/${id}/activity`),
  documents: (id: string) => api.get<ApplicationDocument[]>(`/applications/${id}/documents`),
  review: (id: string) =>
    api.post<ApplicationListItem>(`/applications/${id}/review`, {}),
};

/** Fetch every application for a role (list endpoint is paginated at 100). */
export async function fetchAllForRole(role: ApplicationRole): Promise<ApplicationListItem[]> {
  const out: ApplicationListItem[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await applicationsApi.list({ role, limit: 100, offset });
    out.push(...page.items);
    offset += page.limit;
    if (out.length >= page.total || page.items.length === 0) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const ROLE_TABS: { role: ApplicationRole; label: string }[] = [
  { role: "eca", label: "ECA" },
  { role: "ece_rece", label: "ECE" },
  { role: "nanny", label: "Nanny" },
];

export function roleLabel(role: ApplicationRole): string {
  return ROLE_TABS.find((r) => r.role === role)?.label ?? humanize(role);
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "New",
  contacted: "Interview",
  rejected: "Rejected",
  hired: "Hired",
};

export const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((v) => ({
  value: v,
  label: STATUS_LABELS[v],
}));

export const DOCUMENT_LABELS: Record<DocumentCategory, string> = {
  vulnerable_sector_check: "Vulnerable Sector Check",
  first_aid_cpr: "First Aid & CPR",
  immunization_records: "Immunization Records",
  qualification_certificate: "Qualification Certificate",
  eca_diploma: "ECA Diploma",
  ece_diploma: "ECE Diploma",
  rece_proof: "RECE Proof",
  resume: "Resume",
  training_proof: "Nanny Training Proof",
  covid19_vaccination: "COVID-19 Vaccination Proof",
};

export const DOCUMENT_SHORT_LABELS: Record<DocumentCategory, string> = {
  vulnerable_sector_check: "VSC",
  first_aid_cpr: "First Aid",
  immunization_records: "Immunizations",
  qualification_certificate: "Qualification",
  eca_diploma: "ECA Diploma",
  ece_diploma: "ECE Diploma",
  rece_proof: "RECE Proof",
  resume: "Resume",
  training_proof: "Training",
  covid19_vaccination: "COVID-19",
};

export function resumeDocument(documents: ApplicationDocument[]): ApplicationDocument | undefined {
  return documents.find((doc) => doc.category === "resume");
}

export function complianceDocumentsForDisplay(documents: ApplicationDocument[]): ApplicationDocument[] {
  return documents.filter((doc) => doc.category !== "resume");
}

export function vscDocumentsForDisplay(documents: ApplicationDocument[]): ApplicationDocument[] {
  return documents.filter((doc) => doc.category === "vulnerable_sector_check");
}

/** Known coded answers → human labels. Unknown codes fall back to humanize(). */
const VALUE_LABELS: Record<string, string> = {
  // Experience duration
  none: "No experience",
  "0_6m": "Less than 6 months",
  "6m_1y": "6 months – 1 year",
  "1_2y": "1–2 years",
  "2_5y": "2–5 years",
  "5y_plus": "5+ years",
  "5_plus": "5+ years",
  // Status in Canada
  citizen: "Canadian citizen",
  permanent_resident: "Permanent resident",
  work_permit: "Work permit",
  study_permit: "Study permit",
  other: "Other",
  // Qualification
  eca_canada: "ECA certificate/diploma from Canada",
  eca_international: "ECA certificate/diploma from outside Canada",
  ece_canada: "ECE diploma/degree from Canada",
  ece_international: "ECE diploma/degree from outside Canada",
  rece_registered: "Registered ECE (RECE) in good standing",
  in_progress: "In progress",
  not_qualified: "Not qualified",
  // Proficiency
  native: "Native",
  fluent: "Fluent",
  advanced: "Advanced",
  intermediate: "Intermediate",
  basic: "Basic",
  beginner: "Beginner",
  conversational: "Conversational",
  // Compliance answers
  yes: "Yes",
  no: "No",
  provided: "Provided",
  not_provided: "Not provided",
  requested: "Requested",
  in_progress_vsc: "In progress",
  valid: "Valid",
  expired: "Expired",
  vaccinated: "Vaccinated",
  not_vaccinated: "Not vaccinated",
  prefer_not_to_say: "Prefer not to say",
  // Gender
  male: "Male",
  female: "Female",
  non_binary: "Non-binary",
  // Experience types
  nanny: "Nanny",
  babysitting: "Babysitting",
  daycare: "Daycare",
  school: "School",
  camp: "Camp",
};

export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** Translate a raw backend code into an operations-friendly label. */
export function label(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const key = String(value).trim();
  if (!key) return "";
  return VALUE_LABELS[key.toLowerCase()] ?? humanize(key);
}

const AFFIRMATIVE = new Set([
  "yes",
  "true",
  "provided",
  "completed",
  "complete",
  "valid",
  "has",
  "have",
  "vaccinated",
  "up_to_date",
  "current",
]);
const NEGATIVE = new Set(["no", "false", "none", "not_provided", "missing", "not_vaccinated"]);

/** Interpret a free-text compliance answer as Yes / No / unknown. */
export function asYesNo(value: string | boolean | null | undefined): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const key = value.trim().toLowerCase();
  if (AFFIRMATIVE.has(key)) return true;
  if (NEGATIVE.has(key)) return false;
  return null;
}

export function fullName(a: {
  applicant: { firstName: string; middleName: string; lastName: string };
}): string {
  return [a.applicant.firstName, a.applicant.middleName, a.applicant.lastName]
    .filter(Boolean)
    .join(" ");
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function fmtBytes(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

export type FileKind = "pdf" | "image" | "word" | "other";

export function fileKind(doc: Pick<ApplicationDocument, "contentType" | "originalFilename">): FileKind {
  const ct = (doc.contentType || "").toLowerCase();
  const name = (doc.originalFilename || "").toLowerCase();
  if (ct.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (ct.startsWith("image/") || /\.(png|jpe?g)$/.test(name)) return "image";
  if (ct.includes("word") || ct.includes("msword") || /\.(docx?|)$/.test(name) === false) {
    if (ct.includes("word") || ct.includes("msword") || /\.docx?$/.test(name)) return "word";
  }
  if (/\.docx?$/.test(name)) return "word";
  return "other";
}

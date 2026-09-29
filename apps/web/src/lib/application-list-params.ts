import type { ApplicationRole, ApplicationStatus } from "@/lib/applications";
import { EMPTY_FILTERS, type ApplicationFilters } from "@/lib/application-filters-types";

export type ApplicationListSort = {
  sortBy?: "submittedAt" | "createdAt" | "applicant" | "email" | "status" | "reviewedAt";
  sortDir?: "asc" | "desc";
};

export type ApplicationListSearchState = {
  role: ApplicationRole;
  q: string;
  page: number;
  filters: ApplicationFilters;
  sort: ApplicationListSort;
};

function csv(values: string[]): string | undefined {
  if (!values.length) return undefined;
  return values.join(",");
}

function triMap(v: string): "yes" | "no" | "any" | "missing" | undefined {
  if (v === "any") return undefined;
  return v as "yes" | "no" | "missing";
}

/** Maps UI filters + search to GET /applications query params. */
export function applicationFiltersToApiParams(
  role: ApplicationRole,
  search: string,
  filters: ApplicationFilters,
  page: number,
  pageSize: number,
  sort: ApplicationListSort,
): Record<string, string | number | undefined> {
  const offset = page * pageSize;
  return {
    role,
    limit: pageSize,
    offset,
    q: search.trim() || undefined,
    status: filters.status !== "any" ? (filters.status as ApplicationStatus) : undefined,
    reviewed: filters.reviewed !== "any" ? filters.reviewed : undefined,
    intakeVersion: filters.intakeVersion.length ? csv(filters.intakeVersion) : undefined,
    firstName: filters.firstName.trim() || undefined,
    lastName: filters.lastName.trim() || undefined,
    preferredName: filters.preferredName.trim() || undefined,
    email: filters.email.trim() || undefined,
    phone: filters.phone.trim() || undefined,
    city: filters.city.trim() || undefined,
    postalCode: filters.postalCode.trim() || undefined,
    statusInCanada: filters.statusInCanada !== "any" ? filters.statusInCanada : undefined,
    experienceDuration: filters.experience !== "any" ? filters.experience : undefined,
    qualificationStatus: filters.qualification !== "any" ? filters.qualification : undefined,
    gender: filters.gender !== "any" ? filters.gender : undefined,
    englishProficiency: filters.english !== "any" ? filters.english : undefined,
    gtaEligible: triMap(filters.gtaEligible),
    trainingCompleted: triMap(filters.trainingCompleted),
    hasChildcareExperience: triMap(filters.hasChildcareExperience),
    accuracyConfirmed: triMap(filters.accuracyConfirmed),
    consentAccepted: triMap(filters.consentAccepted),
    vscYesNo: triMap(filters.vsc),
    firstAidYesNo: triMap(filters.firstAid),
    immunizationYesNo: triMap(filters.immunizations),
    covid: filters.covid !== "any" ? filters.covid : undefined,
    vscStatus: filters.vscStatusValues.length ? csv(filters.vscStatusValues) : undefined,
    firstAidStatus: filters.firstAidStatusValues.length ? csv(filters.firstAidStatusValues) : undefined,
    experienceTypes: filters.experienceTypes.length ? csv(filters.experienceTypes) : undefined,
    experienceTypesMatch: filters.experienceTypesMatch,
    ageGroups: filters.ageGroups.length ? csv(filters.ageGroups) : undefined,
    ageGroupsMatch: filters.ageGroupsMatch,
    specialExperienceTypes: filters.specialExperienceTypes.length
      ? csv(filters.specialExperienceTypes)
      : undefined,
    educationCertifications: filters.educationCertifications.length
      ? csv(filters.educationCertifications)
      : undefined,
    educationCertificationsMatch: filters.educationCertificationsMatch,
    languages: filters.languages.length ? csv(filters.languages) : undefined,
    legallyAuthorizedToWork: filters.legallyAuthorizedToWork.trim() || undefined,
    workPermitChildcareRestrictions: filters.workPermitChildcareRestrictions.trim() || undefined,
    authorizedOffCampus: filters.authorizedOffCampus.trim() || undefined,
    workHourLimitStatus: filters.workHourLimitStatus.trim() || undefined,
    educationProgramName: filters.educationProgramName.trim() || undefined,
    maxWeeklyHoursMin: filters.maxWeeklyHoursMin.trim()
      ? Number(filters.maxWeeklyHoursMin)
      : undefined,
    maxWeeklyHoursMax: filters.maxWeeklyHoursMax.trim()
      ? Number(filters.maxWeeklyHoursMax)
      : undefined,
    spokenEnglishMin: filters.spokenEnglishMin.trim() ? Number(filters.spokenEnglishMin) : undefined,
    spokenEnglishMax: filters.spokenEnglishMax.trim() ? Number(filters.spokenEnglishMax) : undefined,
    submittedFrom: filters.submittedFrom || undefined,
    submittedTo: filters.submittedTo || undefined,
    createdFrom: filters.createdFrom || undefined,
    createdTo: filters.createdTo || undefined,
    vscDateFrom: filters.vscFrom || undefined,
    vscDateTo: filters.vscTo || undefined,
    firstAidExpiryFrom: filters.cprFrom || undefined,
    firstAidExpiryTo: filters.cprTo || undefined,
    workPermitExpiryFrom: filters.workPermitExpiryFrom || undefined,
    workPermitExpiryTo: filters.workPermitExpiryTo || undefined,
    hasResume: filters.hasResume !== "any" ? filters.hasResume : undefined,
    hasVscDocument: filters.hasVscDocument !== "any" ? filters.hasVscDocument : undefined,
    sortBy: sort.sortBy,
    sortDir: sort.sortDir,
  };
}

export function serializeApplicationSearch(state: ApplicationListSearchState): Record<string, string> {
  const out: Record<string, string> = {
    role: state.role,
    page: String(state.page),
  };
  if (state.q.trim()) out.q = state.q.trim();
  if (state.sort.sortBy) out.sortBy = state.sort.sortBy;
  if (state.sort.sortDir) out.sortDir = state.sort.sortDir;

  const f = state.filters;
  if (f.status !== "any") out.status = f.status;
  if (f.reviewed !== "any") out.reviewed = f.reviewed;
  if (f.intakeVersion.length) out.intake = f.intakeVersion.join(",");
  if (f.firstName.trim()) out.firstName = f.firstName.trim();
  if (f.lastName.trim()) out.lastName = f.lastName.trim();
  if (f.preferredName.trim()) out.preferredName = f.preferredName.trim();
  if (f.email.trim()) out.email = f.email.trim();
  if (f.phone.trim()) out.phone = f.phone.trim();
  if (f.city.trim()) out.city = f.city.trim();
  if (f.postalCode.trim()) out.postalCode = f.postalCode.trim();
  if (f.statusInCanada !== "any") out.statusInCanada = f.statusInCanada;
  if (f.experience !== "any") out.experience = f.experience;
  if (f.qualification !== "any") out.qualification = f.qualification;
  if (f.gender !== "any") out.gender = f.gender;
  if (f.english !== "any") out.english = f.english;
  if (f.gtaEligible !== "any") out.gtaEligible = f.gtaEligible;
  if (f.trainingCompleted !== "any") out.trainingCompleted = f.trainingCompleted;
  if (f.hasChildcareExperience !== "any") out.hasChildcareExperience = f.hasChildcareExperience;
  if (f.accuracyConfirmed !== "any") out.accuracyConfirmed = f.accuracyConfirmed;
  if (f.consentAccepted !== "any") out.consentAccepted = f.consentAccepted;
  if (f.vsc !== "any") out.vsc = f.vsc;
  if (f.firstAid !== "any") out.firstAid = f.firstAid;
  if (f.immunizations !== "any") out.immunizations = f.immunizations;
  if (f.covid !== "any") out.covid = f.covid;
  if (f.vscStatusValues.length) out.vscStatus = f.vscStatusValues.join(",");
  if (f.firstAidStatusValues.length) out.firstAidStatus = f.firstAidStatusValues.join(",");
  if (f.experienceTypes.length) out.experienceTypes = f.experienceTypes.join(",");
  if (f.ageGroups.length) out.ageGroups = f.ageGroups.join(",");
  if (f.specialExperienceTypes.length) out.specialExperienceTypes = f.specialExperienceTypes.join(",");
  if (f.educationCertifications.length) out.educationCertifications = f.educationCertifications.join(",");
  if (f.languages.length) out.languages = f.languages.join(",");
  if (f.spokenEnglishMin.trim()) out.spokenEnglishMin = f.spokenEnglishMin.trim();
  if (f.spokenEnglishMax.trim()) out.spokenEnglishMax = f.spokenEnglishMax.trim();
  if (f.hasResume !== "any") out.hasResume = f.hasResume;
  if (f.hasVscDocument !== "any") out.hasVscDocument = f.hasVscDocument;
  if (f.submittedFrom) out.submittedFrom = f.submittedFrom;
  if (f.submittedTo) out.submittedTo = f.submittedTo;
  if (f.createdFrom) out.createdFrom = f.createdFrom;
  if (f.createdTo) out.createdTo = f.createdTo;
  if (f.vscFrom) out.vscFrom = f.vscFrom;
  if (f.vscTo) out.vscTo = f.vscTo;
  if (f.cprFrom) out.cprFrom = f.cprFrom;
  if (f.cprTo) out.cprTo = f.cprTo;
  if (f.workPermitExpiryFrom) out.workPermitExpiryFrom = f.workPermitExpiryFrom;
  if (f.workPermitExpiryTo) out.workPermitExpiryTo = f.workPermitExpiryTo;
  return out;
}

export function deserializeApplicationSearch(raw: Record<string, unknown>): ApplicationListSearchState {
  const str = (k: string) => (typeof raw[k] === "string" ? raw[k] : "");
  const roleRaw = str("role");
  const role: ApplicationRole =
    roleRaw === "nanny" || roleRaw === "ece_rece" || roleRaw === "eca" ? roleRaw : "eca";
  const pageNum = Number(raw.page);
  const page = Number.isFinite(pageNum) && pageNum >= 0 ? pageNum : 0;
  const split = (k: string) =>
    str(k)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    role,
    q: str("q"),
    page,
    sort: {
      sortBy: (str("sortBy") || undefined) as ApplicationListSort["sortBy"],
      sortDir: (str("sortDir") || undefined) as ApplicationListSort["sortDir"],
    },
    filters: {
      ...EMPTY_FILTERS,
      status: str("status") || "any",
      reviewed: (str("reviewed") || "any") as ApplicationFilters["reviewed"],
      intakeVersion: split("intake"),
      firstName: str("firstName"),
      lastName: str("lastName"),
      preferredName: str("preferredName"),
      email: str("email"),
      phone: str("phone"),
      city: str("city"),
      postalCode: str("postalCode"),
      statusInCanada: str("statusInCanada") || "any",
      experience: str("experience") || "any",
      qualification: str("qualification") || "any",
      gender: str("gender") || "any",
      english: str("english") || "any",
      gtaEligible: (str("gtaEligible") || "any") as ApplicationFilters["gtaEligible"],
      trainingCompleted: (str("trainingCompleted") || "any") as ApplicationFilters["trainingCompleted"],
      hasChildcareExperience: (str("hasChildcareExperience") || "any") as ApplicationFilters["hasChildcareExperience"],
      accuracyConfirmed: (str("accuracyConfirmed") || "any") as ApplicationFilters["accuracyConfirmed"],
      consentAccepted: (str("consentAccepted") || "any") as ApplicationFilters["consentAccepted"],
      vsc: (str("vsc") || "any") as ApplicationFilters["vsc"],
      firstAid: (str("firstAid") || "any") as ApplicationFilters["firstAid"],
      immunizations: (str("immunizations") || "any") as ApplicationFilters["immunizations"],
      covid: (str("covid") || "any") as ApplicationFilters["covid"],
      vscStatusValues: split("vscStatus"),
      firstAidStatusValues: split("firstAidStatus"),
      experienceTypes: split("experienceTypes"),
      ageGroups: split("ageGroups"),
      specialExperienceTypes: split("specialExperienceTypes"),
      educationCertifications: split("educationCertifications"),
      languages: split("languages"),
      spokenEnglishMin: str("spokenEnglishMin"),
      spokenEnglishMax: str("spokenEnglishMax"),
      hasResume: (str("hasResume") || "any") as ApplicationFilters["hasResume"],
      hasVscDocument: (str("hasVscDocument") || "any") as ApplicationFilters["hasVscDocument"],
      submittedFrom: str("submittedFrom"),
      submittedTo: str("submittedTo"),
      createdFrom: str("createdFrom"),
      createdTo: str("createdTo"),
      vscFrom: str("vscFrom"),
      vscTo: str("vscTo"),
      cprFrom: str("cprFrom"),
      cprTo: str("cprTo"),
      workPermitExpiryFrom: str("workPermitExpiryFrom"),
      workPermitExpiryTo: str("workPermitExpiryTo"),
    },
  };
}

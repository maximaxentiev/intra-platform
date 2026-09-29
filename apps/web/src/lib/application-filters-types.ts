export type TriState = "any" | "yes" | "no" | "missing";

export interface ApplicationFilters {
  status: string;
  reviewed: "any" | "yes" | "no";
  intakeVersion: string[];
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  phone: string;
  city: string;
  postalCode: string;
  statusInCanada: string;
  experience: string;
  qualification: string;
  trainingCompleted: TriState;
  hasChildcareExperience: TriState;
  experienceTypes: string[];
  experienceTypesMatch: "any" | "all";
  ageGroups: string[];
  ageGroupsMatch: "any" | "all";
  specialExperienceTypes: string[];
  educationCertifications: string[];
  educationCertificationsMatch: "any" | "all";
  gtaEligible: TriState;
  vsc: TriState;
  firstAid: TriState;
  vscStatusValues: string[];
  firstAidStatusValues: string[];
  immunizations: TriState;
  covid: "any" | "yes" | "no" | "not_provided";
  gender: string;
  english: string;
  languages: string[];
  accuracyConfirmed: TriState;
  consentAccepted: TriState;
  spokenEnglishMin: string;
  spokenEnglishMax: string;
  hasResume: "any" | "yes" | "no";
  hasVscDocument: "any" | "yes" | "no";
  legallyAuthorizedToWork: string;
  workPermitChildcareRestrictions: string;
  authorizedOffCampus: string;
  workHourLimitStatus: string;
  educationProgramName: string;
  maxWeeklyHoursMin: string;
  maxWeeklyHoursMax: string;
  submittedFrom: string;
  submittedTo: string;
  createdFrom: string;
  createdTo: string;
  vscFrom: string;
  vscTo: string;
  cprFrom: string;
  cprTo: string;
  workPermitExpiryFrom: string;
  workPermitExpiryTo: string;
}

export const EMPTY_FILTERS: ApplicationFilters = {
  status: "any",
  reviewed: "any",
  intakeVersion: [],
  firstName: "",
  lastName: "",
  preferredName: "",
  email: "",
  phone: "",
  city: "",
  postalCode: "",
  statusInCanada: "any",
  experience: "any",
  qualification: "any",
  trainingCompleted: "any",
  hasChildcareExperience: "any",
  experienceTypes: [],
  experienceTypesMatch: "any",
  ageGroups: [],
  ageGroupsMatch: "any",
  specialExperienceTypes: [],
  educationCertifications: [],
  educationCertificationsMatch: "any",
  gtaEligible: "any",
  vsc: "any",
  firstAid: "any",
  vscStatusValues: [],
  firstAidStatusValues: [],
  immunizations: "any",
  covid: "any",
  gender: "any",
  english: "any",
  languages: [],
  accuracyConfirmed: "any",
  consentAccepted: "any",
  spokenEnglishMin: "",
  spokenEnglishMax: "",
  hasResume: "any",
  hasVscDocument: "any",
  legallyAuthorizedToWork: "",
  workPermitChildcareRestrictions: "",
  authorizedOffCampus: "",
  workHourLimitStatus: "",
  educationProgramName: "",
  maxWeeklyHoursMin: "",
  maxWeeklyHoursMax: "",
  submittedFrom: "",
  submittedTo: "",
  createdFrom: "",
  createdTo: "",
  vscFrom: "",
  vscTo: "",
  cprFrom: "",
  cprTo: "",
  workPermitExpiryTo: "",
  workPermitExpiryFrom: "",
};

import type { MappedHistoricalRow } from './nanny-applicants-csv.map';

export function toHistoricalApplicationInsert(row: MappedHistoricalRow) {
  const p = row.payload;
  const applicant = p.applicant;
  return {
    status: 'new' as const,
    role: 'nanny' as const,
    firstName: applicant.firstName ?? '',
    lastName: applicant.lastName ?? '',
    preferredName: applicant.preferredName ?? '',
    email: applicant.email ?? '',
    phone: applicant.phone ?? '',
    city: applicant.city ?? '',
    postalCode: applicant.postalCode ?? '',
    gender: applicant.gender ?? '',
    accuracyConfirmed: null,
    gtaEligible: typeof p.eligibility.canCommuteGta === 'boolean' ? p.eligibility.canCommuteGta : null,
    statusInCanada: (p.eligibility.canadaStatus as string) ?? '',
    experienceDuration: (p.experience.years as string) ?? '',
    childcareExperience: (p.experience.specialExperienceDescription as string) ?? '',
    nannyExperienceTypes: (p.experience.types as string[]) ?? [],
    qualificationStatus: '',
    vscStatus: p.compliance.vscStatus ?? '',
    vscIssueOrRequestDate: p.compliance.vscIssueDate,
    firstAidCprStatus: p.compliance.firstAidStatus ?? '',
    firstAidCprExpiry: p.compliance.firstAidExpiry,
    immunizationStatus: '',
    covidVaccinationStatus: 'not_provided',
    englishProficiency:
      p.languages.spokenEnglishRating != null ? String(p.languages.spokenEnglishRating) : '',
    formId: 'historical-import',
    externalSubmissionId: row.externalSubmissionId,
    sourcePage: 'fillout-historical-import',
    sourceUrl: '',
    consentAccepted: false,
    consentPolicyVersion: '',
    consentAcceptedAt: null,
    payloadSnapshot: p as unknown as Record<string, unknown>,
  };
}

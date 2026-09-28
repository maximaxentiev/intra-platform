import { randomUUID } from 'node:crypto';
import { NANNY_CONSENT_POLICY_VERSION } from './network-submit-nanny.constants';

export function buildNannyV2ApplicationJson(
  overrides: {
    externalApplicationId?: string;
    canCommuteGta?: boolean;
    legallyAuthorizedToWork?: string;
    canadaStatus?: string;
    workPermitExpiry?: string | null;
    workPermitChildcareRestrictions?: string | null;
    authorizedOffCampus?: string | null;
    workHourLimitStatus?: string | null;
    maxWeeklyWorkHours?: number | null;
    hasChildcareExperience?: boolean;
    firstAidStatus?: string;
    firstAidExpiry?: string | null;
    vscStatus?: string;
    vscIssueDate?: string | null;
    spokenEnglishRating?: number;
    educationCertifications?: string[];
    educationProgramName?: string | null;
    experienceTypes?: string[];
    accuracyConfirmed?: boolean;
    consentPolicyVersion?: string;
    documents?: Array<Record<string, unknown>>;
  } = {},
) {
  const externalApplicationId = overrides.externalApplicationId ?? randomUUID();
  const resumeId = randomUUID();
  const documents =
    overrides.documents ??
    ([
      {
        id: resumeId,
        category: 'resume',
        originalFilename: 'resume.pdf',
        contentType: 'application/pdf',
        size: 2048,
      },
    ] as Array<Record<string, unknown>>);

  return {
    metadata: {
      formId: 'join-the-network',
      externalApplicationId,
      submittedAt: '2026-09-28T12:00:00.000Z',
      sourcePage: '/join-the-network',
      sourceUrl: 'https://example.test/join-the-network',
      consentAccepted: true,
      consentPolicyVersion: overrides.consentPolicyVersion ?? NANNY_CONSENT_POLICY_VERSION,
    },
    role: 'Nanny',
    accuracyConfirmed: overrides.accuracyConfirmed ?? true,
    applicant: {
      firstName: 'Nora',
      lastName: 'Nanny',
      preferredName: 'Nor',
      email: `nora-${externalApplicationId.slice(0, 8)}@example.test`,
      phone: '4165550199',
      city: 'Toronto',
      postalCode: 'M5V 1A1',
      gender: 'Woman',
    },
    eligibility: {
      canCommuteGta: overrides.canCommuteGta ?? true,
      canadaStatus: overrides.canadaStatus ?? 'Canadian citizen',
      legallyAuthorizedToWork: overrides.legallyAuthorizedToWork ?? 'Yes',
      workPermitExpiry: overrides.workPermitExpiry ?? null,
      workPermitChildcareRestrictions: overrides.workPermitChildcareRestrictions ?? null,
      authorizedOffCampus: overrides.authorizedOffCampus ?? null,
      workHourLimitStatus: overrides.workHourLimitStatus ?? null,
      maxWeeklyWorkHours: overrides.maxWeeklyWorkHours ?? null,
    },
    experience: {
      hasChildcareExperience: overrides.hasChildcareExperience ?? true,
      years: '3 to 5 years',
      types: overrides.experienceTypes ?? ['Nanny', 'Babysitter'],
      ageGroups: ['Preschool: 3 to 5 years', 'School age: 6 to 12 years'],
      specialExperienceTypes: ['Infants', 'Sleep routines'],
      specialExperienceDescription: 'Comfortable with overnight care.',
    },
    qualifications: {
      educationCertifications: overrides.educationCertifications ?? ['ECE diploma'],
      educationProgramName:
        overrides.educationProgramName !== undefined
          ? overrides.educationProgramName
          : 'Humber College ECE',
    },
    compliance: {
      firstAidStatus: overrides.firstAidStatus ?? 'Yes',
      firstAidExpiry:
        overrides.firstAidExpiry !== undefined ? overrides.firstAidExpiry : '2027-06-01',
      vscStatus: overrides.vscStatus ?? 'No',
      vscIssueDate: overrides.vscIssueDate !== undefined ? overrides.vscIssueDate : null,
    },
    languages: {
      spokenEnglishRating: overrides.spokenEnglishRating ?? 8,
    },
    documents,
  };
}

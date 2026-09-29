import type { applications } from '../db/schema';

export interface NannyApplicationOpsView {
  intakeVersion: 'legacy' | 'nanny_v2' | 'historical_import';
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t : null;
}

function boolOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'boolean' ? value : null;
}

function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  return null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

export function buildNannyApplicationOpsView(
  row: typeof applications.$inferSelect,
): NannyApplicationOpsView | null {
  if (row.role !== 'nanny') return null;

  const snapshot = row.payloadSnapshot ?? {};
  const intakeVersionRaw = stringOrNull(snapshot.intakeVersion as string | undefined);
  const isHistoricalImport = intakeVersionRaw === 'historical_import';
  const eligibilitySnap = asObject(snapshot.eligibility);
  const isV2 =
    !isHistoricalImport && eligibilitySnap !== null && 'canCommuteGta' in eligibilitySnap;

  if (isHistoricalImport) {
    const applicant = asObject(snapshot.applicant);
    const experience = asObject(snapshot.experience);
    const qualifications = asObject(snapshot.qualifications);
    const compliance = asObject(snapshot.compliance);
    const languages = asObject(snapshot.languages);

    return {
      intakeVersion: 'historical_import',
      accuracyConfirmed: row.accuracyConfirmed ?? null,
      applicant: {
        preferredName: stringOrNull(applicant?.preferredName) ?? stringOrNull(row.preferredName),
        city: stringOrNull(applicant?.city) ?? stringOrNull(row.city),
        postalCode: stringOrNull(applicant?.postalCode) ?? stringOrNull(row.postalCode),
      },
      eligibility: {
        canCommuteGta: boolOrNull(eligibilitySnap?.canCommuteGta) ?? row.gtaEligible,
        canadaStatus: stringOrNull(eligibilitySnap?.canadaStatus) ?? stringOrNull(row.statusInCanada),
        legallyAuthorizedToWork: stringOrNull(eligibilitySnap?.legallyAuthorizedToWork),
        workPermitExpiry: stringOrNull(eligibilitySnap?.workPermitExpiry),
        workPermitChildcareRestrictions: stringOrNull(eligibilitySnap?.workPermitChildcareRestrictions),
        authorizedOffCampus: stringOrNull(eligibilitySnap?.authorizedOffCampus),
        workHourLimitStatus: stringOrNull(eligibilitySnap?.workHourLimitStatus),
        maxWeeklyWorkHours: intOrNull(eligibilitySnap?.maxWeeklyWorkHours),
      },
      experience: {
        hasChildcareExperience: boolOrNull(experience?.hasChildcareExperience),
        years: stringOrNull(experience?.years) ?? stringOrNull(row.experienceDuration),
        types: stringArray(experience?.types).length
          ? stringArray(experience?.types)
          : row.nannyExperienceTypes ?? [],
        ageGroups: stringArray(experience?.ageGroups),
        specialExperienceTypes: stringArray(experience?.specialExperienceTypes),
        specialExperienceDescription:
          stringOrNull(experience?.specialExperienceDescription) ?? stringOrNull(row.childcareExperience),
      },
      qualifications: {
        educationCertifications: stringArray(qualifications?.educationCertifications),
        educationProgramName: stringOrNull(qualifications?.educationProgramName),
      },
      compliance: {
        firstAidStatus: stringOrNull(compliance?.firstAidStatus) ?? stringOrNull(row.firstAidCprStatus),
        firstAidExpiry: stringOrNull(compliance?.firstAidExpiry) ?? stringOrNull(row.firstAidCprExpiry),
        vscStatus: stringOrNull(compliance?.vscStatus) ?? stringOrNull(row.vscStatus),
        vscIssueDate: stringOrNull(compliance?.vscIssueDate) ?? stringOrNull(row.vscIssueOrRequestDate),
      },
      languages: {
        spokenEnglishRating: intOrNull(languages?.spokenEnglishRating),
      },
    };
  }

  if (isV2) {
    const applicant = asObject(snapshot.applicant);
    const experience = asObject(snapshot.experience);
    const qualifications = asObject(snapshot.qualifications);
    const compliance = asObject(snapshot.compliance);
    const languages = asObject(snapshot.languages);

    return {
      intakeVersion: 'nanny_v2',
      accuracyConfirmed: boolOrNull(snapshot.accuracyConfirmed) ?? row.accuracyConfirmed ?? null,
      applicant: {
        preferredName: stringOrNull(applicant?.preferredName) ?? stringOrNull(row.preferredName),
        city: stringOrNull(applicant?.city) ?? stringOrNull(row.city),
        postalCode: stringOrNull(applicant?.postalCode) ?? stringOrNull(row.postalCode),
      },
      eligibility: {
        canCommuteGta: boolOrNull(eligibilitySnap?.canCommuteGta) ?? row.gtaEligible,
        canadaStatus: stringOrNull(eligibilitySnap?.canadaStatus) ?? stringOrNull(row.statusInCanada),
        legallyAuthorizedToWork: stringOrNull(eligibilitySnap?.legallyAuthorizedToWork),
        workPermitExpiry: stringOrNull(eligibilitySnap?.workPermitExpiry),
        workPermitChildcareRestrictions: stringOrNull(eligibilitySnap?.workPermitChildcareRestrictions),
        authorizedOffCampus: stringOrNull(eligibilitySnap?.authorizedOffCampus),
        workHourLimitStatus: stringOrNull(eligibilitySnap?.workHourLimitStatus),
        maxWeeklyWorkHours: intOrNull(eligibilitySnap?.maxWeeklyWorkHours),
      },
      experience: {
        hasChildcareExperience: boolOrNull(experience?.hasChildcareExperience),
        years: stringOrNull(experience?.years) ?? stringOrNull(row.experienceDuration),
        types: stringArray(experience?.types).length
          ? stringArray(experience?.types)
          : row.nannyExperienceTypes ?? [],
        ageGroups: stringArray(experience?.ageGroups),
        specialExperienceTypes: stringArray(experience?.specialExperienceTypes),
        specialExperienceDescription:
          stringOrNull(experience?.specialExperienceDescription) ?? stringOrNull(row.childcareExperience),
      },
      qualifications: {
        educationCertifications: stringArray(qualifications?.educationCertifications),
        educationProgramName: stringOrNull(qualifications?.educationProgramName),
      },
      compliance: {
        firstAidStatus: stringOrNull(compliance?.firstAidStatus) ?? stringOrNull(row.firstAidCprStatus),
        firstAidExpiry: stringOrNull(compliance?.firstAidExpiry) ?? stringOrNull(row.firstAidCprExpiry),
        vscStatus: stringOrNull(compliance?.vscStatus) ?? stringOrNull(row.vscStatus),
        vscIssueDate: stringOrNull(compliance?.vscIssueDate) ?? stringOrNull(row.vscIssueOrRequestDate),
      },
      languages: {
        spokenEnglishRating: intOrNull(languages?.spokenEnglishRating),
      },
    };
  }

  const rating = intOrNull(row.englishProficiency);
  return {
    intakeVersion: 'legacy',
    accuracyConfirmed: row.accuracyConfirmed ?? null,
    applicant: {
      preferredName: stringOrNull(row.preferredName),
      city: stringOrNull(row.city),
      postalCode: stringOrNull(row.postalCode),
    },
    eligibility: {
      canCommuteGta: row.gtaEligible,
      canadaStatus: stringOrNull(row.statusInCanada),
      legallyAuthorizedToWork: null,
      workPermitExpiry: null,
      workPermitChildcareRestrictions: null,
      authorizedOffCampus: null,
      workHourLimitStatus: null,
      maxWeeklyWorkHours: null,
    },
    experience: {
      hasChildcareExperience: null,
      years: stringOrNull(row.experienceDuration),
      types: row.nannyExperienceTypes ?? [],
      ageGroups: [],
      specialExperienceTypes: [],
      specialExperienceDescription: stringOrNull(row.childcareExperience),
    },
    qualifications: {
      educationCertifications: [],
      educationProgramName: null,
    },
    compliance: {
      firstAidStatus: stringOrNull(row.firstAidCprStatus),
      firstAidExpiry: stringOrNull(row.firstAidCprExpiry),
      vscStatus: stringOrNull(row.vscStatus),
      vscIssueDate: stringOrNull(row.vscIssueOrRequestDate),
    },
    languages: {
      spokenEnglishRating: rating,
    },
    legacyTraining: {
      completed: row.nannyTrainingCompleted,
      description: stringOrNull(row.nannyTrainingDescription),
    },
  };
}

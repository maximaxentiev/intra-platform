import { BadRequestException } from '@nestjs/common';
import { torontoTodayDateString } from '../availability/availability-toronto.util';
import {
  DOCUMENT_CATEGORY_VALUES,
  DOC_FIELD_PREFIX,
  NETWORK_SUBMIT_MAX_FILES,
  NETWORK_SUBMIT_MAX_FILE_BYTES,
  NETWORK_SUBMIT_MAX_TOTAL_BYTES,
  RESUME_DOCUMENT_CATEGORY,
  RESUME_MAX_FILE_BYTES,
  type DocumentCategoryValue,
} from './network-submit.constants';
import {
  NANNY_AGE_GROUP_EXCLUSIVE,
  NANNY_AGE_GROUPS,
  NANNY_CANADA_STATUSES,
  NANNY_CITIES,
  NANNY_CONSENT_POLICY_VERSION,
  NANNY_EDUCATION_CERTIFICATIONS,
  NANNY_EDUCATION_EXCLUSIVE,
  NANNY_EXPERIENCE_TYPE_EXCLUSIVE,
  NANNY_EXPERIENCE_TYPES,
  NANNY_EXPERIENCE_YEARS,
  NANNY_FIRST_AID_STATUSES,
  NANNY_GENDERS,
  NANNY_LEGAL_AUTHORIZATION,
  NANNY_RESUME_ALLOWED_EXTENSIONS,
  NANNY_RESUME_ALLOWED_MIMES,
  NANNY_SPECIAL_EXPERIENCE,
  NANNY_SPECIAL_EXPERIENCE_EXCLUSIVE,
  NANNY_STUDY_OFF_CAMPUS,
  NANNY_VSC_ALLOWED_EXTENSIONS,
  NANNY_VSC_ALLOWED_MIMES,
  NANNY_VSC_STATUSES,
  NANNY_WORK_HOUR_LIMIT_STATUS,
  NANNY_WORK_PERMIT_RESTRICTIONS,
  STUDY_PERMIT_CANADA_STATUS,
  WORK_PERMIT_CANADA_STATUSES,
} from './network-submit-nanny.constants';
import { isWorkPermitExpiryAtLeastSixMonths } from './network-submit-toronto-date.util';
import type { NetworkDocumentMeta, NormalizedNetworkApplication } from './network-submit.validation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface NannyV2WebsitePayload {
  metadata: Record<string, unknown>;
  role: 'Nanny';
  accuracyConfirmed: boolean;
  applicant: Record<string, unknown>;
  eligibility: Record<string, unknown>;
  experience: Record<string, unknown>;
  qualifications: Record<string, unknown>;
  compliance: Record<string, unknown>;
  languages: Record<string, unknown>;
  documents: unknown[];
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function reqString(obj: Record<string, unknown>, key: string, label: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${label} is required.`);
  }
  return value.trim();
}

function optNullableString(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key];
  if (value === null) return null;
  if (value === undefined) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${key} must be a string or null.`);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function reqBool(obj: Record<string, unknown>, key: string, label: string): boolean {
  const value = obj[key];
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${label} must be a boolean.`);
  }
  return value;
}

function reqNullableBool(obj: Record<string, unknown>, key: string, label: string): boolean | null {
  const value = obj[key];
  if (value === null) return null;
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${label} must be a boolean or null.`);
  }
  return value;
}

function reqNullableInt(obj: Record<string, unknown>, key: string, label: string): number | null {
  const value = obj[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new BadRequestException(`${label} must be an integer or null.`);
  }
  return value;
}

function assertDate(value: string | null | undefined, label: string): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (!DATE_RE.test(value)) {
    throw new BadRequestException(`${label} must be YYYY-MM-DD.`);
  }
  return value;
}

function assertPhone(phone: string): void {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new BadRequestException('Phone number must contain 10–15 digits.');
  }
}

function assertEnum(value: string, allowed: readonly string[], label: string): string {
  if (!allowed.includes(value)) {
    throw new BadRequestException(`${label} is invalid.`);
  }
  return value;
}

function assertStringArray(
  raw: unknown,
  label: string,
  allowed: readonly string[],
  minLength = 1,
): string[] {
  if (!Array.isArray(raw)) {
    throw new BadRequestException(`${label} must be an array.`);
  }
  if (raw.length < minLength) {
    throw new BadRequestException(`${label} must not be empty.`);
  }
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (typeof item !== 'string' || !item.trim()) {
      throw new BadRequestException(`${label}[${i}] must be a non-empty string.`);
    }
    const v = item.trim();
    if (!allowed.includes(v)) {
      throw new BadRequestException(`${label}[${i}] is invalid.`);
    }
    out.push(v);
  }
  return out;
}

function assertExclusiveNone(values: string[], exclusive: string, label: string): void {
  if (values.includes(exclusive) && values.length > 1) {
    throw new BadRequestException(`${label} cannot combine "${exclusive}" with other values.`);
  }
}

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

function resolveNannyDocumentContentType(
  contentType: string,
  originalFilename: string,
  category: DocumentCategoryValue,
): string {
  const normalized = contentType.trim().toLowerCase();
  const canonical = normalized === 'image/jpg' ? 'image/jpeg' : normalized;
  const ext = extensionOf(originalFilename);

  if (category === RESUME_DOCUMENT_CATEGORY) {
    if (canonical && canonical !== 'application/octet-stream' && NANNY_RESUME_ALLOWED_MIMES.has(canonical)) {
      return canonical;
    }
    if (NANNY_RESUME_ALLOWED_EXTENSIONS.has(ext)) {
      if (ext === '.pdf') return 'application/pdf';
      if (ext === '.doc') return 'application/msword';
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    throw new Error('disallowed');
  }

  if (category === 'vulnerable_sector_check') {
    if (canonical && canonical !== 'application/octet-stream' && NANNY_VSC_ALLOWED_MIMES.has(canonical)) {
      return canonical;
    }
    if (NANNY_VSC_ALLOWED_EXTENSIONS.has(ext)) {
      if (ext === '.pdf') return 'application/pdf';
      if (ext === '.png') return 'image/png';
      if (ext === '.heic') return 'image/heic';
      if (ext === '.heif') return 'image/heif';
      return 'image/jpeg';
    }
    throw new Error('disallowed');
  }

  throw new Error('disallowed category');
}

export function isNannyV2ApplicationRoot(root: Record<string, unknown>): boolean {
  if (root.role !== 'Nanny') return false;
  const eligibility = root.eligibility;
  if (!eligibility || typeof eligibility !== 'object' || Array.isArray(eligibility)) return false;
  return 'canCommuteGta' in eligibility;
}

export function parseNannyV2ApplicationJson(root: Record<string, unknown>): NormalizedNetworkApplication {
  const metadata = assertObject(root.metadata, 'metadata');
  const applicant = assertObject(root.applicant, 'applicant');
  const eligibility = assertObject(root.eligibility, 'eligibility');
  const experience = assertObject(root.experience, 'experience');
  const qualifications = assertObject(root.qualifications, 'qualifications');
  const compliance = assertObject(root.compliance, 'compliance');
  const languages = assertObject(root.languages, 'languages');

  const externalApplicationId = reqString(metadata, 'externalApplicationId', 'metadata.externalApplicationId');
  if (!UUID_RE.test(externalApplicationId)) {
    throw new BadRequestException('metadata.externalApplicationId must be a UUID.');
  }

  const consentAccepted = reqBool(metadata, 'consentAccepted', 'metadata.consentAccepted');
  if (!consentAccepted) {
    throw new BadRequestException('Consent must be accepted.');
  }
  const consentPolicyVersion = reqString(metadata, 'consentPolicyVersion', 'metadata.consentPolicyVersion');
  if (consentPolicyVersion !== NANNY_CONSENT_POLICY_VERSION) {
    throw new BadRequestException('metadata.consentPolicyVersion is invalid.');
  }

  const accuracyConfirmed = reqBool(root, 'accuracyConfirmed', 'accuracyConfirmed');
  if (!accuracyConfirmed) {
    throw new BadRequestException('accuracyConfirmed must be true.');
  }

  const firstName = reqString(applicant, 'firstName', 'applicant.firstName');
  const lastName = reqString(applicant, 'lastName', 'applicant.lastName');
  const email = reqString(applicant, 'email', 'applicant.email').toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new BadRequestException('Invalid applicant email.');
  }
  const phone = reqString(applicant, 'phone', 'applicant.phone');
  assertPhone(phone);
  const city = assertEnum(reqString(applicant, 'city', 'applicant.city'), NANNY_CITIES, 'applicant.city');
  const postalCode = reqString(applicant, 'postalCode', 'applicant.postalCode');
  const preferredName = optNullableString(applicant, 'preferredName');
  const genderRaw = applicant.gender;
  let gender = '';
  if (genderRaw !== null && genderRaw !== undefined) {
    if (typeof genderRaw !== 'string') {
      throw new BadRequestException('applicant.gender must be a string or null.');
    }
    gender = assertEnum(genderRaw.trim(), NANNY_GENDERS, 'applicant.gender');
  }

  const canCommuteGta = reqBool(eligibility, 'canCommuteGta', 'eligibility.canCommuteGta');
  if (!canCommuteGta) {
    throw new BadRequestException('Applicant must be able to commute within the GTA.');
  }

  const canadaStatus = assertEnum(
    reqString(eligibility, 'canadaStatus', 'eligibility.canadaStatus'),
    NANNY_CANADA_STATUSES,
    'eligibility.canadaStatus',
  );

  const legallyAuthorizedToWork = assertEnum(
    reqString(eligibility, 'legallyAuthorizedToWork', 'eligibility.legallyAuthorizedToWork'),
    NANNY_LEGAL_AUTHORIZATION,
    'eligibility.legallyAuthorizedToWork',
  );
  if (legallyAuthorizedToWork !== 'Yes') {
    throw new BadRequestException('Applicant must be legally authorized to work in Canada.');
  }

  const workPermitExpiryRaw = eligibility.workPermitExpiry;
  let workPermitExpiry: string | null = null;
  if (workPermitExpiryRaw !== null && workPermitExpiryRaw !== undefined) {
    if (typeof workPermitExpiryRaw !== 'string') {
      throw new BadRequestException('eligibility.workPermitExpiry must be YYYY-MM-DD or null.');
    }
    workPermitExpiry = assertDate(workPermitExpiryRaw.trim(), 'eligibility.workPermitExpiry') ?? null;
  }

  const workPermitChildcareRestrictions = eligibility.workPermitChildcareRestrictions;
  let childcareRestrictions: string | null = null;
  if (workPermitChildcareRestrictions !== null && workPermitChildcareRestrictions !== undefined) {
    if (typeof workPermitChildcareRestrictions !== 'string') {
      throw new BadRequestException('eligibility.workPermitChildcareRestrictions must be a string or null.');
    }
    childcareRestrictions = assertEnum(
      workPermitChildcareRestrictions.trim(),
      NANNY_WORK_PERMIT_RESTRICTIONS,
      'eligibility.workPermitChildcareRestrictions',
    );
  }

  const authorizedOffCampus = eligibility.authorizedOffCampus;
  let offCampus: string | null = null;
  if (authorizedOffCampus !== null && authorizedOffCampus !== undefined) {
    if (typeof authorizedOffCampus !== 'string') {
      throw new BadRequestException('eligibility.authorizedOffCampus must be a string or null.');
    }
    offCampus = assertEnum(
      authorizedOffCampus.trim(),
      NANNY_STUDY_OFF_CAMPUS,
      'eligibility.authorizedOffCampus',
    );
  }

  const workHourLimitStatus = eligibility.workHourLimitStatus;
  let hourLimitStatus: string | null = null;
  if (workHourLimitStatus !== null && workHourLimitStatus !== undefined) {
    if (typeof workHourLimitStatus !== 'string') {
      throw new BadRequestException('eligibility.workHourLimitStatus must be a string or null.');
    }
    hourLimitStatus = assertEnum(
      workHourLimitStatus.trim(),
      NANNY_WORK_HOUR_LIMIT_STATUS,
      'eligibility.workHourLimitStatus',
    );
  }

  const maxWeeklyWorkHours = reqNullableInt(
    eligibility,
    'maxWeeklyWorkHours',
    'eligibility.maxWeeklyWorkHours',
  );

  const isWorkPermit = WORK_PERMIT_CANADA_STATUSES.has(canadaStatus);
  const isStudyPermit = canadaStatus === STUDY_PERMIT_CANADA_STATUS;

  if (!isWorkPermit) {
    if (workPermitExpiry !== null) {
      throw new BadRequestException('eligibility.workPermitExpiry must be null for this status.');
    }
    if (childcareRestrictions !== null) {
      throw new BadRequestException(
        'eligibility.workPermitChildcareRestrictions must be null for this status.',
      );
    }
  } else {
    if (!workPermitExpiry) {
      throw new BadRequestException('eligibility.workPermitExpiry is required.');
    }
    const today = torontoTodayDateString();
    if (!isWorkPermitExpiryAtLeastSixMonths(workPermitExpiry, today)) {
      throw new BadRequestException('Work permit must be valid for at least six months.');
    }
    if (!childcareRestrictions) {
      throw new BadRequestException('eligibility.workPermitChildcareRestrictions is required.');
    }
    if (childcareRestrictions !== 'No') {
      throw new BadRequestException('Work permit must not restrict childcare employment.');
    }
  }

  if (!isStudyPermit) {
    if (offCampus !== null) {
      throw new BadRequestException('eligibility.authorizedOffCampus must be null for this status.');
    }
    if (hourLimitStatus !== null) {
      throw new BadRequestException('eligibility.workHourLimitStatus must be null for this status.');
    }
    if (maxWeeklyWorkHours !== null) {
      throw new BadRequestException('eligibility.maxWeeklyWorkHours must be null for this status.');
    }
  } else {
    if (!offCampus) {
      throw new BadRequestException('eligibility.authorizedOffCampus is required.');
    }
    if (offCampus !== 'Yes') {
      throw new BadRequestException('Study permit applicants must be authorized for off-campus work.');
    }
    if (!hourLimitStatus) {
      throw new BadRequestException('eligibility.workHourLimitStatus is required.');
    }
    if (hourLimitStatus === 'Yes') {
      if (maxWeeklyWorkHours === null) {
        throw new BadRequestException('eligibility.maxWeeklyWorkHours is required.');
      }
      if (maxWeeklyWorkHours < 1 || maxWeeklyWorkHours > 168) {
        throw new BadRequestException('eligibility.maxWeeklyWorkHours must be between 1 and 168.');
      }
    } else if (maxWeeklyWorkHours !== null) {
      throw new BadRequestException('eligibility.maxWeeklyWorkHours must be null unless hour limits apply.');
    }
  }

  const hasChildcareExperience = reqBool(
    experience,
    'hasChildcareExperience',
    'experience.hasChildcareExperience',
  );
  const experienceYears = assertEnum(
    reqString(experience, 'years', 'experience.years'),
    NANNY_EXPERIENCE_YEARS,
    'experience.years',
  );
  const experienceTypes = assertStringArray(experience.types, 'experience.types', NANNY_EXPERIENCE_TYPES);
  assertExclusiveNone(experienceTypes, NANNY_EXPERIENCE_TYPE_EXCLUSIVE, 'experience.types');
  const ageGroups = assertStringArray(experience.ageGroups, 'experience.ageGroups', NANNY_AGE_GROUPS);
  assertExclusiveNone(ageGroups, NANNY_AGE_GROUP_EXCLUSIVE, 'experience.ageGroups');
  const specialExperienceTypes = assertStringArray(
    experience.specialExperienceTypes,
    'experience.specialExperienceTypes',
    NANNY_SPECIAL_EXPERIENCE,
  );
  assertExclusiveNone(
    specialExperienceTypes,
    NANNY_SPECIAL_EXPERIENCE_EXCLUSIVE,
    'experience.specialExperienceTypes',
  );
  let specialExperienceDescription = optNullableString(experience, 'specialExperienceDescription');
  if (specialExperienceTypes.includes(NANNY_SPECIAL_EXPERIENCE_EXCLUSIVE)) {
    if (specialExperienceDescription !== null) {
      throw new BadRequestException('experience.specialExperienceDescription must be null.');
    }
  }

  const educationCertifications = assertStringArray(
    qualifications.educationCertifications,
    'qualifications.educationCertifications',
    NANNY_EDUCATION_CERTIFICATIONS,
  );
  assertExclusiveNone(educationCertifications, NANNY_EDUCATION_EXCLUSIVE, 'qualifications.educationCertifications');
  let educationProgramName = optNullableString(qualifications, 'educationProgramName');
  if (educationCertifications.includes(NANNY_EDUCATION_EXCLUSIVE)) {
    if (educationProgramName !== null) {
      throw new BadRequestException('qualifications.educationProgramName must be null.');
    }
  } else if (!educationProgramName) {
    throw new BadRequestException('qualifications.educationProgramName is required.');
  }

  const firstAidStatus = assertEnum(
    reqString(compliance, 'firstAidStatus', 'compliance.firstAidStatus'),
    NANNY_FIRST_AID_STATUSES,
    'compliance.firstAidStatus',
  );
  let firstAidExpiry: string | null = null;
  const firstAidExpiryRaw = compliance.firstAidExpiry;
  if (firstAidExpiryRaw !== null && firstAidExpiryRaw !== undefined) {
    if (typeof firstAidExpiryRaw !== 'string') {
      throw new BadRequestException('compliance.firstAidExpiry must be YYYY-MM-DD or null.');
    }
    firstAidExpiry = assertDate(firstAidExpiryRaw.trim(), 'compliance.firstAidExpiry') ?? null;
  }
  if (firstAidStatus === 'Yes') {
    if (!firstAidExpiry) {
      throw new BadRequestException('compliance.firstAidExpiry is required.');
    }
  } else if (firstAidExpiry !== null) {
    throw new BadRequestException('compliance.firstAidExpiry must be null.');
  }

  const vscStatus = assertEnum(
    reqString(compliance, 'vscStatus', 'compliance.vscStatus'),
    NANNY_VSC_STATUSES,
    'compliance.vscStatus',
  );
  let vscIssueDate: string | null = null;
  const vscIssueRaw = compliance.vscIssueDate;
  if (vscIssueRaw !== null && vscIssueRaw !== undefined) {
    if (typeof vscIssueRaw !== 'string') {
      throw new BadRequestException('compliance.vscIssueDate must be YYYY-MM-DD or null.');
    }
    vscIssueDate = assertDate(vscIssueRaw.trim(), 'compliance.vscIssueDate') ?? null;
  }
  if (vscStatus === 'Yes') {
    if (!vscIssueDate) {
      throw new BadRequestException('compliance.vscIssueDate is required.');
    }
  } else if (vscIssueDate !== null) {
    throw new BadRequestException('compliance.vscIssueDate must be null.');
  }

  const spokenEnglishRating = languages.spokenEnglishRating;
  if (typeof spokenEnglishRating !== 'number' || !Number.isInteger(spokenEnglishRating)) {
    throw new BadRequestException('languages.spokenEnglishRating must be an integer.');
  }
  if (spokenEnglishRating < 1 || spokenEnglishRating > 10) {
    throw new BadRequestException('languages.spokenEnglishRating must be between 1 and 10.');
  }

  const documentsRaw = root.documents;
  if (!Array.isArray(documentsRaw)) {
    throw new BadRequestException('documents must be an array.');
  }
  if (documentsRaw.length > NETWORK_SUBMIT_MAX_FILES) {
    throw new BadRequestException(`Too many documents (max ${NETWORK_SUBMIT_MAX_FILES}).`);
  }

  const documents: NetworkDocumentMeta[] = documentsRaw.map((item, index) => {
    const row = assertObject(item, `documents[${index}]`);
    const id = reqString(row, 'id', `documents[${index}].id`);
    if (!UUID_RE.test(id)) {
      throw new BadRequestException(`documents[${index}].id must be a UUID.`);
    }
    const categoryRaw = reqString(row, 'category', `documents[${index}].category`);
    if (!DOCUMENT_CATEGORY_VALUES.includes(categoryRaw as DocumentCategoryValue)) {
      throw new BadRequestException(`documents[${index}].category is invalid.`);
    }
    const category = categoryRaw as DocumentCategoryValue;
    if (category !== RESUME_DOCUMENT_CATEGORY && category !== 'vulnerable_sector_check') {
      throw new BadRequestException(`Document category "${category}" is not allowed for Nanny.`);
    }
    const originalFilename = reqString(row, 'originalFilename', `documents[${index}].originalFilename`);
    const contentTypeRaw = reqString(row, 'contentType', `documents[${index}].contentType`);
    const size = row.size;
    if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
      throw new BadRequestException(`documents[${index}].size must be a positive integer.`);
    }
    const maxBytes =
      category === RESUME_DOCUMENT_CATEGORY ? RESUME_MAX_FILE_BYTES : NETWORK_SUBMIT_MAX_FILE_BYTES;
    if (size > maxBytes) {
      throw new BadRequestException(`documents[${index}] exceeds max file size.`);
    }
    let contentType: string;
    try {
      contentType = resolveNannyDocumentContentType(contentTypeRaw, originalFilename, category);
    } catch {
      throw new BadRequestException(`documents[${index}] has a disallowed file type.`);
    }
    if (category === RESUME_DOCUMENT_CATEGORY) {
      const ext = extensionOf(originalFilename);
      if (!NANNY_RESUME_ALLOWED_EXTENSIONS.has(ext)) {
        throw new BadRequestException(`documents[${index}] has a disallowed file extension.`);
      }
    }
    return { id, category, originalFilename, contentType, size };
  });

  const vscDocs = documents.filter((d) => d.category === 'vulnerable_sector_check');
  if (vscStatus !== 'Yes' && vscDocs.length > 0) {
    throw new BadRequestException('Vulnerable sector check documents are not allowed for this VSC status.');
  }

  const totalBytes = documents.reduce((sum, d) => sum + d.size, 0);
  if (totalBytes > NETWORK_SUBMIT_MAX_TOTAL_BYTES) {
    throw new BadRequestException('Total upload size exceeds the allowed limit.');
  }

  const websitePayload: NannyV2WebsitePayload = {
    metadata: {
      formId: reqString(metadata, 'formId', 'metadata.formId'),
      externalApplicationId,
      submittedAt: optNullableString(metadata, 'submittedAt') ?? undefined,
      sourcePage: typeof metadata.sourcePage === 'string' ? metadata.sourcePage.trim() : '',
      sourceUrl:
        metadata.sourceUrl === undefined || metadata.sourceUrl === null
          ? ''
          : typeof metadata.sourceUrl === 'string'
            ? metadata.sourceUrl.trim()
            : '',
      consentAccepted,
      consentPolicyVersion,
    },
    role: 'Nanny',
    accuracyConfirmed,
    applicant: {
      firstName,
      lastName,
      preferredName,
      email,
      phone,
      city,
      postalCode,
      gender: gender || null,
    },
    eligibility: {
      canCommuteGta,
      canadaStatus,
      legallyAuthorizedToWork,
      workPermitExpiry,
      workPermitChildcareRestrictions: childcareRestrictions,
      authorizedOffCampus: offCampus,
      workHourLimitStatus: hourLimitStatus,
      maxWeeklyWorkHours,
    },
    experience: {
      hasChildcareExperience,
      years: experienceYears,
      types: experienceTypes,
      ageGroups,
      specialExperienceTypes,
      specialExperienceDescription,
    },
    qualifications: {
      educationCertifications,
      educationProgramName,
    },
    compliance: {
      firstAidStatus,
      firstAidExpiry,
      vscStatus,
      vscIssueDate,
    },
    languages: {
      spokenEnglishRating,
    },
    documents: documentsRaw,
  };

  const normalized: NormalizedNetworkApplication = {
    intakeVersion: 'nanny_v2',
    accuracyConfirmed,
    metadata: {
      formId: websitePayload.metadata.formId as string,
      externalApplicationId,
      submittedAt:
        typeof websitePayload.metadata.submittedAt === 'string'
          ? websitePayload.metadata.submittedAt
          : undefined,
      sourcePage: websitePayload.metadata.sourcePage as string,
      sourceUrl: websitePayload.metadata.sourceUrl as string,
      consentAccepted,
      consentPolicyVersion,
    },
    role: 'Nanny',
    applicant: {
      firstName,
      lastName,
      email,
      phone,
      gender,
      preferredName,
      city,
      postalCode,
    },
    eligibility: {
      gtaEligible: canCommuteGta,
      statusInCanada: canadaStatus,
    },
    experience: {
      duration: experienceYears,
      types: experienceTypes,
      description: specialExperienceDescription ?? undefined,
      ageGroups,
      hasChildcareExperience,
      specialExperienceTypes,
    },
    roleSpecific: {},
    compliance: {
      vulnerableSectorCheck: {
        hasDocument: vscDocs.length > 0,
        issueDate: vscIssueDate ?? undefined,
      },
      firstAidCpr: {
        hasDocument: false,
        expiryDate: firstAidExpiry ?? undefined,
      },
      immunizations: { hasRequiredImmunizations: false },
      covid19: { vaccinated: null, proofProvided: false },
      nannyFirstAidStatus: firstAidStatus,
      nannyVscStatus: vscStatus,
    },
    languages: {
      englishProficiency: String(spokenEnglishRating),
      speaksAdditionalLanguages: false,
      spokenEnglishRating,
    },
    qualifications: {
      educationCertifications,
      educationProgramName,
    },
    eligibilityExtended: {
      legallyAuthorizedToWork,
      workPermitExpiry,
      workPermitChildcareRestrictions: childcareRestrictions,
      authorizedOffCampus: offCampus,
      workHourLimitStatus: hourLimitStatus,
      maxWeeklyWorkHours,
    },
    websitePayload: websitePayload as unknown as Record<string, unknown>,
    documents,
  };
  return normalized;
}

export function assertNannyV2DocumentsPresent(payload: NormalizedNetworkApplication): void {
  const resumeDocuments = payload.documents.filter((d) => d.category === RESUME_DOCUMENT_CATEGORY);
  if (resumeDocuments.length === 0) {
    throw new BadRequestException('Exactly one resume document is required.');
  }
  if (resumeDocuments.length > 1) {
    throw new BadRequestException('Only one resume document is allowed.');
  }
}

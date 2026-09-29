import {
  HISTORICAL_EXTERNAL_ID_PREFIX,
  HISTORICAL_IMPORT_EXPORT_KIND,
  HISTORICAL_IMPORT_PAYLOAD_VERSION,
  HISTORICAL_IMPORT_SOURCE_SYSTEM,
  NANNY_CSV_COLUMNS,
} from './nanny-applicants-csv.constants';
import {
  classifyDocumentReference,
  extractFilenameFromUrl,
  normalizeDate,
  normalizeEmail,
  normalizeSpokenEnglish,
  normalizeYesNo,
  parseMultiSelect,
  trimToNull,
} from './nanny-applicants-csv.normalize';

export interface HistoricalNannyImportPayload {
  role: 'Nanny';
  intakeVersion: 'historical_import';
  import: {
    sourceSystem: typeof HISTORICAL_IMPORT_SOURCE_SYSTEM;
    exportKind: typeof HISTORICAL_IMPORT_EXPORT_KIND;
    payloadVersion: typeof HISTORICAL_IMPORT_PAYLOAD_VERSION;
    sourceRowId: string;
    sourceRaw: Record<string, string | null>;
    originalSubmissionTimestampAvailable: false;
    originalSubmissionTimestamp: null;
  };
  applicant: Record<string, string | null>;
  eligibility: Record<string, string | boolean | number | null>;
  experience: Record<string, string | boolean | string[] | null>;
  qualifications: Record<string, string | string[] | null>;
  compliance: Record<string, string | null>;
  languages: Record<string, number | null>;
  documents: {
    resume: { referenceKind: string; sourceUrl: string | null; suggestedFilename: string | null };
    vsc: { referenceKind: string; sourceUrl: string | null; suggestedFilename: string | null };
  };
}

export interface MappedHistoricalRow {
  sourceRowId: string;
  externalSubmissionId: string;
  rowNumber: number;
  payload: HistoricalNannyImportPayload;
  normalizationFlags: string[];
  blocked: boolean;
  blockReasons: string[];
}

export function deterministicExternalSubmissionId(sourceRowId: string): string {
  return `${HISTORICAL_EXTERNAL_ID_PREFIX}${sourceRowId.trim().toLowerCase()}`;
}

export function mapCsvRecord(
  record: Record<string, string>,
  rowNumber: number,
): MappedHistoricalRow {
  const c = NANNY_CSV_COLUMNS;
  const normalizationFlags: string[] = [];
  const blockReasons: string[] = [];

  const sourceRowId = trimToNull(record[c.id]);
  if (!sourceRowId) blockReasons.push('missing_source_id');

  const firstName = trimToNull(record[c.firstName]);
  const lastName = trimToNull(record[c.lastName]);
  const emailResult = normalizeEmail(trimToNull(record[c.email]));
  if (!firstName) blockReasons.push('missing_first_name');
  if (!lastName) blockReasons.push('missing_last_name');
  if (!emailResult.email) blockReasons.push(emailResult.malformed ? 'malformed_email' : 'missing_email');
  if (emailResult.malformed) normalizationFlags.push('malformed_email');

  const phone = trimToNull(record[c.phone]);
  if (phone) normalizationFlags.push('phone_preserved_as_string');

  const firstAidExpiry = normalizeDate(trimToNull(record[c.firstAidExpiry]));
  if (firstAidExpiry.invalid) normalizationFlags.push('invalid_first_aid_expiry');

  const vscIssueDate = normalizeDate(trimToNull(record[c.vscIssueDate]));
  if (vscIssueDate.invalid) normalizationFlags.push('invalid_vsc_issue_date');

  const workPermitExpiry = normalizeDate(trimToNull(record[c.workPermitExpiry]));
  if (workPermitExpiry.invalid) normalizationFlags.push('invalid_work_permit_expiry');

  const english = normalizeSpokenEnglish(trimToNull(record[c.spokenEnglishRating]));
  if (english.invalid) normalizationFlags.push('invalid_spoken_english');

  const maxHoursRaw = trimToNull(record[c.maxWeeklyHours]);
  let maxWeeklyHours: number | null = null;
  if (maxHoursRaw) {
    const n = Number.parseInt(maxHoursRaw, 10);
    if (Number.isInteger(n)) maxWeeklyHours = n;
    else normalizationFlags.push('invalid_max_weekly_hours');
  }

  const resumeRef = classifyDocumentReference(trimToNull(record[c.resumeUpload]));
  const vscRef = classifyDocumentReference(trimToNull(record[c.vscUpload]));
  const resumeUrl = resumeRef === 'https_url' ? trimToNull(record[c.resumeUpload]) : null;
  const vscUrl = vscRef === 'https_url' ? trimToNull(record[c.vscUpload]) : null;
  if (resumeRef === 'object_object' || resumeRef === 'other' || resumeRef === 'non_https_url') {
    normalizationFlags.push('resume_reference_non_standard');
  }
  if (vscRef === 'object_object' || vscRef === 'other' || vscRef === 'non_https_url') {
    normalizationFlags.push('vsc_reference_non_standard');
  }

  const sourceRaw: Record<string, string | null> = {};
  for (const [key, val] of Object.entries(record)) {
    sourceRaw[key] = trimToNull(val);
  }

  const payload: HistoricalNannyImportPayload = {
    role: 'Nanny',
    intakeVersion: 'historical_import',
    import: {
      sourceSystem: HISTORICAL_IMPORT_SOURCE_SYSTEM,
      exportKind: HISTORICAL_IMPORT_EXPORT_KIND,
      payloadVersion: HISTORICAL_IMPORT_PAYLOAD_VERSION,
      sourceRowId: sourceRowId ?? '',
      sourceRaw,
      originalSubmissionTimestampAvailable: false,
      originalSubmissionTimestamp: null,
    },
    applicant: {
      firstName,
      lastName,
      preferredName: trimToNull(record[c.preferredName]),
      email: emailResult.email,
      phone,
      city: trimToNull(record[c.city]),
      postalCode: trimToNull(record[c.postalCode]),
      gender: trimToNull(record[c.gender]),
    },
    eligibility: {
      gtaCommuteAnswer: trimToNull(record[c.gtaCommute]),
      canCommuteGta: normalizeYesNo(trimToNull(record[c.gtaCommute])),
      canadaStatus: trimToNull(record[c.canadaStatus]),
      legallyAuthorizedToWork: trimToNull(record[c.legallyAuthorized]),
      workPermitExpiry: workPermitExpiry.date,
      workPermitChildcareRestrictions: trimToNull(record[c.workPermitChildcareRestrictions]),
      authorizedOffCampus: trimToNull(record[c.authorizedOffCampus]),
      workHourLimitStatus: trimToNull(record[c.workHourLimits]),
      maxWeeklyWorkHours: maxWeeklyHours,
    },
    experience: {
      hasChildcareExperience: normalizeYesNo(trimToNull(record[c.hasChildcareExperience])),
      years: trimToNull(record[c.experienceYears]),
      types: parseMultiSelect(trimToNull(record[c.experienceTypes])),
      ageGroups: parseMultiSelect(trimToNull(record[c.ageGroups])),
      specialExperienceTypes: parseMultiSelect(trimToNull(record[c.specialExperienceTypes])),
      specialExperienceDescription: trimToNull(record[c.specialExperienceDescription]),
    },
    qualifications: {
      educationCertifications: parseMultiSelect(trimToNull(record[c.educationCertifications])),
      educationProgramName: trimToNull(record[c.educationProgramName]),
    },
    compliance: {
      firstAidStatus: trimToNull(record[c.firstAidStatus]),
      firstAidExpiry: firstAidExpiry.date,
      vscStatus: trimToNull(record[c.vscStatus]),
      vscIssueDate: vscIssueDate.date,
    },
    languages: {
      spokenEnglishRating: english.rating,
    },
    documents: {
      resume: {
        referenceKind: resumeRef,
        sourceUrl: resumeUrl,
        suggestedFilename: resumeUrl ? extractFilenameFromUrl(resumeUrl) : null,
      },
      vsc: {
        referenceKind: vscRef,
        sourceUrl: vscUrl,
        suggestedFilename: vscUrl ? extractFilenameFromUrl(vscUrl) : null,
      },
    },
  };

  return {
    sourceRowId: sourceRowId ?? '',
    externalSubmissionId: sourceRowId ? deterministicExternalSubmissionId(sourceRowId) : '',
    rowNumber,
    payload,
    normalizationFlags,
    blocked: blockReasons.length > 0,
    blockReasons,
  };
}

/** Column mapping metadata for documentation (no PII). */
export const CSV_TO_PLATFORM_COLUMN_MAP: Array<{
  csvColumn: string;
  platformDestination: string;
  normalization: string;
  nullable: boolean;
  historicalFallback: string;
}> = [
  { csvColumn: NANNY_CSV_COLUMNS.id, platformDestination: 'import.sourceRowId + applications.external_submission_id (prefixed)', normalization: 'UUID trim', nullable: false, historicalFallback: 'block row if missing' },
  { csvColumn: NANNY_CSV_COLUMNS.firstName, platformDestination: 'applications.first_name + payload.applicant.firstName', normalization: 'trim', nullable: false, historicalFallback: 'block' },
  { csvColumn: NANNY_CSV_COLUMNS.lastName, platformDestination: 'applications.last_name + payload.applicant.lastName', normalization: 'trim', nullable: false, historicalFallback: 'block' },
  { csvColumn: NANNY_CSV_COLUMNS.preferredName, platformDestination: 'applications.preferred_name + payload.applicant.preferredName', normalization: 'trim→null', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.email, platformDestination: 'applications.email + payload.applicant.email', normalization: 'lowercase, email regex', nullable: false, historicalFallback: 'block if missing/malformed' },
  { csvColumn: NANNY_CSV_COLUMNS.phone, platformDestination: 'applications.phone + payload.applicant.phone', normalization: 'preserve string', nullable: true, historicalFallback: 'empty string column default' },
  { csvColumn: NANNY_CSV_COLUMNS.city, platformDestination: 'applications.city + payload.applicant.city', normalization: 'trim, preserve label if non-enumerated', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.postalCode, platformDestination: 'applications.postal_code + payload.applicant.postalCode', normalization: 'trim, preserve spacing', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.gender, platformDestination: 'applications.gender + payload.applicant.gender', normalization: 'trim, preserve historical label', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.gtaCommute, platformDestination: 'applications.gta_eligible + payload.eligibility', normalization: 'Yes/No→boolean + preserve gtaCommuteAnswer', nullable: true, historicalFallback: 'null boolean' },
  { csvColumn: NANNY_CSV_COLUMNS.canadaStatus, platformDestination: 'applications.status_in_canada + payload.eligibility.canadaStatus', normalization: 'trim, preserve text', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.legallyAuthorized, platformDestination: 'payload.eligibility.legallyAuthorizedToWork', normalization: 'trim', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.workPermitExpiry, platformDestination: 'payload.eligibility.workPermitExpiry', normalization: 'YYYY-MM-DD', nullable: true, historicalFallback: 'null' },
  { csvColumn: NANNY_CSV_COLUMNS.workPermitChildcareRestrictions, platformDestination: 'payload.eligibility.workPermitChildcareRestrictions', normalization: 'trim', nullable: true, historicalFallback: 'null' },
  { csvColumn: NANNY_CSV_COLUMNS.authorizedOffCampus, platformDestination: 'payload.eligibility.authorizedOffCampus', normalization: 'trim', nullable: true, historicalFallback: 'null' },
  { csvColumn: NANNY_CSV_COLUMNS.workHourLimits, platformDestination: 'payload.eligibility.workHourLimitStatus', normalization: 'trim', nullable: true, historicalFallback: 'null' },
  { csvColumn: NANNY_CSV_COLUMNS.maxWeeklyHours, platformDestination: 'payload.eligibility.maxWeeklyWorkHours', normalization: 'integer parse', nullable: true, historicalFallback: 'null' },
  { csvColumn: NANNY_CSV_COLUMNS.hasChildcareExperience, platformDestination: 'payload.experience.hasChildcareExperience', normalization: 'Yes/No→boolean', nullable: true, historicalFallback: 'null' },
  { csvColumn: NANNY_CSV_COLUMNS.experienceYears, platformDestination: 'applications.experience_duration + payload.experience.years', normalization: 'trim', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.experienceTypes, platformDestination: 'applications.nanny_experience_types + payload.experience.types', normalization: 'comma-split', nullable: true, historicalFallback: '[]' },
  { csvColumn: NANNY_CSV_COLUMNS.ageGroups, platformDestination: 'payload.experience.ageGroups', normalization: 'comma-split', nullable: true, historicalFallback: '[]' },
  { csvColumn: NANNY_CSV_COLUMNS.specialExperienceTypes, platformDestination: 'payload.experience.specialExperienceTypes', normalization: 'comma-split', nullable: true, historicalFallback: '[]' },
  { csvColumn: NANNY_CSV_COLUMNS.specialExperienceDescription, platformDestination: 'applications.childcare_experience + payload.experience.specialExperienceDescription', normalization: 'trim', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.educationCertifications, platformDestination: 'payload.qualifications.educationCertifications', normalization: 'comma-split', nullable: true, historicalFallback: '[]' },
  { csvColumn: NANNY_CSV_COLUMNS.educationProgramName, platformDestination: 'payload.qualifications.educationProgramName', normalization: 'trim', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.firstAidStatus, platformDestination: 'applications.first_aid_cpr_status + payload.compliance.firstAidStatus', normalization: 'trim', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.firstAidExpiry, platformDestination: 'applications.first_aid_cpr_expiry + payload.compliance.firstAidExpiry', normalization: 'date', nullable: true, historicalFallback: 'null' },
  { csvColumn: NANNY_CSV_COLUMNS.vscStatus, platformDestination: 'applications.vsc_status + payload.compliance.vscStatus', normalization: 'trim', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.vscIssueDate, platformDestination: 'applications.vsc_issue_or_request_date + payload.compliance.vscIssueDate', normalization: 'date', nullable: true, historicalFallback: 'null' },
  { csvColumn: NANNY_CSV_COLUMNS.vscUpload, platformDestination: 'payload.documents.vsc (+ future application_documents)', normalization: 'URL classify only in dry-run', nullable: true, historicalFallback: 'no document row until fetch phase' },
  { csvColumn: NANNY_CSV_COLUMNS.spokenEnglishRating, platformDestination: 'applications.english_proficiency + payload.languages.spokenEnglishRating', normalization: '1–10 int', nullable: true, historicalFallback: '—' },
  { csvColumn: NANNY_CSV_COLUMNS.resumeUpload, platformDestination: 'payload.documents.resume (+ future application_documents)', normalization: 'URL classify only in dry-run', nullable: true, historicalFallback: 'no document row until fetch phase' },
  { csvColumn: NANNY_CSV_COLUMNS.source, platformDestination: 'payload.import.sourceRaw[Source] only', normalization: 'preserve; export shows [object Object]', nullable: true, historicalFallback: 'no submittedAt inferred' },
];

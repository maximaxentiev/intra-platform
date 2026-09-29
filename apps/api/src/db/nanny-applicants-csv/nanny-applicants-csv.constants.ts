/** Fillout grid-export column headers (exact match required for parse). */
export const NANNY_CSV_COLUMNS = {
  id: 'ID',
  firstName: 'First Name',
  lastName: 'Last Name',
  preferredName: 'Preferred Name',
  email: 'Email Address',
  phone: 'Phone Number',
  city: 'What city or city do you currently live in?',
  postalCode: 'Postal Code',
  gender: 'Gender',
  gtaCommute: 'Can you reliably commute to childcare jobs within the Greater Toronto Area?',
  canadaStatus: 'What is your current status in Canada?',
  legallyAuthorized: 'Are you currently legally authorized to work in Canada?',
  workPermitExpiry: 'When does your work permit expire?',
  workPermitChildcareRestrictions:
    'Does your work permit have any restrictions related to working in childcare?',
  authorizedOffCampus: 'Are you currently authorized to work off campus?',
  workHourLimits: 'Are there any limits on the number of hours you are currently allowed to work?',
  maxWeeklyHours: 'What is the maximum number of hours you are currently allowed to work each week?',
  hasChildcareExperience: 'Do you have previous experience caring for children?',
  experienceYears: 'How many years of childcare experience do you have?',
  experienceTypes: 'What types of childcare experience do you have?',
  ageGroups: 'Which age groups do you have experience caring for?',
  specialExperienceTypes: 'Do you have experience with any of the following?',
  specialExperienceDescription:
    'Please briefly tell us about any specialized childcare experience you selected.',
  educationCertifications: 'Do you have any childcare-related education or certifications?',
  educationProgramName:
    'Please provide the name of your program, certification, or qualification.',
  firstAidStatus: 'Do you currently have valid First Aid & CPR certification?',
  firstAidExpiry: 'When does your First Aid & CPR certification expire?',
  vscStatus: 'Do you currently have a Vulnerable Sector Check (VSC)?',
  vscIssueDate: 'When was your Vulnerable Sector Check issued?',
  vscUpload: 'Upload your Vulnerable Sector Check',
  spokenEnglishRating:
    'How would you rate your spoken English?1 = Very limited English · 10 = Excellent, fluent, and very comfortable speaking with children and families',
  resumeUpload: 'Please upload your current resume.',
  source: 'Source',
} as const;

export const NANNY_CSV_COLUMN_LIST = Object.values(NANNY_CSV_COLUMNS);

export const HISTORICAL_IMPORT_SOURCE_SYSTEM = 'fillout' as const;
export const HISTORICAL_IMPORT_EXPORT_KIND = 'grid-view-csv' as const;
export const HISTORICAL_IMPORT_PAYLOAD_VERSION = 'historical-nanny-import-v1' as const;

/** Prefix for applications.external_submission_id (deterministic, idempotent). */
export const HISTORICAL_EXTERNAL_ID_PREFIX = 'fillout-historical-nanny:';

export const WRITE_ENV_FLAG = 'NANNY_APPLICANT_IMPORT_WRITE';
export const WRITE_CLI_FLAG = '--write';
export const PREFLIGHT_DOCUMENTS_CLI_FLAG = '--preflight-documents';
export const VALIDATION_TEMP_DIR = 'private-imports/.validation-temp';

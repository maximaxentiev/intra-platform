export const NETWORK_SUBMIT_MAX_FILES = 10;
export const NETWORK_SUBMIT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const NETWORK_SUBMIT_MAX_TOTAL_BYTES = 40 * 1024 * 1024; // 40 MB total

/** Per client IP — generous enough for retries / household sharing. */
export const NETWORK_SUBMIT_RATE_LIMIT_IP_MAX = 20;
export const NETWORK_SUBMIT_RATE_LIMIT_IP_WINDOW_SEC = 60 * 60; // 1 hour

/** Per applicant email — prevents spam re-submissions. */
export const NETWORK_SUBMIT_RATE_LIMIT_EMAIL_MAX = 5;
export const NETWORK_SUBMIT_RATE_LIMIT_EMAIL_WINDOW_SEC = 60 * 60; // 1 hour

export const ALLOWED_SUBMIT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const ALLOWED_SUBMIT_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.doc',
  '.docx',
]);

export const DOCUMENT_CATEGORY_VALUES = [
  'training_proof',
  'qualification_certificate',
  'vulnerable_sector_check',
  'first_aid_cpr',
  'immunization_records',
  'covid19_vaccination',
] as const;

export type DocumentCategoryValue = (typeof DOCUMENT_CATEGORY_VALUES)[number];

export const PUBLIC_ROLE_VALUES = ['ECA', 'ECE/RECE', 'Nanny'] as const;
export type PublicRoleValue = (typeof PUBLIC_ROLE_VALUES)[number];

export function mapPublicRoleToDb(role: PublicRoleValue): 'eca' | 'ece_rece' | 'nanny' {
  switch (role) {
    case 'ECA':
      return 'eca';
    case 'ECE/RECE':
      return 'ece_rece';
    case 'Nanny':
      return 'nanny';
  }
}

export const DOC_FIELD_PREFIX = 'doc_';

/** Qualification statuses from the public Join the Network form (website). */
export const QUALIFICATION_STATUS_CANADIAN_CERTIFICATE = ['eca_canada', 'ece_canada'] as const;

export function qualificationStatusRequiresCertificate(status: string): boolean {
  return (QUALIFICATION_STATUS_CANADIAN_CERTIFICATE as readonly string[]).includes(status);
}

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
  'eca_diploma',
  'ece_diploma',
  'rece_proof',
  'resume',
  'vulnerable_sector_check',
  'first_aid_cpr',
  'immunization_records',
  'covid19_vaccination',
] as const;

const SUBMIT_EXTENSION_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

/** Normalize declared or inferred MIME for public application uploads. */
export function resolveSubmitContentType(contentType: string, originalFilename: string): string {
  const normalized = contentType.trim().toLowerCase();
  const canonical =
    normalized === 'image/jpg'
      ? 'image/jpeg'
      : normalized;
  if (canonical && canonical !== 'application/octet-stream' && ALLOWED_SUBMIT_MIME_TYPES.has(canonical)) {
    return canonical;
  }
  const ext = extensionOf(originalFilename);
  const inferred = SUBMIT_EXTENSION_TO_MIME[ext];
  if (!inferred || !ALLOWED_SUBMIT_EXTENSIONS.has(ext)) {
    throw new Error('disallowed content type');
  }
  return inferred;
}

export function isResolvableSubmitContentType(contentType: string, originalFilename: string): boolean {
  try {
    resolveSubmitContentType(contentType, originalFilename);
    return true;
  } catch {
    return false;
  }
}

export type DocumentCategoryValue = (typeof DOCUMENT_CATEGORY_VALUES)[number];

export const RESUME_DOCUMENT_CATEGORY = 'resume' as const satisfies DocumentCategoryValue;

/** Resume uploads are capped at 10 MB (same as generic per-file limit). */
export const RESUME_MAX_FILE_BYTES = NETWORK_SUBMIT_MAX_FILE_BYTES;

/** Structured qualification uploads aligned with staff document types (optional at intake). */
export const STRUCTURED_QUALIFICATION_CATEGORIES = [
  'eca_diploma',
  'ece_diploma',
  'rece_proof',
] as const satisfies readonly DocumentCategoryValue[];

export type StructuredQualificationCategory = (typeof STRUCTURED_QUALIFICATION_CATEGORIES)[number];

export const CHILDCARE_EXPERIENCE_MAX_LENGTH = 2000;

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

/** Whether a document category is allowed for the given public application role. */
export function isDocumentCategoryAllowedForRole(
  role: PublicRoleValue,
  category: DocumentCategoryValue,
): boolean {
  switch (category) {
    case 'eca_diploma':
      return role === 'ECA';
    case 'ece_diploma':
    case 'rece_proof':
      return role === 'ECE/RECE';
    case 'qualification_certificate':
      return role === 'ECA' || role === 'ECE/RECE';
    case 'training_proof':
      return role === 'Nanny';
    default:
      return true;
  }
}

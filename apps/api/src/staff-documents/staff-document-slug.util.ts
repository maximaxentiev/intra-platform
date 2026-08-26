import { getStaffLegalFullName, type StaffLegalNameInput } from '@intra/shared';
import { STAFF_DOCUMENT_SLUG_MAX_LENGTH } from './staff-document-share.constants';

const SLUG_FALLBACK = 'staff';

/** @deprecated Prefer getStaffLegalFullName for external surfaces. */
export function resolveStaffPublicDisplayName(staff: StaffLegalNameInput & {
  displayName?: string;
  useDisplayName?: boolean;
  legalName: string;
}): string {
  return getStaffLegalFullName(staff);
}

/**
 * Normalize a staff public name into an ASCII slug segment.
 * Authorization must never depend on this value.
 */
export function normalizeStaffDocumentSlug(sourceName: string): string {
  const withoutMarks = sourceName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  const slug = withoutMarks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const base = slug || SLUG_FALLBACK;
  return base.slice(0, STAFF_DOCUMENT_SLUG_MAX_LENGTH);
}

/**
 * Produce a slug candidate for uniqueness retry (base, base-2, base-3, …).
 * Collision handling with DB unique constraint belongs in Phase 3I-B issuance service.
 */
export function staffDocumentSlugCandidate(baseSlug: string, attempt: number): string {
  const normalizedBase = baseSlug || SLUG_FALLBACK;
  if (attempt <= 1) {
    return normalizedBase.slice(0, STAFF_DOCUMENT_SLUG_MAX_LENGTH);
  }
  const suffix = `-${attempt}`;
  const maxBaseLength = STAFF_DOCUMENT_SLUG_MAX_LENGTH - suffix.length;
  return `${normalizedBase.slice(0, maxBaseLength)}${suffix}`;
}

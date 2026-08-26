import { getStaffLegalFullName } from '@intra/shared';
import {
  normalizeStaffDocumentSlug,
  staffDocumentSlugCandidate,
} from './staff-document-slug.util';

export const STAFF_DOCUMENT_SLUG_COLLISION_MAX_ATTEMPTS = 50;

export function baseStaffDocumentSlugFromStaff(staff: {
  legalFirstName?: string | null;
  legalLastName?: string | null;
  legalName: string;
}): string {
  return normalizeStaffDocumentSlug(getStaffLegalFullName(staff));
}

export function staffDocumentSlugCandidates(baseSlug: string): string[] {
  return Array.from({ length: STAFF_DOCUMENT_SLUG_COLLISION_MAX_ATTEMPTS }, (_, index) =>
    staffDocumentSlugCandidate(baseSlug, index + 1),
  );
}

export function isStaffDocumentSlugUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) {
    return false;
  }
  if ((err as { code: string }).code !== '23505') {
    return false;
  }
  const constraint = (err as { constraint?: string }).constraint;
  return constraint === undefined || constraint === 'staff_document_slug_unique';
}

import type { staff } from '../../db/schema';
import {
  isStaffDocumentShareTokenActive,
  resolveStaffDocumentShareTokenState,
  type StaffDocumentShareTokenState,
} from '../staff-document-share-state.util';

export type StaffDocumentShareStatusDto = {
  state: StaffDocumentShareTokenState;
  slug: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  canCopy: boolean;
};

export type StaffDocumentShareUrlDto = {
  shareUrl: string;
};

export function mapStaffDocumentShareStatus(
  row: Pick<
    typeof staff.$inferSelect,
    | 'documentSlug'
    | 'documentShareTokenHash'
    | 'documentShareTokenCreatedAt'
    | 'documentShareTokenRevokedAt'
  >,
): StaffDocumentShareStatusDto {
  const shareFields = {
    documentShareTokenHash: row.documentShareTokenHash,
    documentShareTokenCreatedAt: row.documentShareTokenCreatedAt,
    documentShareTokenRevokedAt: row.documentShareTokenRevokedAt,
  };
  const state = resolveStaffDocumentShareTokenState(shareFields);
  const active = isStaffDocumentShareTokenActive(shareFields);

  return {
    state,
    slug: row.documentSlug ?? null,
    createdAt: row.documentShareTokenCreatedAt?.toISOString() ?? null,
    revokedAt: row.documentShareTokenRevokedAt?.toISOString() ?? null,
    canCopy: active && Boolean(row.documentSlug),
  };
}

import type { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { resolvePublicPlatformUrl } from '../config/platform-url';
import type { Database } from '../db/drizzle.module';
import { staff } from '../db/schema';
import type { StaffPortalAuditService } from '../staff-portal/staff-portal-audit.service';
import { assessStaffDocumentShareReadiness } from './staff-document-share-readiness.util';
import { StaffDocumentShareLifecycleService } from './staff-document-share-lifecycle.service';
import { StaffDocumentShareService } from './staff-document-share.service';
import { isStaffDocumentShareTokenActive } from './staff-document-share-state.util';
import { deriveStaffDocumentShareToken } from './staff-document-share-token.util';
import { buildStaffDocumentShareUrl } from './staff-document-share-url.util';

export async function buildActiveStaffDocumentShareUrlForEmail(
  db: Database,
  config: ConfigService,
  staffId: string,
): Promise<string | null> {
  const rows = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const fields = {
    documentShareTokenHash: row.documentShareTokenHash,
    documentShareTokenCreatedAt: row.documentShareTokenCreatedAt,
    documentShareTokenRevokedAt: row.documentShareTokenRevokedAt,
  };

  if (!isStaffDocumentShareTokenActive(fields) || !row.documentSlug) {
    return null;
  }

  const token = deriveStaffDocumentShareToken(
    config.getOrThrow<string>('DOCUMENT_SHARE_SIGNING_SECRET'),
    staffId,
    fields.documentShareTokenCreatedAt!,
  );

  const publicBaseUrl = resolvePublicPlatformUrl({
    APP_PUBLIC_URL: config.get<string>('APP_PUBLIC_URL'),
    APP_HOST: config.get<string>('APP_HOST'),
    LEGACY_APP_HOST: config.get<string>('LEGACY_APP_HOST'),
  });

  return buildStaffDocumentShareUrl(publicBaseUrl, row.documentSlug, token);
}

function createShareLifecycle(db: Database, config: ConfigService) {
  const shareService = new StaffDocumentShareService(config);
  const audit = { record: async () => undefined } as unknown as StaffPortalAuditService;
  return new StaffDocumentShareLifecycleService(db, shareService, audit, config);
}

/**
 * Resolve a Centre-facing document share URL that is valid at delivery time.
 * Reuses an active, document-backed share when possible; otherwise generates or rotates.
 */
export async function ensureFreshStaffDocumentShareUrlForCentreEmail(
  db: Database,
  config: ConfigService,
  staffId: string,
  actorUserId = 'system',
): Promise<string | null> {
  const shareLifecycle = createShareLifecycle(db, config);
  const readiness = await shareLifecycle.assessDocumentShareReadiness(staffId);
  if (!readiness.ready) {
    return null;
  }

  if (readiness.mode === 'existing') {
    const existing = await buildActiveStaffDocumentShareUrlForEmail(db, config, staffId);
    if (existing) {
      return existing;
    }

    try {
      const rotated = await shareLifecycle.rotateShareLink(staffId, actorUserId);
      return rotated.shareUrl;
    } catch {
      return null;
    }
  }

  try {
    const generated = await shareLifecycle.generateShareLink(staffId, actorUserId);
    return generated.shareUrl;
  } catch {
    return null;
  }
}

/** @deprecated Prefer ensureFreshStaffDocumentShareUrlForCentreEmail at delivery time. */
export async function isStaffDocumentShareUsableForCentreEmail(
  db: Database,
  staffId: string,
): Promise<boolean> {
  const rows = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
  const row = rows[0];
  if (!row) return false;

  const hasActiveShare =
    isStaffDocumentShareTokenActive({
      documentShareTokenHash: row.documentShareTokenHash,
      documentShareTokenCreatedAt: row.documentShareTokenCreatedAt,
      documentShareTokenRevokedAt: row.documentShareTokenRevokedAt,
    }) && Boolean(row.documentSlug);

  const readiness = await assessStaffDocumentShareReadiness(db, staffId, hasActiveShare);
  return readiness.ready;
}

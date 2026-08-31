import type { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { resolvePublicPlatformUrl } from '../config/platform-url';
import type { Database } from '../db/drizzle.module';
import { staff } from '../db/schema';
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

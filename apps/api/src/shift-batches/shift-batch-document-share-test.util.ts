import type { ConfigService } from '@nestjs/config';
import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { expect } from 'vitest';
import type * as schema from '../db/schema';
import {
  staff,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import type { StaffDocumentType } from '../staff-documents/staff-document.constants';
import {
  assessStaffDocumentShareReadiness,
} from '../staff-documents/staff-document-share-readiness.util';
import { isStaffDocumentShareTokenActive } from '../staff-documents/staff-document-share-state.util';
import { verifyStaffDocumentShareToken } from '../staff-documents/staff-document-share-token.util';

export const BATCH_DOCUMENT_SHARE_TEST_SECRET =
  'test-document-share-signing-secret-32chars-min';

export function createBatchDocumentShareTestConfig(): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'DOCUMENT_SHARE_SIGNING_SECRET') return BATCH_DOCUMENT_SHARE_TEST_SECRET;
      if (key === 'APP_PUBLIC_URL') return 'https://platform.intra.ca';
      if (key === 'APP_HOST') return 'platform.intra.ca';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    },
    getOrThrow: (key: string) => {
      const value = createBatchDocumentShareTestConfig().get(key);
      if (!value) throw new Error(`missing ${key}`);
      return value;
    },
  } as ConfigService;
}

export function parseDocumentShareUrl(url: string): { slug: string; token: string } {
  const match = url.match(/\/documents\/([^#]+)#(.+)$/);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid document share URL: ${url}`);
  }
  return { slug: decodeURIComponent(match[1]), token: match[2] };
}

/** Minimum approved public-share document category for Centre document links. */
export async function seedApprovedPublicShareDocument(
  db: NodePgDatabase<typeof schema>,
  staffId: string,
  documentType: StaffDocumentType = 'vulnerable_sector_check',
): Promise<{ setId: string; submissionId: string }> {
  const setRows = await db
    .insert(staffDocumentSets)
    .values({
      staffId,
      documentType,
      remindersEnabled: true,
    })
    .returning({ id: staffDocumentSets.id });
  const setId = setRows[0]!.id;

  const submissionRows = await db
    .insert(staffDocumentSubmissions)
    .values({
      documentSetId: setId,
      reviewStatus: 'approved',
      submittedAt: new Date('2026-01-01T10:00:00.000Z'),
      submittedByActorType: 'ops_user',
    })
    .returning({ id: staffDocumentSubmissions.id });
  const submissionId = submissionRows[0]!.id;

  await db.insert(staffDocumentFiles).values({
    submissionId,
    originalFilename: 'proof.pdf',
    contentType: 'application/pdf',
    byteSize: 100,
    storageKey: `test/${staffId}/${documentType}.pdf`,
  });

  await db
    .update(staffDocumentSets)
    .set({ currentSubmissionId: submissionId })
    .where(eq(staffDocumentSets.id, setId));

  return { setId, submissionId };
}

export async function clearStaffPublicShareDocuments(
  db: NodePgDatabase<typeof schema>,
  staffId: string,
): Promise<void> {
  const sets = await db
    .select({ id: staffDocumentSets.id, currentSubmissionId: staffDocumentSets.currentSubmissionId })
    .from(staffDocumentSets)
    .where(eq(staffDocumentSets.staffId, staffId));

  const setIds = sets.map((row) => row.id);
  const submissionIds = sets
    .map((row) => row.currentSubmissionId)
    .filter((id): id is string => Boolean(id));

  if (submissionIds.length) {
    await db
      .delete(staffDocumentFiles)
      .where(inArray(staffDocumentFiles.submissionId, submissionIds));
    await db
      .delete(staffDocumentSubmissions)
      .where(inArray(staffDocumentSubmissions.id, submissionIds));
  }
  if (setIds.length) {
    await db.delete(staffDocumentSets).where(inArray(staffDocumentSets.id, setIds));
  }
}

export async function resetStaffDocumentShareState(
  db: NodePgDatabase<typeof schema>,
  staffId: string,
): Promise<void> {
  await db
    .update(staff)
    .set({
      documentShareTokenHash: null,
      documentShareTokenCreatedAt: null,
      documentShareTokenRevokedAt: null,
    })
    .where(eq(staff.id, staffId));
}

export async function revokeStaffDocumentShare(
  db: NodePgDatabase<typeof schema>,
  staffId: string,
  revokedAt: Date = new Date(),
): Promise<void> {
  await db
    .update(staff)
    .set({ documentShareTokenRevokedAt: revokedAt })
    .where(eq(staff.id, staffId));
}

export async function assertDocumentShareUrlValid(
  db: NodePgDatabase<typeof schema>,
  config: ConfigService,
  staffId: string,
  url: string,
): Promise<void> {
  const { token } = parseDocumentShareUrl(url);
  const rows = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
  const row = rows[0];
  expect(row).toBeTruthy();

  const shareFields = {
    documentShareTokenHash: row!.documentShareTokenHash,
    documentShareTokenCreatedAt: row!.documentShareTokenCreatedAt,
    documentShareTokenRevokedAt: row!.documentShareTokenRevokedAt,
  };

  expect(isStaffDocumentShareTokenActive(shareFields)).toBe(true);
  expect(
    verifyStaffDocumentShareToken(
      config.getOrThrow<string>('DOCUMENT_SHARE_SIGNING_SECRET'),
      staffId,
      shareFields.documentShareTokenCreatedAt!,
      token,
      shareFields.documentShareTokenHash!,
    ),
  ).toBe(true);

  const readiness = await assessStaffDocumentShareReadiness(db, staffId, true);
  expect(readiness.ready).toBe(true);
}

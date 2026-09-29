import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../drizzle.module';
import { applicationDocuments, applications } from '../schema';
import type { StorageService } from '../../storage/storage.service';
import { buildApplicationDocumentKey } from '../../storage/storage-key.util';
import { sha256Hex } from '../../applications/network-submit.util';
import type { MappedHistoricalRow } from './nanny-applicants-csv.map';
import {
  fetchHistoricalDocument,
  type HistoricalDocumentFetcher,
} from './nanny-applicants-csv.document-fetch';
import { detectHistoricalDocument } from './nanny-applicants-csv.document-signature';
import { HISTORICAL_VSC_MIME } from './nanny-applicants-csv.document-types';

export type DocumentMigrationOutcome = 'skipped_existing' | 'created' | 'not_applicable' | 'failed';

export interface MigrateDocumentsResult {
  resume: DocumentMigrationOutcome;
  vsc: DocumentMigrationOutcome;
  resumeError: string | null;
  vscError: string | null;
}

async function existingCategories(db: Database, applicationId: string): Promise<Set<string>> {
  const rows = await db
    .select({ category: applicationDocuments.category })
    .from(applicationDocuments)
    .where(eq(applicationDocuments.applicationId, applicationId));
  return new Set(rows.map((r) => r.category));
}

function filenameFor(category: 'resume' | 'vsc', format: string, suggested: string | null): string {
  if (suggested && suggested.includes('.')) return suggested;
  const ext =
    format === 'pdf'
      ? 'pdf'
      : format === 'doc'
        ? 'doc'
        : format === 'docx'
          ? 'docx'
          : format === 'png'
            ? 'png'
            : format === 'heic'
              ? 'heic'
              : format === 'heif'
                ? 'heif'
                : 'jpg';
  return category === 'resume' ? `resume.${ext}` : `vsc.${ext}`;
}

type ApplicationDocumentDbCategory = 'resume' | 'vulnerable_sector_check';

export type HistoricalDocumentMigrationLogger = {
  warn: (message: string) => void;
};

const defaultMigrationLogger: HistoricalDocumentMigrationLogger = {
  warn: (message: string) => {
    // eslint-disable-next-line no-console
    console.warn(message);
  },
};

/** Best-effort delete of a key uploaded in this attempt only (no existing document rows). */
async function rollbackUploadedKey(
  storage: StorageService,
  storageKey: string,
  logger: HistoricalDocumentMigrationLogger,
): Promise<void> {
  try {
    await storage.deleteObject(storageKey);
  } catch {
    logger.warn('[historical-nanny-import] orphan object cleanup failed after document row insert error');
  }
}

async function storeDocument(
  db: Database,
  storage: StorageService,
  applicationId: string,
  category: ApplicationDocumentDbCategory,
  buffer: Buffer,
  originalFilename: string,
  contentType: string,
  logger: HistoricalDocumentMigrationLogger = defaultMigrationLogger,
): Promise<void> {
  const documentId = randomUUID();
  const storageKey = buildApplicationDocumentKey({
    applicationId,
    documentId,
    originalFilename,
  });
  await storage.uploadObject({ key: storageKey, body: buffer, contentType });
  try {
    await db.insert(applicationDocuments).values({
      id: documentId,
      applicationId,
      category,
      originalFilename,
      contentType,
      byteSize: buffer.length,
      storageKey,
      checksumSha256: sha256Hex(buffer),
    });
  } catch (insertErr) {
    await rollbackUploadedKey(storage, storageKey, logger);
    throw insertErr;
  }
}

/**
 * Idempotent per category: skips when application_documents row already exists.
 * Storage upload happens outside DB transaction — safe to rerun after partial failure.
 */
export async function migrateHistoricalDocumentsForApplication(
  db: Database,
  storage: StorageService,
  applicationId: string,
  row: MappedHistoricalRow,
  fetchImpl?: HistoricalDocumentFetcher,
  logger: HistoricalDocumentMigrationLogger = defaultMigrationLogger,
): Promise<MigrateDocumentsResult> {
  const existing = await existingCategories(db, applicationId);
  const result: MigrateDocumentsResult = {
    resume: 'not_applicable',
    vsc: 'not_applicable',
    resumeError: null,
    vscError: null,
  };

  const resumeUrl = row.payload.documents.resume.sourceUrl;
  if (row.payload.documents.resume.referenceKind === 'https_url' && resumeUrl) {
    if (existing.has('resume')) {
      result.resume = 'skipped_existing';
    } else {
      const fetched = await fetchHistoricalDocument(resumeUrl, 'resume', fetchImpl);
      if (!fetched.ok || !fetched.buffer) {
        result.resume = 'failed';
        result.resumeError = fetched.errorCode ?? 'http_error';
      } else {
        const detected = detectHistoricalDocument(fetched.buffer, fetched.contentTypeHeader, 'resume');
        if (detected.category !== 'resume') {
          result.resume = 'failed';
          result.resumeError = detected.category === 'html_error' ? 'html_error' : 'unsupported_type';
        } else {
          const name = filenameFor('resume', detected.format, row.payload.documents.resume.suggestedFilename);
          await storeDocument(
            db,
            storage,
            applicationId,
            'resume',
            fetched.buffer,
            name,
            detected.contentType,
            logger,
          );
          result.resume = 'created';
        }
      }
    }
  }

  const vscUrl = row.payload.documents.vsc.sourceUrl;
  if (row.payload.documents.vsc.referenceKind === 'https_url' && vscUrl) {
    if (existing.has('vulnerable_sector_check')) {
      result.vsc = 'skipped_existing';
    } else {
      const fetched = await fetchHistoricalDocument(vscUrl, 'vsc', fetchImpl);
      if (!fetched.ok || !fetched.buffer) {
        result.vsc = 'failed';
        result.vscError = fetched.errorCode ?? 'http_error';
      } else {
        const detected = detectHistoricalDocument(fetched.buffer, fetched.contentTypeHeader, 'vsc');
        if (detected.category !== 'vsc') {
          result.vsc = 'failed';
          result.vscError = detected.category === 'html_error' ? 'html_error' : 'unsupported_type';
        } else {
          const name = filenameFor('vsc', detected.format, row.payload.documents.vsc.suggestedFilename);
          const contentType = HISTORICAL_VSC_MIME[detected.format];
          await storeDocument(
            db,
            storage,
            applicationId,
            'vulnerable_sector_check',
            fetched.buffer,
            name,
            contentType,
            logger,
          );
          result.vsc = 'created';
        }
      }
    }
  }

  return result;
}

export async function findHistoricalImportApplicationId(
  db: Database,
  externalSubmissionId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.externalSubmissionId, externalSubmissionId))
    .limit(1);
  return rows[0]?.id ?? null;
}

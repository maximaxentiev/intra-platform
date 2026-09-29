import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../storage/storage.service';
import * as schema from '../schema';
import {
  auditNannyApplicantsCsv,
  dryRunImportReport,
} from './nanny-applicants-csv.audit';
import {
  PREFLIGHT_DOCUMENTS_CLI_FLAG,
  WRITE_CLI_FLAG,
  WRITE_ENV_FLAG,
} from './nanny-applicants-csv.constants';
import { runDocumentPreflight } from './nanny-applicants-csv.document-preflight';
import type { MappedHistoricalRow } from './nanny-applicants-csv.map';
import {
  findHistoricalImportApplicationId,
  migrateHistoricalDocumentsForApplication,
} from './nanny-applicants-csv.migrate-documents';
import { toHistoricalApplicationInsert } from './nanny-applicants-csv.insert';

export function parseNannyImportArgs(argv: string[]): {
  file: string;
  write: boolean;
  preflightDocuments: boolean;
} {
  let file = '';
  let write = false;
  let preflightDocuments = false;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === WRITE_CLI_FLAG) {
      write = true;
      continue;
    }
    if (arg === PREFLIGHT_DOCUMENTS_CLI_FLAG) {
      preflightDocuments = true;
      continue;
    }
    if (arg === '--file' && argv[i + 1]) {
      file = argv[++i]!;
      continue;
    }
    if (arg.startsWith('--file=')) {
      file = arg.slice('--file='.length);
    }
  }
  if (!file) throw new Error('--file is required.');
  return { file: resolve(file), write, preflightDocuments };
}

async function loadExistingExternalIds(databaseUrl: string): Promise<Set<string>> {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const db = drizzle(pool, { schema });
  const rows = await db
    .select({ externalSubmissionId: schema.applications.externalSubmissionId })
    .from(schema.applications)
    .where(like(schema.applications.externalSubmissionId, 'fillout-historical-nanny:%'));
  await pool.end();
  return new Set(rows.map((r) => r.externalSubmissionId));
}

export type NannyImportRunResult =
  | { mode: 'preflight'; report: Awaited<ReturnType<typeof runDocumentPreflight>>['report'] }
  | {
      mode: 'dry_run';
      audit: ReturnType<typeof auditNannyApplicantsCsv>;
      dryRun: ReturnType<typeof dryRunImportReport>;
    }
  | { mode: 'write' };

export async function runNannyApplicantCsvImport(
  argv: string[],
  env: NodeJS.ProcessEnv,
  options: { readFile?: (path: string) => string } = {},
): Promise<NannyImportRunResult> {
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, 'utf8'));
  const { file, write, preflightDocuments } = parseNannyImportArgs(argv);
  const csvText = readFile(file);
  const audit = auditNannyApplicantsCsv(csvText);

  const databaseUrl = env.DATABASE_URL ?? '';
  const existingIds =
    databaseUrl && !preflightDocuments
      ? await loadExistingExternalIds(databaseUrl).catch(() => new Set<string>())
      : new Set<string>();

  if (preflightDocuments) {
    const validationDir = join(resolve(file, '..'), '.validation-temp');
    const { report } = await runDocumentPreflight(audit.mapped, {
      saveValidationDir: validationDir,
    });
    return { mode: 'preflight', report };
  }

  const dryRun = dryRunImportReport(audit, existingIds);
  if (!write) {
    return { mode: 'dry_run', audit, dryRun };
  }

  const writeAllowed = env[WRITE_ENV_FLAG] === '1' && databaseUrl.trim().length > 0;
  if (!writeAllowed) {
    throw new Error(
      `Write mode blocked. Set ${WRITE_ENV_FLAG}=1 and DATABASE_URL, and pass ${WRITE_CLI_FLAG}.`,
    );
  }

  await runWriteMode(databaseUrl, audit.mapped);
  return { mode: 'write' };
}

async function runWriteMode(databaseUrl: string, rows: MappedHistoricalRow[]): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const db = drizzle(pool, { schema });
  const storage = new StorageService(new ConfigService(process.env as Record<string, string>));

  for (const row of rows) {
    if (row.blocked) continue;

    let applicationId = await findHistoricalImportApplicationId(db, row.externalSubmissionId);
    if (!applicationId) {
      const inserted = await db
        .insert(schema.applications)
        .values(toHistoricalApplicationInsert(row))
        .returning({ id: schema.applications.id });
      applicationId = inserted[0]!.id;
    }

    await migrateHistoricalDocumentsForApplication(db, storage, applicationId, row);
  }

  await pool.end();
}

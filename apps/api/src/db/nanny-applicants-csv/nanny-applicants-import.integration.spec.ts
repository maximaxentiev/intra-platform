import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { buildNannyApplicationOpsView } from '../../applications/application-nanny-view.util';
import { ApplicationsService } from '../../applications/applications.service';
import * as schema from '../schema';
import { applications } from '../schema';
import { mapCsvRecord } from './nanny-applicants-csv.map';
import { NANNY_CSV_COLUMNS } from './nanny-applicants-csv.constants';
import { rowToRecord } from './nanny-applicants-csv.parse';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

async function probePostgres(): Promise<boolean> {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2500, max: 1 });
  try {
    await pool.query('select 1');
    await pool.end();
    return true;
  } catch {
    await pool.end().catch(() => undefined);
    return false;
  }
}

const POSTGRES_READY = await probePostgres();

describe.skipIf(!POSTGRES_READY)('historical nanny CSV import persistence', () => {
  it('persists historical_import payload and exposes ops view', async () => {
    const headers = Object.values(NANNY_CSV_COLUMNS);
    const record = Object.fromEntries(headers.map((h) => [h, ''])) as Record<string, string>;
    record[NANNY_CSV_COLUMNS.id] = randomUUID();
    record[NANNY_CSV_COLUMNS.firstName] = 'Import';
    record[NANNY_CSV_COLUMNS.lastName] = 'Test';
    record[NANNY_CSV_COLUMNS.email] = `import-${randomUUID().slice(0, 8)}@example.test`;
    record[NANNY_CSV_COLUMNS.city] = 'Toronto';
    record[NANNY_CSV_COLUMNS.gtaCommute] = 'Yes';
    record[NANNY_CSV_COLUMNS.spokenEnglishRating] = '8';

    const mapped = mapCsvRecord(record, 2);
    expect(mapped.blocked).toBe(false);

    const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
    const db = drizzle(pool, { schema });
    const id = randomUUID();

    await db.insert(applications).values({
      id,
      status: 'new',
      role: 'nanny',
      firstName: mapped.payload.applicant.firstName!,
      lastName: mapped.payload.applicant.lastName!,
      email: mapped.payload.applicant.email!,
      externalSubmissionId: mapped.externalSubmissionId,
      payloadSnapshot: mapped.payload as unknown as Record<string, unknown>,
      consentAccepted: false,
      accuracyConfirmed: null,
      city: 'Toronto',
    });

    const row = await db.query.applications.findFirst({ where: eq(applications.id, id) });
    expect(buildNannyApplicationOpsView(row!)?.intakeVersion).toBe('historical_import');

    const service = new ApplicationsService(db, { isConfigured: () => false } as never);
    const detail = await service.get(id);
    expect(detail.nanny?.intakeVersion).toBe('historical_import');
    expect(detail.metadata.accuracyConfirmed).toBeNull();
    expect(detail.metadata.consentAccepted).toBe(false);

    await db.delete(applications).where(eq(applications.id, id));
    await pool.end();
  });
});

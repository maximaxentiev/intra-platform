import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { applications, applicationDocuments } from '../db/schema';
import { ApplicationsService } from './applications.service';

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

describe.skipIf(!POSTGRES_READY)('applications list advanced filters', () => {
  it('filters by resume document existence and search', async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
    const db = drizzle(pool, { schema });
    const service = new ApplicationsService(db, { getObjectStream: () => ({}) } as never);

    const appId = randomUUID();
    const ext = `fillout-test-${randomUUID()}`;
    await db.insert(applications).values({
      id: appId,
      role: 'nanny',
      status: 'new',
      firstName: 'Filter',
      lastName: 'ResumeTest',
      email: `filter-${randomUUID().slice(0, 8)}@example.test`,
      externalSubmissionId: ext,
      payloadSnapshot: { intakeVersion: 'nanny_v2', eligibility: { canCommuteGta: true } },
      consentAccepted: false,
      accuracyConfirmed: null,
    });
    await db.insert(applicationDocuments).values({
      id: randomUUID(),
      applicationId: appId,
      category: 'resume',
      originalFilename: 'r.pdf',
      contentType: 'application/pdf',
      byteSize: 10,
      storageKey: `applications/${appId}/doc/r.pdf`,
      checksumSha256: 'abc',
    });

    const withResume = await service.list({
      role: 'nanny',
      hasResume: 'yes',
      firstName: 'Filter',
      limit: 50,
    });
    expect(withResume.items.some((i) => i.id === appId)).toBe(true);

    const missing = await service.list({
      role: 'nanny',
      hasResume: 'no',
      firstName: 'Filter',
      limit: 50,
    });
    expect(missing.items.some((i) => i.id === appId)).toBe(false);

    await db.delete(applicationDocuments).where(eq(applicationDocuments.applicationId, appId));
    await db.delete(applications).where(eq(applications.id, appId));
    await pool.end();
  });
});

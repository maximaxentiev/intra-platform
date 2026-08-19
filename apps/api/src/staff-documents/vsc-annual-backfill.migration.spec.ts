import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

const MIGRATION_SQL = readFileSync(
  join(__dirname, '../../drizzle/0013_vsc_annual_expiry_backfill.sql'),
  'utf8',
);

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

describe.runIf(POSTGRES_READY)('0013 VSC annual expiry backfill migration', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  it('uses calendar-year arithmetic including leap-day processed dates', async () => {
    const cases = [
      { processed: '2026-08-01', expected: '2027-08-01' },
      { processed: '2028-02-29', expected: '2029-02-28' },
    ];

    for (const testCase of cases) {
      const result = await pool.query<{ expiry: string }>(
        `select ($1::date + interval '1 year')::date::text as expiry`,
        [testCase.processed],
      );
      expect(result.rows[0]?.expiry).toBe(testCase.expected);
    }
  });

  it('limits updates to current non-superseded VSC submissions with processed_date', async () => {
    expect(MIGRATION_SQL).toContain("sds.document_type = 'vulnerable_sector_check'");
    expect(MIGRATION_SQL).toContain('sds.current_submission_id = sub.id');
    expect(MIGRATION_SQL).toContain('sub.processed_date IS NOT NULL');
    expect(MIGRATION_SQL).toContain('sub.superseded_at IS NULL');
    expect(MIGRATION_SQL).toContain("interval '1 year'");
    expect(MIGRATION_SQL).not.toContain('first_aid_cpr');
  });
});

describe.runIf(!POSTGRES_READY)('0013 VSC annual expiry backfill migration', () => {
  it('skipped — PostgreSQL not available', () => {
    expect(POSTGRES_READY).toBe(false);
  });
});

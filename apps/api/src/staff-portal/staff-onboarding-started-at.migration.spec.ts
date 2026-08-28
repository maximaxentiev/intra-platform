import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import journal from '../../drizzle/meta/_journal.json';

const MIGRATION_SQL = readFileSync(
  join(__dirname, '../../drizzle/0020_staff_onboarding_started_at.sql'),
  'utf8',
);

describe('0020 staff onboarding_started_at migration metadata', () => {
  it('orders 0020 after 0019 by journal timestamp', () => {
    const entries = journal.entries.filter((entry) =>
      ['0019_ops_password_reset', '0020_staff_onboarding_started_at'].includes(entry.tag),
    );

    expect(entries.map((entry) => entry.tag)).toEqual([
      '0019_ops_password_reset',
      '0020_staff_onboarding_started_at',
    ]);

    const whenByTag = Object.fromEntries(entries.map((entry) => [entry.tag, entry.when]));
    expect(whenByTag['0019_ops_password_reset']).toBe(1788000000000);
    expect(whenByTag['0020_staff_onboarding_started_at']).toBe(1788100000000);
    expect(whenByTag['0020_staff_onboarding_started_at']).toBeGreaterThan(
      whenByTag['0019_ops_password_reset']!,
    );
  });

  it('is additive with nullable column and scoped backfill only', () => {
    expect(MIGRATION_SQL).toContain('ADD COLUMN "onboarding_started_at" timestamp with time zone');
    expect(MIGRATION_SQL).not.toMatch(/\bDROP\b|\bALTER COLUMN\b/);
    expect(MIGRATION_SQL).not.toMatch(/ADD COLUMN[^;]*NOT NULL/i);
    expect(MIGRATION_SQL).toContain('WHERE "onboarding_completed_at" IS NULL');
    expect(MIGRATION_SQL).toContain('"profile_completed_at" IS NOT NULL');
    expect(MIGRATION_SQL).toContain('"documents_completed_at" IS NOT NULL');
    expect(MIGRATION_SQL).toContain('"availability_completed_at" IS NOT NULL');
    expect(MIGRATION_SQL).toContain('"availability_onboarding_week1_start" IS NOT NULL');
  });

  it('does not backfill completed onboarding accounts', () => {
    expect(MIGRATION_SQL).toContain('UPDATE "staff_accounts"');
    expect(MIGRATION_SQL).toContain('WHERE "onboarding_completed_at" IS NULL');
  });
});

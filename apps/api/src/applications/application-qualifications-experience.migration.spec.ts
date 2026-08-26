import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import journal from '../../drizzle/meta/_journal.json';

const MIGRATION_SQL = readFileSync(
  join(__dirname, '../../drizzle/0018_application_qualifications_experience.sql'),
  'utf8',
);

describe('0018 application qualifications experience migration metadata', () => {
  it('orders 0018 after 0017 by journal timestamp', () => {
    const entries = journal.entries.filter((entry) =>
      ['0016_staff_password_reset_repair', '0017_staff_qualification_documents', '0018_application_qualifications_experience'].includes(
        entry.tag,
      ),
    );

    expect(entries.map((entry) => entry.tag)).toEqual([
      '0016_staff_password_reset_repair',
      '0017_staff_qualification_documents',
      '0018_application_qualifications_experience',
    ]);

    const whenByTag = Object.fromEntries(entries.map((entry) => [entry.tag, entry.when]));
    expect(whenByTag['0016_staff_password_reset_repair']).toBe(1787700000000);
    expect(whenByTag['0017_staff_qualification_documents']).toBe(1787800000000);
    expect(whenByTag['0018_application_qualifications_experience']).toBe(1787900000000);
    expect(whenByTag['0018_application_qualifications_experience']).toBeGreaterThan(
      whenByTag['0017_staff_qualification_documents']!,
    );
  });

  it('adds structured qualification enum values and childcare_experience additively', () => {
    expect(MIGRATION_SQL).toContain(`ADD VALUE IF NOT EXISTS 'eca_diploma'`);
    expect(MIGRATION_SQL).toContain(`ADD VALUE IF NOT EXISTS 'ece_diploma'`);
    expect(MIGRATION_SQL).toContain(`ADD VALUE IF NOT EXISTS 'rece_proof'`);
    expect(MIGRATION_SQL).toContain('ADD COLUMN IF NOT EXISTS "childcare_experience"');
    expect(MIGRATION_SQL).not.toMatch(/DROP COLUMN|ALTER COLUMN|UPDATE /i);
  });
});

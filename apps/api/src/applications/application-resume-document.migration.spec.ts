import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import journal from '../../drizzle/meta/_journal.json';

const MIGRATION_SQL = readFileSync(
  join(__dirname, '../../drizzle/0029_application_resume_document.sql'),
  'utf8',
);

describe('0029 application resume document migration metadata', () => {
  it('orders 0029 after 0028 by journal timestamp', () => {
    const entries = journal.entries.filter((entry) =>
      ['0028_centre_internal_ops_notes', '0029_application_resume_document'].includes(entry.tag),
    );

    expect(entries.map((entry) => entry.tag)).toEqual([
      '0028_centre_internal_ops_notes',
      '0029_application_resume_document',
    ]);

    const whenByTag = Object.fromEntries(entries.map((entry) => [entry.tag, entry.when]));
    expect(whenByTag['0029_application_resume_document']).toBeGreaterThan(
      whenByTag['0028_centre_internal_ops_notes']!,
    );
  });

  it('adds resume enum value additively', () => {
    expect(MIGRATION_SQL).toContain(`ADD VALUE IF NOT EXISTS 'resume'`);
    expect(MIGRATION_SQL).not.toMatch(/DROP COLUMN|ALTER COLUMN|UPDATE /i);
  });
});

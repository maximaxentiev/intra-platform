import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const drizzleRoot = join(import.meta.dirname, '../../drizzle');
const readMigration = (name: string) =>
  readFileSync(join(drizzleRoot, name), 'utf8');

describe('0024_shift_batch_centre_invariant migration', () => {
  const sql = readMigration('0024_shift_batch_centre_invariant.sql');

  it('adds composite unique on shift_batches (id, centre_id)', () => {
    expect(sql).toContain('shift_batches_id_centre_unique');
    expect(sql).toMatch(/UNIQUE\s*\(\s*id\s*,\s*centre_id\s*\)/i);
  });

  it('adds composite FK from shifts (batch_id, centre_id)', () => {
    expect(sql).toContain('shifts_batch_centre_fk');
    expect(sql).toMatch(/FOREIGN KEY\s*\(\s*batch_id\s*,\s*centre_id\s*\)/i);
    expect(sql).toMatch(/REFERENCES shift_batches\s*\(\s*id\s*,\s*centre_id\s*\)/i);
    expect(sql).toContain('ON DELETE RESTRICT');
  });

  it('does not drop the existing single-column batch_id FK from 0023', () => {
    expect(sql).not.toMatch(/DROP CONSTRAINT/i);
  });
});

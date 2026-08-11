import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { staff, staffAccounts } from '../db/schema';

describe('staff document share token schema foundation', () => {
  it('keeps cosmetic document_slug on staff', () => {
    expect(getTableColumns(staff).documentSlug).toBeDefined();
  });

  it('stores hashed share token metadata only — no raw token column', () => {
    const columns = getTableColumns(staff);
    expect(columns.documentShareTokenHash).toBeDefined();
    expect(columns.documentShareTokenCreatedAt).toBeDefined();
    expect(columns.documentShareTokenRevokedAt).toBeDefined();
    expect(Object.keys(columns).some((name) => /raw.*token/i.test(name))).toBe(false);
  });

  it('allows nullable share token fields for existing staff rows', () => {
    const columns = getTableColumns(staff);
    expect(columns.documentShareTokenHash.notNull).toBe(false);
    expect(columns.documentShareTokenCreatedAt.notNull).toBe(false);
    expect(columns.documentShareTokenRevokedAt.notNull).toBe(false);
  });
});

describe('staff_accounts documents_completed_at', () => {
  it('is nullable with no default', () => {
    const col = getTableColumns(staffAccounts).documentsCompletedAt;
    expect(col).toBeDefined();
    expect(col.notNull).toBe(false);
  });
});

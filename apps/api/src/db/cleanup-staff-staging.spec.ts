import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { PoolClient } from 'pg';
import {
  assertCleanupEnvironment,
  readStaffCleanupCounts,
  runStaffCleanup,
} from './cleanup-staff-staging';
import {
  assertStagingCleanupConfirmation,
  assertStagingDatabaseUrl,
  assertStagingMaintenanceEnvironment,
  parseDatabaseHost,
} from './staging-db-guard';
import { assertLocalDatabaseUrl } from './local-db-guard';

describe('staging-db-guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects localhost DATABASE_URL for staging maintenance', () => {
    expect(() =>
      assertStagingDatabaseUrl('postgres://intra:pw@127.0.0.1:5434/intra'),
    ).toThrow(/local/i);
  });

  it('rejects non-staging postgres hostnames', () => {
    expect(() =>
      assertStagingDatabaseUrl('postgres://intra:pw@db.example.com:5432/intra'),
    ).toThrow(/must be "postgres"/i);
  });

  it('accepts intra-ops-test docker postgres host', () => {
    expect(() =>
      assertStagingDatabaseUrl('postgres://intra:pw@postgres:5432/intra'),
    ).not.toThrow();
  });

  it('requires explicit confirmation token for execute', () => {
    delete process.env.STAGING_STAFF_CLEANUP_CONFIRM;
    expect(() => assertStagingCleanupConfirmation(true)).toThrow(/STAGING_STAFF_CLEANUP_CONFIRM/);
    process.env.STAGING_STAFF_CLEANUP_CONFIRM = 'YES';
    expect(() => assertStagingCleanupConfirmation(true)).not.toThrow();
  });

  it('requires staging APP_HOST and production NODE_ENV', () => {
    process.env.APP_HOST = 'platform.intra.ca';
    process.env.NODE_ENV = 'production';
    expect(() =>
      assertStagingMaintenanceEnvironment('postgres://intra:pw@postgres:5432/intra'),
    ).not.toThrow();

    process.env.APP_HOST = 'production.example.com';
    expect(() =>
      assertStagingMaintenanceEnvironment('postgres://intra:pw@postgres:5432/intra'),
    ).toThrow(/APP_HOST/);
  });

  it('parses postgres URL hostnames', () => {
    expect(parseDatabaseHost('postgres://u:p@postgres:5432/db')).toBe('postgres');
  });
});

describe('assertCleanupEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows local test mode only with explicit env flags', () => {
    process.env.LOCAL_STAFF_CLEANUP_TEST = 'YES';
    expect(() =>
      assertCleanupEnvironment({
        execute: false,
        allowLocalTestDb: true,
        databaseUrl: 'postgres://intra:pw@127.0.0.1:5434/intra',
      }),
    ).not.toThrow();
  });

  it('rejects local test mode without LOCAL_STAFF_CLEANUP_TEST', () => {
    delete process.env.LOCAL_STAFF_CLEANUP_TEST;
    expect(() =>
      assertCleanupEnvironment({
        execute: false,
        allowLocalTestDb: true,
        databaseUrl: 'postgres://intra:pw@127.0.0.1:5434/intra',
      }),
    ).toThrow(/LOCAL_STAFF_CLEANUP_TEST/);
  });

  it('rejects staging execute without confirmation', () => {
    process.env.APP_HOST = 'platform.intra.ca';
    process.env.NODE_ENV = 'production';
    delete process.env.STAGING_STAFF_CLEANUP_CONFIRM;
    expect(() =>
      assertCleanupEnvironment({
        execute: true,
        allowLocalTestDb: false,
        databaseUrl: 'postgres://intra:pw@postgres:5432/intra',
      }),
    ).toThrow(/STAGING_STAFF_CLEANUP_CONFIRM/);
  });
});

describe('assertLocalDatabaseUrl', () => {
  it('accepts localhost dev database URLs', () => {
    expect(() =>
      assertLocalDatabaseUrl('postgres://intra:pw@127.0.0.1:5434/intra'),
    ).not.toThrow();
  });

  it('rejects remote hosts for local-only scripts', () => {
    expect(() =>
      assertLocalDatabaseUrl('postgres://intra:pw@postgres:5432/intra'),
    ).toThrow(/not local/i);
  });
});

describe('runStaffCleanup', () => {
  it('runs detach/delete steps inside a transaction', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql.trim());
        if (sql.includes('SELECT')) {
          return {
            rows: [
              {
                staff: 0,
                staff_accounts: 0,
                staff_portal_audit_events: 0,
                availability: 0,
                staff_centre_top: 0,
                staff_centre_banned: 0,
                shift_contacted: 0,
                shifts_assigned: 0,
                applications_hired_staff: 0,
                staff_source_application_links: 0,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    await runStaffCleanup(client);

    expect(queries[0]).toBe('BEGIN');
    expect(queries.some((q) => q.includes('UPDATE applications SET hired_staff_id = NULL'))).toBe(true);
    expect(queries.some((q) => q.includes('UPDATE shifts SET assigned_staff_id = NULL'))).toBe(true);
    expect(queries.some((q) => q.includes('DELETE FROM staff'))).toBe(true);
    expect(queries.at(-1)).toBe('COMMIT');
  });

  it('rolls back when staff rows remain', async () => {
    let call = 0;
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.trim() === 'ROLLBACK') return { rows: [] };
        if (sql.includes('SELECT') && sql.includes('FROM staff)')) {
          call += 1;
          return {
            rows: [
              {
                staff: call === 1 ? 1 : 1,
                staff_accounts: 0,
                staff_portal_audit_events: 0,
                availability: 0,
                staff_centre_top: 0,
                staff_centre_banned: 0,
                shift_contacted: 0,
                shifts_assigned: 0,
                applications_hired_staff: 0,
                staff_source_application_links: 0,
              },
            ],
          };
        }
        return { rows: [] };
      }),
    } as unknown as PoolClient;

    await expect(runStaffCleanup(client)).rejects.toThrow(/Cleanup incomplete/i);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('readStaffCleanupCounts', () => {
  it('maps count query results', async () => {
    const client = {
      query: vi.fn(async () => ({
        rows: [
          {
            staff: 3,
            staff_accounts: 2,
            staff_portal_audit_events: 5,
            availability: 4,
            staff_centre_top: 1,
            staff_centre_banned: 0,
            shift_contacted: 2,
            shifts_assigned: 1,
            applications_hired_staff: 1,
            staff_source_application_links: 0,
          },
        ],
      })),
    } as unknown as PoolClient;

    const counts = await readStaffCleanupCounts(client);
    expect(counts.staff).toBe(3);
    expect(counts.staffAccounts).toBe(2);
    expect(counts.shiftContacted).toBe(2);
  });
});

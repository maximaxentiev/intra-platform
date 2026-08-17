import { BadRequestException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const TEST_TODAY = '2026-08-13';

vi.mock('../availability/availability-toronto.util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../availability/availability-toronto.util')>();
  const torontoTodayDateString = vi.fn(() => TEST_TODAY);
  return {
    ...actual,
    torontoTodayDateString,
    isDateBeforeTodayInToronto: vi.fn((calendarDate: string, today?: string) =>
      actual.compareDateStrings(calendarDate, today ?? torontoTodayDateString()) < 0,
    ),
  };
});

import * as schema from '../db/schema';
import { availability, staff, staffAccounts, staffAvailabilityUnavailableDays } from '../db/schema';
import type { StaffSessionPayload } from './staff-session.service';
import { StaffPortalAvailabilityService } from './staff-portal-availability.service';
import { StaffPortalOnboardingService } from './staff-portal-onboarding.service';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

const STAFF_A = '33333333-3333-4333-8333-333333333331';
const STAFF_B = '33333333-3333-4333-8333-333333333332';
const ACCOUNT_A = '44444444-4444-4444-8444-444444444441';
const ACCOUNT_B = '44444444-4444-4444-8444-444444444442';

const MONDAY = '2026-08-10';
const TODAY = TEST_TODAY;
const TODAY_DAY = 3;

const SESSION_A: StaffSessionPayload = {
  kind: 'staff',
  accountId: ACCOUNT_A,
  staffId: STAFF_A,
  email: 'concurrency-a@example.test',
};

const SESSION_B: StaffSessionPayload = {
  kind: 'staff',
  accountId: ACCOUNT_B,
  staffId: STAFF_B,
  email: 'concurrency-b@example.test',
};

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

describe.runIf(POSTGRES_READY)('StaffPortalAvailabilityService postgres concurrency', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: StaffPortalAvailabilityService;
  const audit = vi.fn();

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    db = drizzle(pool, { schema, casing: 'snake_case' });

    await pool.query(`
      ALTER TABLE staff_accounts
      ADD COLUMN IF NOT EXISTS availability_completed_at timestamp with time zone
    `);

    const onboarding = new StaffPortalOnboardingService(db, { record: audit } as never);
    service = new StaffPortalAvailabilityService(db, { record: audit } as never, onboarding);

    await db
      .insert(staff)
      .values([
        {
          id: STAFF_A,
          legalName: 'Concurrency A',
          legalFirstName: 'Concurrency',
          legalLastName: 'A',
          email: SESSION_A.email,
        },
        {
          id: STAFF_B,
          legalName: 'Concurrency B',
          legalFirstName: 'Concurrency',
          legalLastName: 'B',
          email: SESSION_B.email,
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(staffAccounts)
      .values([
        {
          id: ACCOUNT_A,
          staffId: STAFF_A,
          email: SESSION_A.email,
          status: 'active',
          profileCompletedAt: new Date('2026-08-01T12:00:00.000Z'),
          documentsCompletedAt: new Date('2026-08-02T12:00:00.000Z'),
          onboardingStep: 3,
        },
        {
          id: ACCOUNT_B,
          staffId: STAFF_B,
          email: SESSION_B.email,
          status: 'active',
          profileCompletedAt: new Date('2026-08-01T12:00:00.000Z'),
          documentsCompletedAt: new Date('2026-08-02T12:00:00.000Z'),
          onboardingStep: 3,
        },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await pool?.end();
  });

  afterEach(async () => {
    audit.mockClear();
    await db
      .delete(availability)
      .where(and(eq(availability.staffId, STAFF_A), eq(availability.weekStartDate, MONDAY)));
    await db
      .delete(availability)
      .where(and(eq(availability.staffId, STAFF_B), eq(availability.weekStartDate, MONDAY)));
    await db.delete(staffAvailabilityUnavailableDays).where(eq(staffAvailabilityUnavailableDays.staffId, STAFF_A));
    await db.delete(staffAvailabilityUnavailableDays).where(eq(staffAvailabilityUnavailableDays.staffId, STAFF_B));
    await db
      .update(staffAccounts)
      .set({ availabilityOnboardingWeek1Start: null })
      .where(eq(staffAccounts.id, ACCOUNT_A));
  });

  async function rowsFor(staffId: string, dayOfWeek: number) {
    return db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.staffId, staffId),
          eq(availability.weekStartDate, MONDAY),
          eq(availability.dayOfWeek, dayOfWeek),
        ),
      );
  }

  it('serializes concurrent overlapping first inserts to one success', async () => {
    const results = await Promise.allSettled([
      service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '13:00',
      }),
      service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '12:00',
        endTime: '17:00',
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status).toBe('rejected');
    if (rejected[0]?.status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(BadRequestException);
      expect(String(rejected[0].reason)).toMatch(/overlap/i);
    }

    const rows = await rowsFor(STAFF_A, TODAY_DAY);
    expect(rows).toHaveLength(1);
  });

  it('allows concurrent adjacent first inserts for the same staff/day', async () => {
    const results = await Promise.allSettled([
      service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '12:00',
      }),
      service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '12:00',
        endTime: '17:00',
      }),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const rows = await rowsFor(STAFF_A, TODAY_DAY);
    expect(rows).toHaveLength(2);
  });

  it('does not block overlapping inserts on different days for the same staff', async () => {
    const results = await Promise.allSettled([
      service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '13:00',
      }),
      service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY + 1,
        startTime: '09:00',
        endTime: '13:00',
      }),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await rowsFor(STAFF_A, TODAY_DAY)).toHaveLength(1);
    expect(await rowsFor(STAFF_A, TODAY_DAY + 1)).toHaveLength(1);
  });

  it('does not block overlapping inserts for different staff on the same day', async () => {
    const results = await Promise.allSettled([
      service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '13:00',
      }),
      service.create(SESSION_B, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '12:00',
        endTime: '17:00',
      }),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await rowsFor(STAFF_A, TODAY_DAY)).toHaveLength(1);
    expect(await rowsFor(STAFF_B, TODAY_DAY)).toHaveLength(1);
  });

  it('serializes concurrent create vs mark-unavailable to one consistent final state', async () => {    await service.ensureOnboardingState(SESSION_A);

    const results = await Promise.allSettled([
      service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '12:00',
      }),
      service.markUnavailable(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
      }),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const rows = await rowsFor(STAFF_A, TODAY_DAY);
    const unavailable = await db
      .select()
      .from(staffAvailabilityUnavailableDays)
      .where(eq(staffAvailabilityUnavailableDays.staffId, STAFF_A));

    const hasWindows = rows.length > 0;
    const hasMarker = unavailable.some((r) => r.calendarDate === '2026-08-13');
    expect(hasWindows && hasMarker).toBe(false);
    expect(hasWindows || hasMarker).toBe(true);
  });

  it('concurrent ensure requests produce one stable anchor', async () => {
    const results = await Promise.allSettled([
      service.ensureOnboardingState(SESSION_A),
      service.ensureOnboardingState(SESSION_A),
      service.ensureOnboardingState(SESSION_A),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const anchors = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof service.ensureOnboardingState>>> => r.status === 'fulfilled')
      .map((r) => r.value.week1Start);
    expect(new Set(anchors)).toEqual(new Set([MONDAY]));

    const account = (
      await db.select().from(staffAccounts).where(eq(staffAccounts.id, ACCOUNT_A))
    )[0];
    expect(account?.availabilityOnboardingWeek1Start).toBe(MONDAY);
  });

  it('concurrent mark-unavailable is idempotent', async () => {    await service.ensureOnboardingState(SESSION_A);

    const results = await Promise.allSettled([
      service.markUnavailable(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
      }),
      service.markUnavailable(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
      }),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const unavailable = await db
      .select()
      .from(staffAvailabilityUnavailableDays)
      .where(eq(staffAvailabilityUnavailableDays.staffId, STAFF_A));
    expect(unavailable.filter((r) => r.calendarDate === '2026-08-13')).toHaveLength(1);
    expect(await rowsFor(STAFF_A, TODAY_DAY)).toHaveLength(0);
  });
});

describe('StaffPortalAvailabilityService postgres concurrency probe', () => {
  it('reports whether postgres integration tests ran', () => {
    if (!POSTGRES_READY) {
      console.warn(
        `[skip] Postgres concurrency tests skipped — set DATABASE_URL or start docker-compose.dev postgres (${DATABASE_URL}).`,
      );
    }
    expect(true).toBe(true);
  });
});

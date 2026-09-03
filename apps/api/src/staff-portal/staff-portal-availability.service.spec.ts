import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

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

import { AvailabilityService } from '../availability/availability.service';
import { availability, staffAccounts, type Availability, type StaffAvailabilityUnavailableDay } from '../db/schema';
import { STAFF_PORTAL_AUDIT_EVENTS } from './staff-portal-audit.service';
import { StaffPortalAvailabilityService } from './staff-portal-availability.service';
import { StaffPortalOnboardingService } from './staff-portal-onboarding.service';
import type { StaffSessionPayload } from './staff-session.service';

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const SESSION_A: StaffSessionPayload = {
  kind: 'staff',
  accountId: ACCOUNT_A,
  staffId: STAFF_A,
  email: 'carer-a@example.test',
};

const MONDAY = '2026-08-10';
const TODAY = TEST_TODAY;
const TODAY_DAY = 3;

type AccountRow = typeof staffAccounts.$inferSelect;

const DB_COLUMN_TO_FIELD: Record<string, string> = {
  staff_id: 'staffId',
  week_start_date: 'weekStartDate',
  day_of_week: 'dayOfWeek',
  start_time: 'startTime',
  end_time: 'endTime',
  calendar_date: 'calendarDate',
  id: 'id',
};

type QueryFilters = {
  eq: Record<string, unknown>;
  inArray: Record<string, unknown[]>;
};

function extractEqFilters(condition: unknown): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  let pendingColumn: string | undefined;

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const chunk = node as { name?: string; value?: unknown; queryChunks?: unknown[] };
    if (chunk.name && chunk.name !== 'inArray') pendingColumn = chunk.name;
    if (pendingColumn && chunk.value !== undefined && typeof chunk.value !== 'object') {
      const field = DB_COLUMN_TO_FIELD[pendingColumn] ?? pendingColumn;
      filters[field] = chunk.value;
      pendingColumn = undefined;
    }
    if (chunk.queryChunks) {
      for (const child of chunk.queryChunks) walk(child);
    }
  };

  walk(condition);
  return filters;
}

function extractInArrayFilters(condition: unknown): Record<string, unknown[]> {
  const filters: Record<string, unknown[]> = {};
  let pendingColumn: string | undefined;
  let inArrayMode = false;

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const chunk = node as { name?: string; value?: unknown; queryChunks?: unknown[] };
    if (chunk.name === 'inArray') inArrayMode = true;
    if (chunk.name && chunk.name !== 'inArray') pendingColumn = chunk.name;
    if (inArrayMode && pendingColumn && Array.isArray(chunk.value)) {
      const field = DB_COLUMN_TO_FIELD[pendingColumn] ?? pendingColumn;
      filters[field] = chunk.value;
      pendingColumn = undefined;
      inArrayMode = false;
    }
    if (chunk.queryChunks) {
      for (const child of chunk.queryChunks) walk(child);
    }
  };

  walk(condition);
  return filters;
}

function extractFilters(condition: unknown): QueryFilters {
  return { eq: extractEqFilters(condition), inArray: extractInArrayFilters(condition) };
}

function matchesFilters(row: Record<string, unknown>, filters: QueryFilters): boolean {
  for (const [key, value] of Object.entries(filters.eq)) {
    if (row[key] !== value) return false;
  }
  for (const [key, values] of Object.entries(filters.inArray)) {
    if (!values.includes(row[key] as never)) return false;
  }
  return true;
}

function tableName(table: unknown): string | undefined {
  if (!table || typeof table !== 'object') return undefined;
  for (const sym of Object.getOwnPropertySymbols(table)) {
    if (sym.description === 'drizzle:BaseName') {
      return (table as Record<symbol, string>)[sym];
    }
  }
  return undefined;
}

function createHarness(initial?: Partial<AccountRow>) {
  const availabilityRows: Availability[] = [];
  const unavailableRows: StaffAvailabilityUnavailableDay[] = [];
  let account: AccountRow = {
    id: ACCOUNT_A,
    staffId: STAFF_A,
    email: 'carer-a@example.test',
    status: 'active',
    profileCompletedAt: new Date('2026-08-01T12:00:00.000Z'),
    documentsCompletedAt: new Date('2026-08-02T12:00:00.000Z'),
    onboardingStep: 3,
    onboardingCompletedAt: null,
    availabilityCompletedAt: null,
    availabilityOnboardingWeek1Start: null,
    inviteTokenHash: null,
    inviteTokenExpiresAt: null,
    inviteSentAt: null,
    passwordHash: 'hash',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...initial,
  };
  const audit = vi.fn();

  function buildSelect(table: unknown) {
    const name = tableName(table);
    return {
      where: (condition: unknown) => {
        const filters = extractFilters(condition);
        const rows =
          name === 'staff_accounts'
            ? account && matchesFilters(account, filters)
              ? [account]
              : []
            : name === 'staff_availability_unavailable_days'
              ? unavailableRows.filter((row) => matchesFilters(row, filters))
              : availabilityRows.filter((row) => matchesFilters(row, filters));
        const promise = Promise.resolve(rows);
        return {
          orderBy: () => promise,
          limit: () => promise,
          for: () => promise,
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            promise.then(resolve, reject),
        };
      },
    };
  }

  const db = {
    select: vi.fn().mockImplementation(() => ({
      from: (table: unknown) => buildSelect(table),
    })),
    execute: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    insert: vi.fn().mockImplementation((table: unknown) => ({
      values: (row: Record<string, unknown>) => ({
        onConflictDoUpdate: () => {
          const upsert = async () => {
            if (tableName(table) === 'staff_availability_unavailable_days') {
              const existingIdx = unavailableRows.findIndex(
                (r) =>
                  r.staffId === row.staffId && r.calendarDate === row.calendarDate,
              );
              const created: StaffAvailabilityUnavailableDay = {
                staffId: row.staffId as string,
                calendarDate: row.calendarDate as string,
                createdAt: new Date(),
              };
              if (existingIdx >= 0) unavailableRows[existingIdx] = created;
              else unavailableRows.push(created);
            }
          };
          return {
            returning: upsert,
            then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
              upsert().then(resolve, reject),
          };
        },
        returning: async () => {
          const created: Availability = {
            id: `av-${availabilityRows.length + 1}`,
            createdAt: new Date(),
            ...(row as Omit<Availability, 'id' | 'createdAt'>),
          };
          availabilityRows.push(created);
          return [created];
        },
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: (patch: Partial<AccountRow | Availability>) => ({
        where: (condition: unknown) => {
          const filters = extractFilters(condition);
          if (account && matchesFilters(account, filters)) {
            Object.assign(account, patch);
          }
          const updated: Availability[] = [];
          for (const row of availabilityRows) {
            if (matchesFilters(row, filters)) {
              Object.assign(row, patch);
              updated.push(row);
            }
          }
          return {
            returning: async () => (updated.length ? updated : account ? [account] : []),
          };
        },
      }),
    })),
    delete: vi.fn().mockImplementation((table: unknown) => ({
      where: (condition: unknown) => {
        const filters = extractFilters(condition);
        const name = tableName(table);
        const performDelete = () => {
          const removed: unknown[] = [];
          if (name === 'availability') {
            for (let i = availabilityRows.length - 1; i >= 0; i--) {
              if (matchesFilters(availabilityRows[i]!, filters)) {
                removed.push(availabilityRows.splice(i, 1)[0]!);
              }
            }
          } else if (name === 'staff_availability_unavailable_days') {
            for (let i = unavailableRows.length - 1; i >= 0; i--) {
              if (matchesFilters(unavailableRows[i]!, filters)) {
                removed.push(unavailableRows.splice(i, 1)[0]!);
              }
            }
          }
          return removed;
        };
        return {
          returning: async () => performDelete(),
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(performDelete()).then(resolve, reject),
        };
      },
    })),
    transaction: vi.fn().mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  };

  const onboardingReminders = {
    cancelPendingForAccount: vi.fn(),
    scheduleAndEnqueueForAccount: vi.fn(),
  };
  const onboarding = new StaffPortalOnboardingService(
    db as never,
    { record: audit } as never,
    onboardingReminders as never,
  );
  const service = new StaffPortalAvailabilityService(db as never, { record: audit } as never, onboarding);
  const opsService = new AvailabilityService(db as never);

  return { service, opsService, availabilityRows, account, audit, db };
}

describe('StaffPortalAvailabilityService', () => {
  it('lists only the authenticated staff week rows', async () => {
    const harness = createHarness();
    harness.availabilityRows.push(
      {
        id: '1',
        staffId: STAFF_A,
        weekStartDate: MONDAY,
        dayOfWeek: 0,
        startTime: '09:00:00',
        endTime: '12:00:00',
        createdAt: new Date(),
      },
      {
        id: '2',
        staffId: STAFF_B,
        weekStartDate: MONDAY,
        dayOfWeek: 1,
        startTime: '10:00:00',
        endTime: '14:00:00',
        createdAt: new Date(),
      },
    );

    const rows = await harness.service.list(SESSION_A, MONDAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('1');
  });

  it('excludes another week from list results', async () => {
    const harness = createHarness();
    harness.availabilityRows.push(
      {
        id: '1',
        staffId: STAFF_A,
        weekStartDate: MONDAY,
        dayOfWeek: 0,
        startTime: '09:00:00',
        endTime: '12:00:00',
        createdAt: new Date(),
      },
      {
        id: '2',
        staffId: STAFF_A,
        weekStartDate: '2026-08-17',
        dayOfWeek: 0,
        startTime: '09:00:00',
        endTime: '12:00:00',
        createdAt: new Date(),
      },
    );

    const rows = await harness.service.list(SESSION_A, MONDAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('1');
  });

  it('rejects non-Monday weekStart on list', async () => {
    const harness = createHarness();
    await expect(harness.service.list(SESSION_A, '2026-08-11')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates availability derived from session staffId', async () => {
    const harness = createHarness();
    const created = await harness.service.create(SESSION_A, {
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '09:00',
      endTime: '17:00',
    });

    expect(created.startTime).toBe('09:00');
    expect(harness.availabilityRows[0]?.staffId).toBe(STAFF_A);
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: STAFF_PORTAL_AUDIT_EVENTS.carerAvailabilityCreated }),
      expect.anything(),
    );
  });

  it('exposes carer-created rows through the existing Ops availability service', async () => {
    const harness = createHarness();
    await harness.service.create(SESSION_A, {
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '09:00',
      endTime: '12:00',
    });

    const opsRows = await harness.opsService.list(MONDAY, STAFF_A);
    expect(opsRows).toHaveLength(1);
    expect(opsRows[0]?.startTime).toBe('09:00:00');
  });

  it('rejects past-date create', async () => {
    const harness = createHarness();
    await expect(
      harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '12:00',
      }),
    ).rejects.toThrow(/past date/i);
  });

  it('allows create for today', async () => {
    const harness = createHarness();
    const created = await harness.service.create(SESSION_A, {
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '09:00',
      endTime: '12:00',
    });
    expect(created.dayOfWeek).toBe(TODAY_DAY);
  });

  it('rejects invalid day, time, and start/end ordering', async () => {
    const harness = createHarness();
    await expect(
      harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: 7 as never,
        startTime: '09:00',
        endTime: '12:00',
      }),
    ).rejects.toThrow();

    await expect(
      harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '9:00',
        endTime: '12:00',
      }),
    ).rejects.toThrow();

    await expect(
      harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '12:00',
        endTime: '12:00',
      }),
    ).rejects.toThrow();

    await expect(
      harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '17:00',
        endTime: '09:00',
      }),
    ).rejects.toThrow();
  });

  it('rejects overlapping and duplicate windows', async () => {
    const harness = createHarness();
    await harness.service.create(SESSION_A, {
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '09:00',
      endTime: '12:00',
    });

    await expect(
      harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '12:00',
      }),
    ).rejects.toThrow(/identical/i);

    await expect(
      harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '11:00',
        endTime: '13:00',
      }),
    ).rejects.toThrow(/overlap/i);
  });

  it('allows adjacent and multiple separate windows on the same day', async () => {
    const harness = createHarness();
    await harness.service.create(SESSION_A, {
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '09:00',
      endTime: '12:00',
    });
    await harness.service.create(SESSION_A, {
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '12:00',
      endTime: '14:00',
    });
    const third = await harness.service.create(SESSION_A, {
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '16:00',
      endTime: '18:00',
    });
    expect(third.startTime).toBe('16:00');
    expect(harness.availabilityRows).toHaveLength(3);
  });

  it('updates own record and validates overlap excluding self', async () => {
    const harness = createHarness();
    const created = await harness.service.create(SESSION_A, {
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '09:00',
      endTime: '12:00',
    });
    await harness.service.create(SESSION_A, {
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '14:00',
      endTime: '18:00',
    });

    const updated = await harness.service.update(SESSION_A, created.id, {
      startTime: '10:00',
      endTime: '11:00',
    });
    expect(updated.startTime).toBe('10:00');

    await expect(
      harness.service.update(SESSION_A, created.id, {
        startTime: '13:00',
        endTime: '15:00',
      }),
    ).rejects.toThrow(/overlap/i);
  });

  it('returns 404 for Staff B or missing record on patch/delete', async () => {
    const harness = createHarness();
    harness.availabilityRows.push({
      id: 'other',
      staffId: STAFF_B,
      weekStartDate: MONDAY,
      dayOfWeek: TODAY_DAY,
      startTime: '09:00:00',
      endTime: '12:00:00',
      createdAt: new Date(),
    });

    await expect(
      harness.service.update(SESSION_A, 'other', { startTime: '10:00', endTime: '11:00' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(harness.service.remove(SESSION_A, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects past-date update but allows past delete', async () => {
    const harness = createHarness();
    harness.availabilityRows.push({
      id: 'past',
      staffId: STAFF_A,
      weekStartDate: MONDAY,
      dayOfWeek: 0,
      startTime: '09:00:00',
      endTime: '12:00:00',
      createdAt: new Date(),
    });

    await expect(
      harness.service.update(SESSION_A, 'past', { startTime: '10:00', endTime: '11:00' }),
    ).rejects.toThrow(/past date/i);

    await expect(harness.service.remove(SESSION_A, 'past')).resolves.toEqual({ ok: true });
    expect(harness.availabilityRows).toHaveLength(0);
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: STAFF_PORTAL_AUDIT_EVENTS.carerAvailabilityDeleted }),
      expect.anything(),
    );
  });

  it('rejects step 3 without onboarding anchor for incomplete accounts', async () => {
    const harness = createHarness();
    await expect(harness.service.completeStep3(SESSION_A)).rejects.toThrow(/onboarding period/i);
  });

  it('complete step 3 sets availabilityCompletedAt without finalizing onboarding', async () => {
    const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
    const result = await harness.service.completeStep3(SESSION_A);
    expect(result.availabilityComplete).toBe(true);
    expect(result.availabilityCompletedAt).not.toBeNull();
    expect(result.onboardingComplete).toBe(false);
    expect(harness.account.onboardingCompletedAt).toBeNull();
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: STAFF_PORTAL_AUDIT_EVENTS.onboardingAvailabilityStepCompleted,
      }),
      expect.anything(),
    );
  });

  it('complete step 3 succeeds with blank weeks and zero availability rows', async () => {
    const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
    const result = await harness.service.completeOnboardingStep(SESSION_A);
    expect(result.availabilityComplete).toBe(true);
    expect(harness.account.onboardingCompletedAt).toBeNull();
  });

  it('complete step 3 preserves earlier completion timestamps', async () => {
    const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
    const profileAt = harness.account.profileCompletedAt!;
    const documentsAt = harness.account.documentsCompletedAt!;
    const result = await harness.service.completeStep3(SESSION_A);
    expect(result.profileCompletedAt).toBe(profileAt.toISOString());
    expect(result.documentsCompletedAt).toBe(documentsAt.toISOString());
  });

  it('complete step 3 is idempotent for already completed accounts', async () => {
    const harness = createHarness();
    harness.account.onboardingCompletedAt = new Date('2026-08-20T12:00:00.000Z');
    const first = await harness.service.completeStep3(SESSION_A);
    const completedAt = harness.account.onboardingCompletedAt;
    harness.audit.mockClear();

    const second = await harness.service.completeStep3(SESSION_A);
    expect(second.onboardingCompletedAt).toBe(first.onboardingCompletedAt);
    expect(harness.account.onboardingCompletedAt).toBe(completedAt);
    expect(harness.audit).not.toHaveBeenCalled();
  });

  it('blocks step 3 when profile or documents incomplete', async () => {
    const harness = createHarness();
    harness.account.profileCompletedAt = null;
    await expect(harness.service.completeStep3(SESSION_A)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    harness.account.profileCompletedAt = new Date();
    harness.account.documentsCompletedAt = null;
    await expect(harness.service.completeStep3(SESSION_A)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects disabled accounts', async () => {
    const harness = createHarness();
    harness.account.status = 'disabled';
    await expect(
      harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '12:00',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('listUpcoming', () => {
    it('returns empty items when no upcoming availability exists', async () => {
      const harness = createHarness();
      harness.db.execute.mockResolvedValueOnce({ rows: [{ total_dates: 0 }] });

      const result = await harness.service.listUpcoming(SESSION_A, 1, 10);
      expect(result).toEqual({
        items: [],
        page: 1,
        pageSize: 10,
        totalDates: 0,
        totalPages: 0,
      });
      expect(harness.db.execute).toHaveBeenCalledTimes(1);
    });

    it('includes today and future dates grouped with windows sorted by start time', async () => {
      const harness = createHarness();
      harness.db.execute
        .mockResolvedValueOnce({ rows: [{ total_dates: 2 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'late',
              calendar_date: '2026-08-13',
              start_time: '14:00:00',
              end_time: '17:00:00',
            },
            {
              id: 'early',
              calendar_date: '2026-08-13',
              start_time: '09:00:00',
              end_time: '12:00:00',
            },
            {
              id: 'future',
              calendar_date: '2026-08-20',
              start_time: '08:00:00',
              end_time: '16:00:00',
            },
          ],
        });

      const result = await harness.service.listUpcoming(SESSION_A, 1, 10);
      expect(result.totalDates).toBe(2);
      expect(result.totalPages).toBe(1);
      expect(result.items).toEqual([
        {
          calendarDate: '2026-08-13',
          windows: [
            { id: 'early', startTime: '09:00', endTime: '12:00' },
            { id: 'late', startTime: '14:00', endTime: '17:00' },
          ],
        },
        {
          calendarDate: '2026-08-20',
          windows: [{ id: 'future', startTime: '08:00', endTime: '16:00' }],
        },
      ]);
    });

    it('paginates distinct calendar dates', async () => {
      const harness = createHarness();
      harness.db.execute
        .mockResolvedValueOnce({ rows: [{ total_dates: 37 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'w1',
              calendar_date: '2026-12-28',
              start_time: '09:00:00',
              end_time: '12:00:00',
            },
          ],
        });

      const result = await harness.service.listUpcoming(SESSION_A, 4, 10);
      expect(result.page).toBe(4);
      expect(result.pageSize).toBe(10);
      expect(result.totalDates).toBe(37);
      expect(result.totalPages).toBe(4);
      expect(result.items).toHaveLength(1);
      expect(harness.db.execute).toHaveBeenCalledTimes(2);
    });

    it('returns empty items when page exceeds total pages', async () => {
      const harness = createHarness();
      harness.db.execute.mockResolvedValueOnce({ rows: [{ total_dates: 5 }] });

      const result = await harness.service.listUpcoming(SESSION_A, 3, 10);
      expect(result.items).toEqual([]);
      expect(result.totalDates).toBe(5);
      expect(result.totalPages).toBe(1);
      expect(harness.db.execute).toHaveBeenCalledTimes(1);
    });

    it('supports page sizes 25 and 50', async () => {
      const harness = createHarness();
      harness.db.execute.mockResolvedValueOnce({ rows: [{ total_dates: 0 }] });
      await harness.service.listUpcoming(SESSION_A, 1, 25);
      harness.db.execute.mockResolvedValueOnce({ rows: [{ total_dates: 0 }] });
      await harness.service.listUpcoming(SESSION_A, 1, 50);
      expect(harness.db.execute).toHaveBeenCalledTimes(2);
    });

    it('rejects disabled accounts', async () => {
      const harness = createHarness();
      harness.account.status = 'disabled';
      await expect(harness.service.listUpcoming(SESSION_A, 1, 10)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});

describe('StaffPortalAvailabilityController auth wiring', () => {
  it('uses Public, CarerPortalEnabledGuard, and StaffSessionGuard', async () => {
    const { StaffPortalAvailabilityController } = await import(
      './staff-portal-availability.controller'
    );
    const guards = Reflect.getMetadata('__guards__', StaffPortalAvailabilityController);
    expect(guards?.map((g: { name: string }) => g.name)).toEqual([
      'CarerPortalEnabledGuard',
      'StaffSessionGuard',
    ]);
    expect(Reflect.getMetadata('isPublic', StaffPortalAvailabilityController)).toBe(true);
  });

  it('registers upcoming route before id routes', async () => {
    const { StaffPortalAvailabilityController } = await import(
      './staff-portal-availability.controller'
    );
    const upcoming = Reflect.getMetadata('path', StaffPortalAvailabilityController.prototype.listUpcoming);
    expect(upcoming).toBe('upcoming');
  });
});

describe('Staff portal availability session isolation', () => {
  it('StaffSessionGuard does not accept ops session cookie name', async () => {
    const { StaffSessionGuard } = await import('./staff-session.guard');
    const { StaffSessionService } = await import('./staff-session.service');
    const sessions = {
      cookieName: 'intra_session_staff',
      get: vi.fn().mockResolvedValue(null),
    } as unknown as StaffSessionService;
    const guard = new StaffSessionGuard(sessions);
    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ cookies: { intra_session: 'ops-only' } }),
        }),
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

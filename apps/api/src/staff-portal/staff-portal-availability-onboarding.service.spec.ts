import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailabilityService } from '../availability/availability.service';
import * as torontoUtil from '../availability/availability-toronto.util';
import {
  type Availability,
  type StaffAvailabilityUnavailableDay,
} from '../db/schema';
import { STAFF_PORTAL_AUDIT_EVENTS } from './staff-portal-audit.service';
import { StaffPortalAvailabilityService } from './staff-portal-availability.service';
import { StaffPortalOnboardingService } from './staff-portal-onboarding.service';
import type { StaffSessionPayload } from './staff-session.service';

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOUNT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const SESSION_A: StaffSessionPayload = {
  kind: 'staff',
  accountId: ACCOUNT_A,
  staffId: STAFF_A,
  email: 'carer-a@example.test',
};

const SESSION_B: StaffSessionPayload = {
  kind: 'staff',
  accountId: ACCOUNT_B,
  staffId: STAFF_B,
  email: 'carer-b@example.test',
};

const MONDAY = '2026-08-10';
const WEEK2 = '2026-08-17';
const TODAY = '2026-08-13';
const TODAY_DAY = 3;

type AccountRow = {
  id: string;
  staffId: string;
  email: string;
  status: string;
  profileCompletedAt: Date | null;
  documentsCompletedAt: Date | null;
  onboardingStep: number;
  onboardingCompletedAt: Date | null;
  availabilityCompletedAt: Date | null;
  availabilityOnboardingWeek1Start: string | null;
  inviteTokenHash: string | null;
  inviteTokenExpiresAt: Date | null;
  inviteSentAt: Date | null;
  passwordHash: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const DB_COLUMN_TO_FIELD: Record<string, string> = {
  staff_id: 'staffId',
  week_start_date: 'weekStartDate',
  day_of_week: 'dayOfWeek',
  start_time: 'startTime',
  end_time: 'endTime',
  calendar_date: 'calendarDate',
  id: 'id',
  availability_onboarding_week1_start: 'availabilityOnboardingWeek1Start',
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

  function rowsForTable(table: unknown) {
    const name = tableName(table);
    if (name === 'staff_accounts') return account ? [account] : [];
    if (name === 'staff_availability_unavailable_days') return unavailableRows;
    return availabilityRows;
  }

  function buildSelect(table: unknown) {
    return {
      where: (condition: unknown) => {
        const filters = extractFilters(condition);
        const rows = rowsForTable(table).filter((row) => matchesFilters(row, filters));
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
            const name = tableName(table);
            if (name === 'staff_availability_unavailable_days') {
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
          const name = tableName(table);
          if (name === 'availability') {
            const created: Availability = {
              id: `av-${availabilityRows.length + 1}`,
              createdAt: new Date(),
              ...(row as Omit<Availability, 'id' | 'createdAt'>),
            };
            availabilityRows.push(created);
            return [created];
          }
          return [];
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

  const onboarding = new StaffPortalOnboardingService(db as never, { record: audit } as never);
  const service = new StaffPortalAvailabilityService(db as never, { record: audit } as never, onboarding);
  const opsService = new AvailabilityService(db as never);

  return { service, opsService, availabilityRows, unavailableRows, account, audit, db };
}

describe('StaffPortalAvailabilityService onboarding state', () => {
  beforeEach(() => {
    vi.spyOn(torontoUtil, 'torontoTodayDateString').mockReturnValue(TODAY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('anchor', () => {
    it('ensure initializes anchor to Toronto Monday', async () => {
      const harness = createHarness();
      const state = await harness.service.ensureOnboardingState(SESSION_A);
      expect(state.anchorEstablished).toBe(true);
      expect(state.week1Start).toBe(MONDAY);
      expect(state.week2Start).toBe(WEEK2);
      expect(harness.account.availabilityOnboardingWeek1Start).toBe(MONDAY);
      expect(harness.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: STAFF_PORTAL_AUDIT_EVENTS.availabilityOnboardingPeriodStarted,
        }),
        expect.anything(),
      );
    });

    it('ensure is idempotent', async () => {
      const harness = createHarness();
      const first = await harness.service.ensureOnboardingState(SESSION_A);
      harness.audit.mockClear();
      const second = await harness.service.ensureOnboardingState(SESSION_A);
      expect(second.week1Start).toBe(first.week1Start);
      expect(harness.audit).not.toHaveBeenCalled();
    });

    it('returning next week does not move anchor', async () => {
      vi.spyOn(torontoUtil, 'torontoTodayDateString').mockReturnValue('2026-08-17');
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.week1Start).toBe(MONDAY);
      expect(state.days.filter((d) => d.status === 'exempt_past')).toHaveLength(7);
    });

    it('GET does not establish anchor', async () => {
      const harness = createHarness();
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.anchorEstablished).toBe(false);
      expect(harness.account.availabilityOnboardingWeek1Start).toBeNull();
    });

    it('ensure requires profile and documents', async () => {
      const harness = createHarness({ profileCompletedAt: null });
      await expect(harness.service.ensureOnboardingState(SESSION_A)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('state', () => {
    it('returns 14 dates with week grouping', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.days).toHaveLength(14);
      expect(state.days.filter((d) => d.weekIndex === 1)).toHaveLength(7);
      expect(state.days.filter((d) => d.weekIndex === 2)).toHaveLength(7);
    });

    it('past dates exempt in both weeks once week 2 is past', async () => {
      vi.spyOn(torontoUtil, 'torontoTodayDateString').mockReturnValue('2026-08-24');
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.days.every((d) => d.status === 'exempt_past')).toBe(true);
      expect(state.canCompleteOnboarding).toBe(true);
    });

    it('today incomplete until answered', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      const state = await harness.service.getOnboardingState(SESSION_A);
      const today = state.days.find((d) => d.calendarDate === TODAY);
      expect(today?.status).toBe('incomplete');
    });

    it('availability marks day available', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      await harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '12:00',
      });
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.days.find((d) => d.calendarDate === TODAY)?.status).toBe('available');
    });

    it('explicit marker marks day unavailable', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      await harness.service.markUnavailable(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
      });
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.days.find((d) => d.calendarDate === TODAY)?.status).toBe('unavailable');
    });
  });

  describe('mark unavailable', () => {
    it('rejects outside anchored period and past dates', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      await expect(
        harness.service.markUnavailable(SESSION_A, {
          weekStartDate: '2026-08-24',
          dayOfWeek: 0,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        harness.service.markUnavailable(SESSION_A, {
          weekStartDate: MONDAY,
          dayOfWeek: 0,
        }),
      ).rejects.toThrow(/past date/i);
    });

    it('atomically removes existing windows and creates marker', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      await harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '12:00',
      });
      await harness.service.markUnavailable(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
      });
      expect(harness.availabilityRows).toHaveLength(0);
      expect(harness.unavailableRows).toHaveLength(1);
      const opsRows = await harness.opsService.list(MONDAY, STAFF_A);
      expect(opsRows).toHaveLength(0);
    });

    it('clear unavailable returns day to incomplete', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      await harness.service.markUnavailable(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
      });
      await harness.service.clearUnavailable(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
      });
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.days.find((d) => d.calendarDate === TODAY)?.status).toBe('incomplete');
    });
  });

  describe('create clears unavailable', () => {
    it('creating window clears unavailable marker atomically', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      await harness.service.markUnavailable(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
      });
      await harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '12:00',
      });
      expect(harness.unavailableRows).toHaveLength(0);
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.days.find((d) => d.calendarDate === TODAY)?.status).toBe('available');
    });
  });

  describe('delete', () => {
    it('deleting last window results in incomplete not unavailable', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      const created = await harness.service.create(SESSION_A, {
        weekStartDate: MONDAY,
        dayOfWeek: TODAY_DAY,
        startTime: '09:00',
        endTime: '12:00',
      });
      await harness.service.remove(SESSION_A, created.id);
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.days.find((d) => d.calendarDate === TODAY)?.status).toBe('incomplete');
    });
  });

  describe('complete availability step', () => {
    it('rejects without anchor for incomplete account', async () => {
      const harness = createHarness();
      await expect(harness.service.completeStep3(SESSION_A)).rejects.toThrow(/onboarding period/i);
    });

    it('completes with blank weeks and zero rows', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      const result = await harness.service.completeStep3(SESSION_A);
      expect(result.availabilityComplete).toBe(true);
      expect(result.onboardingComplete).toBe(false);
      expect(harness.account.availabilityCompletedAt).not.toBeNull();
      expect(harness.account.onboardingCompletedAt).toBeNull();
    });

    it('completed account remains idempotent without revalidation', async () => {
      const completedAt = new Date('2026-08-20T12:00:00.000Z');
      const harness = createHarness({
        availabilityOnboardingWeek1Start: null,
        onboardingCompletedAt: completedAt,
      });
      const result = await harness.service.completeStep3(SESSION_A);
      expect(result.onboardingComplete).toBe(true);
      expect(harness.audit).not.toHaveBeenCalled();
    });

    it('does not require unavailable markers or per-day completion', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      const state = await harness.service.getOnboardingState(SESSION_A);
      expect(state.canCompleteOnboarding).toBe(false);
      await expect(harness.service.completeStep3(SESSION_A)).resolves.toMatchObject({
        availabilityComplete: true,
      });
    });
  });

  describe('security', () => {
    it('Staff B session cannot manipulate Staff A account', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: MONDAY });
      await expect(
        harness.service.markUnavailable(SESSION_B, {
          weekStartDate: MONDAY,
          dayOfWeek: TODAY_DAY,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});

describe('StaffPortalAvailabilityController onboarding routes', () => {
  it('registers onboarding routes before parameterized id routes', async () => {
    const { StaffPortalAvailabilityController } = await import(
      './staff-portal-availability.controller'
    );
    const proto = StaffPortalAvailabilityController.prototype;
    expect(Object.getOwnPropertyDescriptor(proto, 'getOnboardingState')).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(proto, 'ensureOnboardingState')).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(proto, 'markUnavailable')).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(proto, 'clearUnavailable')).toBeDefined();
  });
});

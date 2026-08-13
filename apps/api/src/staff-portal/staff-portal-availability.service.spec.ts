import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailabilityService } from '../availability/availability.service';
import * as torontoUtil from '../availability/availability-toronto.util';
import { availability, staffAccounts, type Availability } from '../db/schema';
import { STAFF_PORTAL_AUDIT_EVENTS } from './staff-portal-audit.service';
import { StaffPortalAvailabilityService } from './staff-portal-availability.service';
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
const TODAY = '2026-08-13';
const TODAY_DAY = 3;

type AccountRow = typeof staffAccounts.$inferSelect;

const DB_COLUMN_TO_FIELD: Record<string, string> = {
  staff_id: 'staffId',
  week_start_date: 'weekStartDate',
  day_of_week: 'dayOfWeek',
  start_time: 'startTime',
  end_time: 'endTime',
  id: 'id',
};

function extractEqFilters(condition: unknown): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  let pendingColumn: string | undefined;

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const chunk = node as { name?: string; value?: unknown; queryChunks?: unknown[] };
    if (chunk.name) pendingColumn = chunk.name;
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

function matchesFilters(row: Record<string, unknown>, filters: Record<string, unknown>): boolean {
  return Object.entries(filters).every(([key, value]) => row[key] === value);
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

function createHarness() {
  const availabilityRows: Availability[] = [];
  let account: AccountRow = {
    id: ACCOUNT_A,
    staffId: STAFF_A,
    email: 'carer-a@example.test',
    status: 'active',
    profileCompletedAt: new Date('2026-08-01T12:00:00.000Z'),
    documentsCompletedAt: new Date('2026-08-02T12:00:00.000Z'),
    onboardingStep: 3,
    onboardingCompletedAt: null,
    inviteTokenHash: null,
    inviteTokenExpiresAt: null,
    inviteSentAt: null,
    passwordHash: 'hash',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const audit = vi.fn();

  function buildSelect(table: unknown) {
    const isAccounts = tableName(table) === 'staff_accounts';
    return {
      where: (condition: unknown) => {
        const filters = extractEqFilters(condition);
        const rows = isAccounts
          ? account && matchesFilters(account, filters)
            ? [account]
            : []
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
    insert: vi.fn().mockImplementation(() => ({
      values: (row: Omit<Availability, 'id' | 'createdAt'>) => ({
        returning: async () => {
          const created: Availability = {
            id: `av-${availabilityRows.length + 1}`,
            createdAt: new Date(),
            ...row,
          };
          availabilityRows.push(created);
          return [created];
        },
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: (patch: Partial<AccountRow | Availability>) => ({
        where: (condition: unknown) => {
          const filters = extractEqFilters(condition);
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
    delete: vi.fn().mockImplementation(() => ({
      where: async (condition: unknown) => {
        const filters = extractEqFilters(condition);
        for (let i = availabilityRows.length - 1; i >= 0; i--) {
          if (matchesFilters(availabilityRows[i]!, filters)) {
            availabilityRows.splice(i, 1);
          }
        }
      },
    })),
    transaction: vi.fn().mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  };

  const service = new StaffPortalAvailabilityService(db as never, { record: audit } as never);
  const opsService = new AvailabilityService(db as never);

  return { service, opsService, availabilityRows, account, audit, db };
}

describe('StaffPortalAvailabilityService', () => {
  beforeEach(() => {
    vi.spyOn(torontoUtil, 'torontoTodayDateString').mockReturnValue(TODAY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('completes step 3 with zero availability rows', async () => {
    const harness = createHarness();
    const result = await harness.service.completeStep3(SESSION_A);
    expect(result.onboardingCompletedAt).not.toBeNull();
    expect(harness.account.onboardingCompletedAt).not.toBeNull();
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: STAFF_PORTAL_AUDIT_EVENTS.onboardingStep3Completed }),
    );
  });

  it('complete step 3 preserves earlier completion timestamps', async () => {
    const harness = createHarness();
    const profileAt = harness.account.profileCompletedAt!;
    const documentsAt = harness.account.documentsCompletedAt!;
    const result = await harness.service.completeStep3(SESSION_A);
    expect(result.profileCompletedAt).toBe(profileAt.toISOString());
    expect(result.documentsCompletedAt).toBe(documentsAt.toISOString());
  });

  it('complete step 3 is idempotent', async () => {
    const harness = createHarness();
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

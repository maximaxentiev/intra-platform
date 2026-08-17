import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as torontoUtil from '../availability/availability-toronto.util';
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

const SESSION_B: StaffSessionPayload = {
  kind: 'staff',
  accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  staffId: STAFF_B,
  email: 'carer-b@example.test',
};

const MONDAY = '2026-08-10';

type AccountRow = {
  id: string;
  staffId: string;
  email: string;
  status: string;
  profileCompletedAt: Date | null;
  documentsCompletedAt: Date | null;
  availabilityCompletedAt: Date | null;
  onboardingStep: number;
  onboardingCompletedAt: Date | null;
  availabilityOnboardingWeek1Start: string | null;
  inviteTokenHash: string | null;
  inviteTokenExpiresAt: Date | null;
  inviteSentAt: Date | null;
  passwordHash: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function createHarness(initial?: Partial<AccountRow>) {
  let account: AccountRow = {
    id: ACCOUNT_A,
    staffId: STAFF_A,
    email: 'carer-a@example.test',
    status: 'active',
    profileCompletedAt: new Date('2026-08-01T12:00:00.000Z'),
    documentsCompletedAt: new Date('2026-08-02T12:00:00.000Z'),
    availabilityCompletedAt: null,
    onboardingStep: 3,
    onboardingCompletedAt: null,
    availabilityOnboardingWeek1Start: MONDAY,
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

  const db = {
    select: vi.fn().mockImplementation(() => ({
      from: () => ({
        where: () => ({
          for: async () => [account],
          then: (resolve: (v: unknown) => void) => Promise.resolve([account]).then(resolve),
        }),
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: (patch: Partial<AccountRow>) => ({
        where: () => {
          Object.assign(account, patch);
          return Promise.resolve(undefined);
        },
      }),
    })),
    transaction: vi.fn().mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  };

  const onboarding = new StaffPortalOnboardingService(db as never, { record: audit } as never);
  const availability = new StaffPortalAvailabilityService(
    db as never,
    { record: audit } as never,
    onboarding,
  );

  return { onboarding, availability, account, audit };
}

describe('StaffPortalOnboardingService', () => {
  beforeEach(() => {
    vi.spyOn(torontoUtil, 'torontoTodayDateString').mockReturnValue('2026-08-13');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('completeAvailabilityStep', () => {
    it('rejects when profile incomplete', async () => {
      const harness = createHarness({ profileCompletedAt: null });
      await expect(harness.onboarding.completeAvailabilityStep(SESSION_A)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when documents incomplete', async () => {
      const harness = createHarness({ documentsCompletedAt: null });
      await expect(harness.onboarding.completeAvailabilityStep(SESSION_A)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when anchor missing', async () => {
      const harness = createHarness({ availabilityOnboardingWeek1Start: null });
      await expect(harness.onboarding.completeAvailabilityStep(SESSION_A)).rejects.toThrow(
        /onboarding period/i,
      );
    });

    it('succeeds with zero availability rows and blank weeks', async () => {
      const harness = createHarness();
      const result = await harness.onboarding.completeAvailabilityStep(SESSION_A);
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

    it('is idempotent on second call', async () => {
      const harness = createHarness();
      const first = await harness.onboarding.completeAvailabilityStep(SESSION_A);
      harness.audit.mockClear();
      const second = await harness.onboarding.completeAvailabilityStep(SESSION_A);
      expect(second.availabilityCompletedAt).toBe(first.availabilityCompletedAt);
      expect(harness.audit).not.toHaveBeenCalled();
    });

    it('returns success without regressing legacy completed accounts', async () => {
      const completedAt = new Date('2026-08-20T12:00:00.000Z');
      const harness = createHarness({
        onboardingCompletedAt: completedAt,
        availabilityCompletedAt: null,
        availabilityOnboardingWeek1Start: null,
      });
      const result = await harness.onboarding.completeAvailabilityStep(SESSION_A);
      expect(result.availabilityComplete).toBe(true);
      expect(result.onboardingComplete).toBe(true);
      expect(harness.account.availabilityCompletedAt).toBeNull();
      expect(harness.audit).not.toHaveBeenCalled();
    });
  });

  describe('completeOnboarding', () => {
    it('rejects when profile incomplete', async () => {
      const harness = createHarness({ profileCompletedAt: null });
      await expect(harness.onboarding.completeOnboarding(SESSION_A)).rejects.toThrow(
        /personal information/i,
      );
    });

    it('rejects when documents incomplete', async () => {
      const harness = createHarness({ documentsCompletedAt: null });
      await expect(harness.onboarding.completeOnboarding(SESSION_A)).rejects.toThrow(/documents/i);
    });

    it('rejects when availability step incomplete', async () => {
      const harness = createHarness({ availabilityCompletedAt: null });
      await expect(harness.onboarding.completeOnboarding(SESSION_A)).rejects.toThrow(
        /availability step/i,
      );
    });

    it('succeeds when all three steps complete with zero availability rows', async () => {
      const harness = createHarness({
        availabilityCompletedAt: new Date('2026-08-03T12:00:00.000Z'),
      });
      const result = await harness.onboarding.completeOnboarding(SESSION_A);
      expect(result.onboardingComplete).toBe(true);
      expect(result.onboardingCompletedAt).not.toBeNull();
      expect(harness.account.profileCompletedAt).not.toBeNull();
      expect(harness.account.documentsCompletedAt).not.toBeNull();
      expect(harness.account.availabilityCompletedAt).not.toBeNull();
      expect(harness.audit).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: STAFF_PORTAL_AUDIT_EVENTS.onboardingCompleted }),
        expect.anything(),
      );
    });

    it('is idempotent for already completed accounts', async () => {
      const completedAt = new Date('2026-08-20T12:00:00.000Z');
      const harness = createHarness({
        onboardingCompletedAt: completedAt,
        availabilityCompletedAt: completedAt,
      });
      harness.audit.mockClear();
      const result = await harness.onboarding.completeOnboarding(SESSION_A);
      expect(result.onboardingCompletedAt).toBe(completedAt.toISOString());
      expect(harness.audit).not.toHaveBeenCalled();
    });
  });

  describe('deprecated complete-step-3 compatibility', () => {
    it('delegates to availability-step completion semantics', async () => {
      const harness = createHarness();
      const result = await harness.availability.completeStep3(SESSION_A);
      expect(result.availabilityComplete).toBe(true);
      expect(result.onboardingComplete).toBe(false);
      expect(harness.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: STAFF_PORTAL_AUDIT_EVENTS.onboardingAvailabilityStepCompleted,
        }),
        expect.anything(),
      );
    });

    it('complete-onboarding-step matches complete-step-3 behavior', async () => {
      const harness = createHarness();
      const viaNew = await harness.availability.completeOnboardingStep(SESSION_A);
      expect(viaNew.availabilityComplete).toBe(true);
    });
  });

  describe('security', () => {
    it('rejects when session staffId does not match account', async () => {
      const harness = createHarness();
      await expect(harness.onboarding.completeAvailabilityStep(SESSION_B)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});

describe('StaffPortalOnboardingController', () => {
  it('registers final onboarding completion route', async () => {
    const { StaffPortalOnboardingController } = await import('./staff-portal-onboarding.controller');
    expect(Object.getOwnPropertyDescriptor(StaffPortalOnboardingController.prototype, 'complete')).toBeDefined();
  });
});

describe('StaffPortalAvailabilityController onboarding completion routes', () => {
  it('registers complete-onboarding-step before deprecated complete-step-3', async () => {
    const { StaffPortalAvailabilityController } = await import(
      './staff-portal-availability.controller'
    );
    const proto = StaffPortalAvailabilityController.prototype;
    expect(Object.getOwnPropertyDescriptor(proto, 'completeOnboardingStep')).toBeDefined();
    expect(Object.getOwnPropertyDescriptor(proto, 'completeStep3')).toBeDefined();
  });
});

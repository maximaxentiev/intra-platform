import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffPortalProfileController } from './staff-portal-profile.controller';
import { StaffPortalProfileService } from './staff-portal-profile.service';
import type { StaffSessionPayload } from './staff-session.service';
import { STAFF_PORTAL_AUDIT_EVENTS } from './staff-portal-audit.service';

type PersonRow = {
  id: string;
  legalFirstName: string;
  legalLastName: string;
  legalName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
};

type AccountRow = {
  id: string;
  staffId: string;
  email: string;
  status: 'invited' | 'incomplete' | 'active' | 'disabled';
  onboardingStep: number;
  profileCompletedAt: Date | null;
  onboardingCompletedAt: Date | null;
};

function createHarness() {
  let person: PersonRow | null = null;
  let account: AccountRow | null = null;
  const selectQueue: unknown[][] = [];
  const audit = vi.fn();

  const db = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(async () => {
          if (selectQueue.length) return selectQueue.shift()!;
          return [];
        }),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((values: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation(async () => {
          if (account && values.profileCompletedAt) {
            account.profileCompletedAt = values.profileCompletedAt as Date;
            account.onboardingStep = values.onboardingStep as number;
          }
        }),
      })),
    })),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation((values: Record<string, unknown>) => ({
            where: vi.fn().mockImplementation(async () => {
              if (person && values.legalFirstName !== undefined) {
                person.legalFirstName = values.legalFirstName as string;
                person.legalLastName = values.legalLastName as string;
                person.legalName = values.legalName as string;
                person.email = values.email as string;
                person.phone = values.phone as string;
                person.address = values.address as string;
                person.city = values.city as string;
              }
              if (account && values.email !== undefined && values.profileCompletedAt === undefined) {
                account.email = values.email as string;
              }
            }),
          })),
        })),
      };
      await fn(tx);
    }),
  } as never;

  const service = new StaffPortalProfileService(db, { record: audit } as never);

  return {
    service,
    audit,
    setPerson: (p: PersonRow) => {
      person = p;
    },
    setAccount: (a: AccountRow) => {
      account = a;
    },
    getAccount: () => account,
    getPerson: () => person,
    queueSelect: (...rows: unknown[][]) => {
      selectQueue.push(...rows);
    },
    queueLoadSelf: () => {
      selectQueue.push(
        [account!],
        [person!],
      );
    },
  };
}

const session: StaffSessionPayload = {
  kind: 'staff',
  accountId: 'acc-1',
  staffId: 'staff-1',
  email: 'carer@example.test',
};

describe('StaffPortalProfileService', () => {
  let h: ReturnType<typeof createHarness>;

  beforeEach(() => {
    h = createHarness();
    h.setPerson({
      id: 'staff-1',
      legalFirstName: 'Alex',
      legalLastName: 'Carer',
      legalName: 'Alex Carer',
      email: 'carer@example.test',
      phone: '555-0100',
      address: '1 Main St',
      city: 'Toronto',
    });
    h.setAccount({
      id: 'acc-1',
      staffId: 'staff-1',
      email: 'carer@example.test',
      status: 'incomplete',
      onboardingStep: 1,
      profileCompletedAt: null,
      onboardingCompletedAt: null,
    });
  });

  it('returns own profile for authenticated carer', async () => {
    h.queueLoadSelf();
    const profile = await h.service.getProfile(session);
    expect(profile.legalFirstName).toBe('Alex');
  });

  it('rejects disabled account', async () => {
    h.setAccount({
      id: 'acc-1',
      staffId: 'staff-1',
      email: 'carer@example.test',
      status: 'disabled',
      onboardingStep: 1,
      profileCompletedAt: null,
      onboardingCompletedAt: null,
    });
    h.queueLoadSelf();
    await expect(h.service.getProfile(session)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('updates profile and keeps legal name consistent', async () => {
    h.queueLoadSelf();
    h.queueSelect([], []);
    h.queueLoadSelf();
    const profile = await h.service.updateProfile(session, {
      legalFirstName: 'Jordan',
      legalLastName: 'Lee',
      email: 'newemail@example.test',
      phone: '555-0200',
      address: '2 Oak',
      city: 'Ottawa',
    });
    expect(profile.email).toBe('newemail@example.test');
    expect(h.getPerson()?.legalName).toBe('Jordan Lee');
    expect(h.getAccount()?.email).toBe('newemail@example.test');
    expect(h.audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: STAFF_PORTAL_AUDIT_EVENTS.carerProfileUpdated }),
    );
  });

  it('rejects duplicate portal email', async () => {
    h.queueLoadSelf();
    h.queueSelect([], [{ staffId: 'other-staff' }]);
    await expect(
      h.service.updateProfile(session, {
        legalFirstName: 'Alex',
        legalLastName: 'Carer',
        email: 'taken@example.test',
        phone: '555-0100',
        address: '1 Main St',
        city: 'Toronto',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('completes step 1 idempotently and leaves onboarding_completed_at null', async () => {
    h.queueLoadSelf();
    h.queueLoadSelf();
    const first = await h.service.completeProfileStep(session);
    expect(first.profileCompletedAt).toBeTruthy();
    expect(first.onboardingCompletedAt).toBeNull();
    h.audit.mockClear();
    h.queueLoadSelf();
    h.queueLoadSelf();
    await h.service.completeProfileStep(session);
    expect(h.audit).not.toHaveBeenCalled();
  });

  it('rejects step 1 completion when required fields missing', async () => {
    h.setPerson({
      id: 'staff-1',
      legalFirstName: '',
      legalLastName: 'Carer',
      legalName: 'Carer',
      email: 'carer@example.test',
      phone: '',
      address: '',
      city: '',
    });
    h.queueLoadSelf();
    await expect(h.service.completeProfileStep(session)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('StaffPortalProfileController metadata', () => {
  it('requires staff session and carer portal enabled', () => {
    const guards = Reflect.getMetadata('__guards__', StaffPortalProfileController);
    expect(guards?.length).toBeGreaterThanOrEqual(2);
  });
});

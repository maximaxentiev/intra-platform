import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailDeliveryError, EmailService } from '../email/email.service';
import { RecordingEmailTransport } from '../email/email.transport';
import { hashToken, StaffAuthService } from './staff-auth.service';
import { StaffPortalAuditService, STAFF_PORTAL_AUDIT_EVENTS } from './staff-portal-audit.service';
import { StaffPortalInvitationsService } from './staff-portal-invitations.service';
import { staff, staffAccounts } from '../db/schema';

type StaffRow = {
  id: string;
  email: string;
  legalFirstName: string;
  legalLastName: string;
};

type AccountRow = {
  id: string;
  staffId: string;
  email: string;
  status: 'invited' | 'incomplete' | 'active' | 'disabled';
  passwordHash: string | null;
  inviteTokenHash: string | null;
  inviteTokenExpiresAt: Date | null;
  inviteSentAt: Date | null;
  onboardingCompletedAt: Date | null;
  onboardingStep: number;
};

function configService() {
  return {
    get: (key: string) => {
      if (key === 'APP_PUBLIC_URL') return 'https://platform.intra.ca';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    },
  } as ConfigService;
}

describe('StaffPortalInvitationsService', () => {
  let staffRows: StaffRow[];
  let accountRows: AccountRow[];
  let auditRecords: unknown[];
  let inviteIssueCount: number;
  let lastIssuedToken: string;
  let service: StaffPortalInvitationsService;
  let email: EmailService;
  let onboardingReminders: { scheduleAndEnqueueForAccount: ReturnType<typeof vi.fn>; cancelPendingForAccount: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    staffRows = [
      {
        id: 'staff-1',
        email: 'carer@example.test',
        legalFirstName: 'Alex',
        legalLastName: 'Carer',
      },
    ];
    accountRows = [];
    auditRecords = [];
    inviteIssueCount = 0;
    lastIssuedToken = '';

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: unknown) => ({
          where: vi.fn().mockImplementation(async () => {
            if (table === staffAccounts) {
              return accountRows.filter((a) => a.staffId === 'staff-1');
            }
            if (table === staff) return [...staffRows];
            return [];
          }),
          orderBy: vi.fn().mockResolvedValue([...staffRows]),
        })),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((row: Partial<AccountRow>) => ({
          returning: vi.fn().mockImplementation(async () => {
            const created: AccountRow = {
              id: 'acc-new',
              staffId: row.staffId ?? 'staff-1',
              email: row.email ?? 'carer@example.test',
              status: (row.status as AccountRow['status']) ?? 'invited',
              passwordHash: null,
              inviteTokenHash: null,
              inviteTokenExpiresAt: null,
              inviteSentAt: null,
              onboardingCompletedAt: null,
              onboardingStep: 0,
            };
            accountRows.push(created);
            return [created];
          }),
        })),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((patch: Partial<AccountRow>) => ({
          where: vi.fn().mockImplementation(async () => {
            const id = patch.id ?? accountRows[0]?.id;
            const idx = accountRows.findIndex((a) => a.id === id || !id);
            if (idx >= 0) {
              accountRows[idx] = { ...accountRows[idx]!, ...patch };
            }
          }),
        })),
      }),
    } as never;

    const audit = {
      record: vi.fn().mockImplementation(async (event: unknown) => {
        auditRecords.push(event);
      }),
    } as unknown as StaffPortalAuditService;

    const auth = {
      issueInviteToken: vi.fn().mockImplementation(async (accountId: string) => {
        inviteIssueCount += 1;
        lastIssuedToken = `invite-token-${inviteIssueCount}`;
        const idx = accountRows.findIndex((a) => a.id === accountId);
        if (idx >= 0) {
          accountRows[idx] = {
            ...accountRows[idx]!,
            inviteTokenHash: hashToken(lastIssuedToken),
            inviteTokenExpiresAt: new Date(Date.now() + 86_400_000),
            inviteSentAt: new Date(),
            status: 'invited',
          };
        }
        return lastIssuedToken;
      }),
    } as unknown as StaffAuthService;

    email = new EmailService(configService());
    email.useTransport(new RecordingEmailTransport());

    onboardingReminders = {
      scheduleAndEnqueueForAccount: vi.fn(),
      cancelPendingForAccount: vi.fn(),
    };

    service = new StaffPortalInvitationsService(
      db,
      auth,
      email,
      audit,
      configService(),
      onboardingReminders as never,
    );
  });

  it('schedules onboarding reminders after successful invitation email', async () => {
    await service.sendInvitation('staff-1', 'ops-user-1');
    expect(onboardingReminders.scheduleAndEnqueueForAccount).toHaveBeenCalledTimes(1);
  });

  it('creates portal account, sends email, and returns invited status without raw token', async () => {
    const result = await service.sendInvitation('staff-1', 'ops-user-1', { resend: false });
    expect(result.emailSent).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.accountStatus).toBe('invited');
    expect(JSON.stringify(result)).not.toContain('invite-token');
    expect(accountRows).toHaveLength(1);
    const transport = email['transport'] as RecordingEmailTransport;
    const sent = transport.sent[0]!;
    expect(sent.to).toBe('carer@example.test');
    expect(sent.html).toContain('platform.intra.ca/carer/invite/');
    expect(sent.html).not.toContain('invite_token_hash');
  });

  it('reports email failure without rolling back invited account', async () => {
    email.useTransport({
      send: vi.fn().mockRejectedValue(new EmailDeliveryError('Resend API unavailable')),
    });
    const result = await service.sendInvitation('staff-1', 'ops-user-1');
    expect(result.ok).toBe(false);
    expect(result.emailSent).toBe(false);
    expect(result.message).toContain('Resend');
    expect(accountRows).toHaveLength(1);
    expect(
      auditRecords.some(
        (e) =>
          (e as { eventType: string }).eventType === STAFF_PORTAL_AUDIT_EVENTS.invitationEmailFailed,
      ),
    ).toBe(true);
  });

  it('resend issues a new token (invalidates previous hash)', async () => {
    await service.sendInvitation('staff-1', 'ops-user-1');
    const firstHash = accountRows[0]!.inviteTokenHash;
    await service.sendInvitation('staff-1', 'ops-user-1', { resend: true });
    expect(inviteIssueCount).toBe(2);
    expect(accountRows[0]!.inviteTokenHash).not.toBe(firstHash);
    expect(
      auditRecords.some(
        (e) => (e as { eventType: string }).eventType === STAFF_PORTAL_AUDIT_EVENTS.invitationResent,
      ),
    ).toBe(true);
  });

  it('rejects invitation for disabled accounts', async () => {
    accountRows.push({
      id: 'acc-1',
      staffId: 'staff-1',
      email: 'carer@example.test',
      status: 'disabled',
      passwordHash: 'hash',
      inviteTokenHash: null,
      inviteTokenExpiresAt: null,
      inviteSentAt: null,
      onboardingCompletedAt: null,
      onboardingStep: 0,
    });
    await expect(service.sendInvitation('staff-1', 'ops-user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects duplicate email already used by another staff member', async () => {
    staffRows.push({
      id: 'staff-2',
      email: 'carer@example.test',
      legalFirstName: 'Other',
      legalLastName: 'Carer',
    });
    await expect(service.sendInvitation('staff-1', 'ops-user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('never stores raw tokens in audit detail', async () => {
    await service.sendInvitation('staff-1', 'ops-user-1');
    const blob = JSON.stringify(auditRecords);
    expect(blob).not.toContain(lastIssuedToken);
    expect(blob.toLowerCase()).not.toContain('invite_token');
  });
});

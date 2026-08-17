import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../auth/password.util';
import { EmailDeliveryError, EmailService } from '../email/email.service';
import { RecordingEmailTransport } from '../email/email.transport';
import { hashToken, StaffAuthService } from './staff-auth.service';
import { STAFF_PORTAL_AUDIT_EVENTS } from './staff-portal-audit.service';
import type { StaffSessionService } from './staff-session.service';

function configService() {
  return {
    get: (key: string) => {
      if (key === 'APP_PUBLIC_URL') return 'https://platform.intra.ca';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    },
  } as ConfigService;
}

type AccountRow = {
  id: string;
  staffId: string;
  email: string;
  passwordHash: string | null;
  status: 'invited' | 'incomplete' | 'active' | 'disabled';
  inviteTokenHash: string | null;
  inviteTokenExpiresAt: Date | null;
  onboardingStep: number;
};

function mockDb() {
  let selectRows: unknown[] = [];
  const updateSets: unknown[] = [];

  const where = vi.fn().mockImplementation(async () => selectRows);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockImplementation((values: unknown) => {
    updateSets.push(values);
    return { where: updateWhere };
  });
  const update = vi.fn().mockReturnValue({ set });

  const insertReturning = vi.fn().mockResolvedValue([]);
  const values = vi.fn().mockReturnValue({ returning: insertReturning });
  const insert = vi.fn().mockReturnValue({ values });

  const db = { select, update, insert } as never;

  return {
    db,
    setSelectRows: (rows: unknown[]) => {
      selectRows = rows;
    },
    updateSets,
    updateWhere,
  };
}

function mockSessions(): StaffSessionService {
  return {
    create: vi.fn().mockResolvedValue('staff-session-id'),
    destroy: vi.fn().mockResolvedValue(undefined),
    cookieName: 'intra_session_staff',
    ttlSeconds: 3600,
    cookieOptions: vi.fn().mockReturnValue({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    }),
  } as unknown as StaffSessionService;
}

describe('StaffAuthService', () => {
  let dbMock: ReturnType<typeof mockDb>;
  let sessions: StaffSessionService;
  let service: StaffAuthService;
  let email: EmailService;
  let audit: { record: ReturnType<typeof vi.fn> };

  const staffRow = {
    id: 'staff-1',
    legalFirstName: 'Alex',
    legalLastName: 'Carer',
    phone: '',
    address: '',
    city: '',
  };

  beforeEach(() => {
    dbMock = mockDb();
    sessions = mockSessions();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    email = new EmailService(configService());
    email.useTransport(new RecordingEmailTransport());
    service = new StaffAuthService(
      dbMock.db,
      sessions,
      audit as never,
      email,
      configService(),
    );
  });

  describe('login', () => {
    it('succeeds with valid credentials', async () => {
      const hash = await hashPassword('ValidPassword1');
      const account: AccountRow = {
        id: 'acc-1',
        staffId: 'staff-1',
        email: 'carer@example.test',
        passwordHash: hash,
        status: 'active',
        inviteTokenHash: null,
        inviteTokenExpiresAt: null,
        onboardingStep: 1,
      };
      dbMock.setSelectRows([account]);
      // staff lookup for me() is not in login return - login calls startSession only
      const result = await service.login('carer@example.test', 'ValidPassword1');
      expect(result.sid).toBe('staff-session-id');
      expect(sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'staff', email: 'carer@example.test' }),
      );
    });

    it('rejects incorrect password', async () => {
      const hash = await hashPassword('ValidPassword1');
      dbMock.setSelectRows([
        {
          id: 'acc-1',
          staffId: 'staff-1',
          email: 'carer@example.test',
          passwordHash: hash,
          status: 'active',
        },
      ]);
      await expect(service.login('carer@example.test', 'WrongPassword1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects missing password hash', async () => {
      dbMock.setSelectRows([
        {
          id: 'acc-1',
          staffId: 'staff-1',
          email: 'carer@example.test',
          passwordHash: null,
          status: 'invited',
        },
      ]);
      await expect(service.login('carer@example.test', 'AnyPassword12')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects disabled account', async () => {
      const hash = await hashPassword('ValidPassword1');
      dbMock.setSelectRows([
        {
          id: 'acc-1',
          staffId: 'staff-1',
          email: 'carer@example.test',
          passwordHash: hash,
          status: 'disabled',
        },
      ]);
      await expect(service.login('carer@example.test', 'ValidPassword1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('describeInvite', () => {
    it('returns invite metadata for valid token', async () => {
      const raw = 'valid-invite-token-abc';
      const account = {
        id: 'acc-1',
        staffId: 'staff-1',
        email: 'carer@example.test',
        passwordHash: null,
        inviteTokenHash: hashToken(raw),
        inviteTokenExpiresAt: new Date(Date.now() + 60_000),
      };
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;
      select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([account]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([staffRow]),
          }),
        });

      const info = await service.describeInvite(raw);
      expect(info.email).toBe('carer@example.test');
      expect(info.alreadySetUp).toBe(false);
    });

    it('rejects expired invite', async () => {
      const raw = 'expired-token';
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;
      select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      await expect(service.describeInvite(raw)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('acceptInvite', () => {
    it('sets password and starts session', async () => {
      const raw = 'accept-token-xyz';
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;
      select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'acc-1',
                staffId: 'staff-1',
                email: 'carer@example.test',
                passwordHash: null,
                status: 'invited',
                inviteTokenHash: hashToken(raw),
                inviteTokenExpiresAt: new Date(Date.now() + 60_000),
              },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([staffRow]),
          }),
        });

      const result = await service.acceptInvite(raw, 'NewPassword12');
      expect(result.sid).toBe('staff-session-id');
      expect(dbMock.updateSets[0]).toMatchObject({
        inviteTokenHash: null,
        inviteTokenExpiresAt: null,
        status: 'incomplete',
      });
    });

    it('sends confirmation email on first account setup', async () => {
      const raw = 'accept-token-confirm';
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;
      select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'acc-1',
                staffId: 'staff-1',
                email: 'carer@example.test',
                passwordHash: null,
                status: 'invited',
                inviteTokenHash: hashToken(raw),
                inviteTokenExpiresAt: new Date(Date.now() + 60_000),
              },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([staffRow]),
          }),
        });

      await service.acceptInvite(raw, 'NewPassword12');

      const transport = email['transport'] as RecordingEmailTransport;
      const sent = transport.sent[0]!;
      expect(sent.to).toBe('carer@example.test');
      expect(sent.subject).toBe('Your Intra Carer Portal account is ready');
      expect(sent.html).toContain('https://platform.intra.ca/carer');
      expect(sent.text).toContain('https://platform.intra.ca/carer');
      expect(sent.html).not.toContain(raw);
      expect(sent.text.toLowerCase()).not.toContain('password');
      expect(
        audit.record.mock.calls.some(
          ([event]) =>
            event.eventType === STAFF_PORTAL_AUDIT_EVENTS.carerAccountConfirmationEmailSent,
        ),
      ).toBe(true);
    });

    it('does not roll back account creation when confirmation email fails', async () => {
      email.useTransport({
        send: vi.fn().mockRejectedValue(new EmailDeliveryError('Resend API unavailable')),
      });
      const raw = 'accept-token-email-fail';
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;
      select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'acc-1',
                staffId: 'staff-1',
                email: 'carer@example.test',
                passwordHash: null,
                status: 'invited',
                inviteTokenHash: hashToken(raw),
                inviteTokenExpiresAt: new Date(Date.now() + 60_000),
              },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([staffRow]),
          }),
        });

      const result = await service.acceptInvite(raw, 'NewPassword12');
      expect(result.sid).toBe('staff-session-id');
      expect(sessions.create).toHaveBeenCalled();
      expect(
        audit.record.mock.calls.some(
          ([event]) =>
            event.eventType === STAFF_PORTAL_AUDIT_EVENTS.carerAccountConfirmationEmailFailed,
        ),
      ).toBe(true);
    });

    it('does not send confirmation email when resetting password via invite', async () => {
      const raw = 'reset-token-xyz';
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;
      select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'acc-1',
                staffId: 'staff-1',
                email: 'carer@example.test',
                passwordHash: 'existing-hash',
                status: 'active',
                inviteTokenHash: hashToken(raw),
                inviteTokenExpiresAt: new Date(Date.now() + 60_000),
              },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([staffRow]),
          }),
        });

      await service.acceptInvite(raw, 'NewPassword12');
      const transport = email['transport'] as RecordingEmailTransport;
      expect(transport.sent).toHaveLength(0);
    });

    it('rejects reused invite after token cleared', async () => {
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;
      select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      await expect(service.acceptInvite('used-token', 'NewPassword12')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('enforces password policy', async () => {
      const raw = 'token';
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;
      select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'acc-1',
              staffId: 'staff-1',
              email: 'carer@example.test',
              passwordHash: null,
              status: 'invited',
              inviteTokenHash: hashToken(raw),
              inviteTokenExpiresAt: new Date(Date.now() + 60_000),
            },
          ]),
        }),
      });
      await expect(service.acceptInvite(raw, 'short')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('acceptInvite login after email failure', () => {
    it('allows login after confirmation email failure', async () => {
      email.useTransport({
        send: vi.fn().mockRejectedValue(new EmailDeliveryError('Resend API unavailable')),
      });
      const raw = 'accept-then-login';
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;

      select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'acc-1',
                staffId: 'staff-1',
                email: 'carer@example.test',
                passwordHash: null,
                status: 'invited',
                inviteTokenHash: hashToken(raw),
                inviteTokenExpiresAt: new Date(Date.now() + 60_000),
              },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([staffRow]),
          }),
        });

      await service.acceptInvite(raw, 'NewPassword12');

      const updateHash = (dbMock.updateSets[0] as { passwordHash: string }).passwordHash;
      dbMock.setSelectRows([
        {
          id: 'acc-1',
          staffId: 'staff-1',
          email: 'carer@example.test',
          passwordHash: updateHash,
          status: 'incomplete',
        },
      ]);

      const login = await service.login('carer@example.test', 'NewPassword12');
      expect(login.sid).toBe('staff-session-id');
    });
  });

  describe('requestPasswordReset', () => {
    it('does not throw when account missing', async () => {
      dbMock.setSelectRows([]);
      await expect(service.requestPasswordReset('missing@example.test')).resolves.toBeUndefined();
    });

    it('issues token without returning it to caller', async () => {
      dbMock.setSelectRows([{ id: 'acc-1', staffId: 'staff-1', email: 'a@example.test' }]);
      const result = await service.requestPasswordReset('a@example.test');
      expect(result).toBeUndefined();
      expect(dbMock.updateSets.length).toBeGreaterThan(0);
    });
  });

  describe('logout', () => {
    it('destroys session', async () => {
      await service.logout('sid-123');
      expect(sessions.destroy).toHaveBeenCalledWith('sid-123');
    });
  });

  describe('me / session retrieval', () => {
    it('returns profile for valid account', async () => {
      const select = dbMock.db.select as ReturnType<typeof vi.fn>;
      select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: 'acc-1',
                staffId: 'staff-1',
                email: 'carer@example.test',
                status: 'active',
                onboardingStep: 2,
                onboardingCompletedAt: null,
                profileCompletedAt: new Date('2026-01-01T12:00:00.000Z'),
                documentsCompletedAt: new Date('2026-01-02T12:00:00.000Z'),
                availabilityCompletedAt: null,
              },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([staffRow]),
          }),
        });

      const profile = await service.me({
        kind: 'staff',
        accountId: 'acc-1',
        staffId: 'staff-1',
        email: 'carer@example.test',
      });
      expect(profile.legalFirstName).toBe('Alex');
      expect(profile.onboardingStep).toBe(2);
      expect(profile.documentsCompletedAt).toBe('2026-01-02T12:00:00.000Z');
      expect(profile.documentsComplete).toBe(true);
      expect(profile.availabilityComplete).toBe(false);
      expect(profile.canCompleteOnboarding).toBe(false);
    });
  });
});

describe('hashToken', () => {
  it('is deterministic and does not equal raw token', () => {
    const raw = 'super-secret-invite-token';
    const hashed = hashToken(raw);
    expect(hashed).not.toBe(raw);
    expect(hashToken(raw)).toBe(hashed);
  });
});

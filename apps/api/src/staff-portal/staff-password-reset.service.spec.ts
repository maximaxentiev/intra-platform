import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '../auth/password.util';
import { EmailDeliveryError, EmailService } from '../email/email.service';
import { RecordingEmailTransport } from '../email/email.transport';
import { hashToken } from './staff-auth.service';
import { STAFF_PASSWORD_RESET_TTL_MS } from './staff-password-reset.constants';
import { StaffPasswordResetRateLimitService } from './staff-password-reset-rate-limit.service';
import { StaffPasswordResetService } from './staff-password-reset.service';
import { STAFF_PORTAL_AUDIT_EVENTS } from './staff-portal-audit.service';
import type { StaffSessionService } from './staff-session.service';
import type { StaffPortalInvitationsService } from './staff-portal-invitations.service';

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
  passwordResetTokenHash: string | null;
  passwordResetTokenExpiresAt: Date | null;
  passwordResetRequestedAt: Date | null;
};

function mockDb() {
  let selectRows: unknown[] = [];
  const updateSets: unknown[] = [];
  let returningRows: unknown[] = [];

  const where = vi.fn().mockImplementation(async () => selectRows);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const updateWhere = vi.fn().mockImplementation(() => ({
    returning: vi.fn().mockImplementation(async () => returningRows),
  }));
  const returning = vi.fn().mockImplementation(async () => returningRows);
  const set = vi.fn().mockImplementation((values: unknown) => {
    updateSets.push(values);
    return { where: updateWhere, returning };
  });
  const update = vi.fn().mockReturnValue({ set });

  const db = { select, update } as never;

  return {
    db,
    setSelectRows: (rows: unknown[]) => {
      selectRows = rows;
    },
    setReturningRows: (rows: unknown[]) => {
      returningRows = rows;
    },
    updateSets,
    updateWhere,
    returning,
  };
}

describe('StaffPasswordResetService', () => {
  let dbMock: ReturnType<typeof mockDb>;
  let sessions: StaffSessionService;
  let audit: { record: ReturnType<typeof vi.fn> };
  let email: EmailService;
  let rateLimit: StaffPasswordResetRateLimitService;
  let invitations: StaffPortalInvitationsService;
  let service: StaffPasswordResetService;

  const activeAccount: AccountRow = {
    id: 'acc-1',
    staffId: 'staff-1',
    email: 'carer@example.test',
    passwordHash: 'existing-hash',
    status: 'active',
    inviteTokenHash: 'invite-hash',
    inviteTokenExpiresAt: new Date(Date.now() + 86_400_000),
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
    passwordResetRequestedAt: null,
  };

  beforeEach(() => {
    dbMock = mockDb();
    sessions = {
      destroyAllForAccount: vi.fn().mockResolvedValue(2),
    } as unknown as StaffSessionService;
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    email = new EmailService(configService());
    email.useTransport(new RecordingEmailTransport());
    rateLimit = {
      assertForgotPasswordAllowed: vi.fn().mockResolvedValue(undefined),
      assertResetAttemptAllowed: vi.fn().mockResolvedValue(undefined),
    } as unknown as StaffPasswordResetRateLimitService;
    invitations = {
      sendInvitationEmailForForgotPassword: vi.fn().mockResolvedValue(undefined),
    } as unknown as StaffPortalInvitationsService;
    service = new StaffPasswordResetService(
      dbMock.db,
      sessions,
      audit as never,
      email,
      configService(),
      rateLimit,
      invitations,
    );
  });

  describe('requestPasswordReset', () => {
    it('returns without error for unknown account after rate limiting', async () => {
      dbMock.setSelectRows([]);
      await expect(
        service.requestPasswordReset('missing@example.test', '1.2.3.4'),
      ).resolves.toBeUndefined();
      expect(rateLimit.assertForgotPasswordAllowed).toHaveBeenCalledWith(
        '1.2.3.4',
        'missing@example.test',
      );
      expect(dbMock.updateSets).toHaveLength(0);
    });

    it('does not issue reset token for disabled account', async () => {
      dbMock.setSelectRows([{ ...activeAccount, status: 'disabled' }]);
      await service.requestPasswordReset('carer@example.test', '1.2.3.4');
      expect(dbMock.updateSets).toHaveLength(0);
    });

    it('resends invitation for invited account without password', async () => {
      dbMock.setSelectRows([
        {
          ...activeAccount,
          passwordHash: null,
          status: 'invited',
        },
      ]);
      await service.requestPasswordReset('carer@example.test', '1.2.3.4');
      expect(invitations.sendInvitationEmailForForgotPassword).toHaveBeenCalledWith(
        'staff-1',
        'acc-1',
      );
      expect(dbMock.updateSets).toHaveLength(0);
    });

    it('stores hashed reset token with 60-minute expiry and sends email', async () => {
      dbMock.setSelectRows([activeAccount]);
      await service.requestPasswordReset('carer@example.test', '1.2.3.4');

      expect(dbMock.updateSets[0]).toMatchObject({
        passwordResetRequestedAt: expect.any(Date),
      });
      const tokenHash = (dbMock.updateSets[0] as { passwordResetTokenHash: string })
        .passwordResetTokenHash;
      expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);

      const expiresAt = (dbMock.updateSets[0] as AccountRow).passwordResetTokenExpiresAt as Date;
      expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(STAFF_PASSWORD_RESET_TTL_MS);
      expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(STAFF_PASSWORD_RESET_TTL_MS - 5000);

      const transport = email['transport'] as RecordingEmailTransport;
      expect(transport.sent[0]?.subject).toBe('Reset your Intra password');
      expect(transport.sent[0]?.html).toContain('/carer/reset-password/');
      expect(
        audit.record.mock.calls.some(
          ([event]) => event.eventType === STAFF_PORTAL_AUDIT_EVENTS.passwordResetEmailSent,
        ),
      ).toBe(true);
    });

    it('clears reset token when email delivery fails', async () => {
      email.useTransport({
        send: vi.fn().mockRejectedValue(new EmailDeliveryError('Resend unavailable')),
      });
      dbMock.setSelectRows([activeAccount]);
      await service.requestPasswordReset('carer@example.test', '1.2.3.4');

      expect(dbMock.updateSets).toHaveLength(2);
      expect(dbMock.updateSets[1]).toMatchObject({
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        passwordResetRequestedAt: null,
      });
      expect(
        audit.record.mock.calls.some(
          ([event]) => event.eventType === STAFF_PORTAL_AUDIT_EVENTS.passwordResetEmailFailed,
        ),
      ).toBe(true);
    });

    it('does not overwrite invitation token fields', async () => {
      dbMock.setSelectRows([activeAccount]);
      await service.requestPasswordReset('carer@example.test', '1.2.3.4');
      for (const update of dbMock.updateSets) {
        expect(update).not.toHaveProperty('inviteTokenHash');
        expect(update).not.toHaveProperty('inviteTokenExpiresAt');
      }
    });
  });

  describe('validateResetToken', () => {
    it('returns valid for eligible token', async () => {
      const raw = 'valid-reset-token';
      dbMock.setSelectRows([
        {
          ...activeAccount,
          passwordResetTokenHash: hashToken(raw),
          passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
        },
      ]);
      await expect(service.validateResetToken(raw, '1.2.3.4')).resolves.toEqual({ valid: true });
    });

    it('rejects expired token without account details', async () => {
      dbMock.setSelectRows([]);
      await expect(service.validateResetToken('expired', '1.2.3.4')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('resetPassword', () => {
    it('updates password, clears reset token, and invalidates sessions', async () => {
      const raw = 'reset-token-abc';
      dbMock.setReturningRows([
        {
          ...activeAccount,
          passwordResetTokenHash: hashToken(raw),
        },
      ]);

      await service.resetPassword(raw, 'NewPassword12', '1.2.3.4');

      expect(dbMock.updateSets[0]).toMatchObject({
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        passwordResetRequestedAt: null,
      });
      expect(sessions.destroyAllForAccount).toHaveBeenCalledWith('acc-1');
      expect(
        audit.record.mock.calls.some(
          ([event]) => event.eventType === STAFF_PORTAL_AUDIT_EVENTS.passwordResetCompleted,
        ),
      ).toBe(true);
    });

    it('rejects invalid token atomically', async () => {
      dbMock.setReturningRows([]);
      await expect(service.resetPassword('bad-token', 'NewPassword12', '1.2.3.4')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(sessions.destroyAllForAccount).not.toHaveBeenCalled();
    });

    it('enforces password policy', async () => {
      await expect(service.resetPassword('token', 'short', '1.2.3.4')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('allows only one successful reset for the same token', async () => {
      const raw = 'single-use-token';
      dbMock.setReturningRows([{ ...activeAccount, passwordResetTokenHash: hashToken(raw) }]);
      await service.resetPassword(raw, 'NewPassword12', '1.2.3.4');

      dbMock.setReturningRows([]);
      await expect(service.resetPassword(raw, 'AnotherPassword1', '1.2.3.4')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('stores a verifiable password hash', async () => {
      const raw = 'hash-check-token';
      dbMock.setReturningRows([{ ...activeAccount, passwordResetTokenHash: hashToken(raw) }]);
      await service.resetPassword(raw, 'NewPassword12', '1.2.3.4');
      const nextHash = (dbMock.updateSets[0] as { passwordHash: string }).passwordHash;
      expect(await verifyPassword('NewPassword12', nextHash)).toBe(true);
      expect(await verifyPassword('OldPassword12', nextHash)).toBe(false);
    });
  });
});

describe('hashToken', () => {
  it('is deterministic and does not equal raw token', () => {
    const raw = 'super-secret-reset-token';
    const hashed = hashToken(raw);
    expect(hashed).not.toBe(raw);
    expect(hashToken(raw)).toBe(hashed);
  });
});

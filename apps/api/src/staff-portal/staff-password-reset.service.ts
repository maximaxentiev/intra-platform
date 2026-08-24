import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { and, eq, gt, isNotNull, ne } from 'drizzle-orm';
import { assertStrongPassword, hashPassword } from '../auth/password.util';
import { EmailDeliveryError, EmailService } from '../email/email.service';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { staffAccounts } from '../db/schema';
import { hashToken } from './staff-auth.service';
import { buildStaffPasswordResetEmailContent } from './staff-password-reset-email.template';
import { STAFF_PASSWORD_RESET_TTL_MS } from './staff-password-reset.constants';
import { StaffPasswordResetRateLimitService } from './staff-password-reset-rate-limit.service';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from './staff-portal-audit.service';
import { StaffPortalInvitationsService } from './staff-portal-invitations.service';
import { StaffSessionService } from './staff-session.service';

@Injectable()
export class StaffPasswordResetService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly sessions: StaffSessionService,
    private readonly audit: StaffPortalAuditService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly rateLimit: StaffPasswordResetRateLimitService,
    private readonly invitations: StaffPortalInvitationsService,
  ) {}

  /**
   * Always resolves so the endpoint cannot be used to enumerate accounts.
   * Rate limits apply before any account lookup side effects.
   */
  async requestPasswordReset(email: string, clientIp: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.rateLimit.assertForgotPasswordAllowed(clientIp, normalizedEmail);

    const rows = await this.db
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.email, normalizedEmail));
    const account = rows[0];
    if (!account) return;

    if (account.status === 'disabled') return;

    if (!account.passwordHash) {
      await this.invitations.sendInvitationEmailForForgotPassword(account.staffId, account.id);
      return;
    }

    await this.issueAndSendResetToken(account);
  }

  async validateResetToken(token: string, clientIp: string): Promise<{ valid: true }> {
    await this.rateLimit.assertResetAttemptAllowed(clientIp, token);
    const account = await this.findEligibleResetAccount(token);
    if (!account) {
      throw new NotFoundException('This password reset link is invalid or has expired.');
    }
    return { valid: true };
  }

  async resetPassword(token: string, password: string, clientIp: string): Promise<void> {
    await this.rateLimit.assertResetAttemptAllowed(clientIp, token);
    assertStrongPassword(password);

    const tokenHash = hashToken(token);
    const passwordHash = await hashPassword(password);

    const updated = await this.db
      .update(staffAccounts)
      .set({
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        passwordResetRequestedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(staffAccounts.passwordResetTokenHash, tokenHash),
          gt(staffAccounts.passwordResetTokenExpiresAt, new Date()),
          ne(staffAccounts.status, 'disabled'),
          isNotNull(staffAccounts.passwordHash),
        ),
      )
      .returning();

    if (!updated.length) {
      throw new NotFoundException('This password reset link is invalid or has expired.');
    }

    const account = updated[0]!;

    await this.audit.record({
      staffId: account.staffId,
      staffAccountId: account.id,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.passwordResetCompleted,
    });

    try {
      await this.sessions.destroyAllForAccount(account.id);
    } catch (err) {
      await this.audit.record({
        staffId: account.staffId,
        staffAccountId: account.id,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.passwordResetSessionInvalidationFailed,
        detail: {
          reason: err instanceof Error ? err.message.slice(0, 200) : 'destroy_failed',
        },
      });
    }
  }

  private async issueAndSendResetToken(account: typeof staffAccounts.$inferSelect) {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + STAFF_PASSWORD_RESET_TTL_MS);
    const requestedAt = new Date();

    await this.db
      .update(staffAccounts)
      .set({
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExpiresAt: expiresAt,
        passwordResetRequestedAt: requestedAt,
        updatedAt: new Date(),
      })
      .where(eq(staffAccounts.id, account.id));

    await this.audit.record({
      staffId: account.staffId,
      staffAccountId: account.id,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.passwordResetRequested,
    });

    const platformEnv = {
      APP_PUBLIC_URL: this.config.get<string>('APP_PUBLIC_URL'),
      APP_HOST: this.config.get<string>('APP_HOST'),
      LEGACY_APP_HOST: this.config.get<string>('LEGACY_APP_HOST'),
      NODE_ENV: this.config.get<string>('NODE_ENV'),
    };

    const content = buildStaffPasswordResetEmailContent({
      resetToken: rawToken,
      platformEnv,
    });

    try {
      await this.email.send({
        to: account.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.audit.record({
        staffId: account.staffId,
        staffAccountId: account.id,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.passwordResetEmailSent,
      });
    } catch (err) {
      await this.db
        .update(staffAccounts)
        .set({
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
          passwordResetRequestedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(staffAccounts.id, account.id));

      await this.audit.record({
        staffId: account.staffId,
        staffAccountId: account.id,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.passwordResetEmailFailed,
        detail: {
          reason:
            err instanceof EmailDeliveryError ? err.message.slice(0, 200) : 'send_failed',
        },
      });
    }
  }

  private async findEligibleResetAccount(token: string) {
    const rows = await this.db
      .select()
      .from(staffAccounts)
      .where(
        and(
          eq(staffAccounts.passwordResetTokenHash, hashToken(token)),
          gt(staffAccounts.passwordResetTokenExpiresAt, new Date()),
          ne(staffAccounts.status, 'disabled'),
          isNotNull(staffAccounts.passwordHash),
        ),
      );
    return rows[0] ?? null;
  }
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { EmailDeliveryError, EmailService } from '../email/email.service';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { staff, staffAccounts } from '../db/schema';
import { buildStaffInviteEmailContent } from './staff-invite-email.template';
import { normalizeStaffEmail, resolvePortalAccountDisplayStatus } from './portal-account-status.util';
import { StaffAuthService } from './staff-auth.service';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from './staff-portal-audit.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PortalInvitationResult = {
  ok: boolean;
  emailSent: boolean;
  resend: boolean;
  accountStatus: string;
  inviteSentAt: string | null;
  inviteExpiresAt: string | null;
  message?: string;
};

@Injectable()
export class StaffPortalInvitationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly auth: StaffAuthService,
    private readonly email: EmailService,
    private readonly audit: StaffPortalAuditService,
    private readonly config: ConfigService,
  ) {}

  async getPortalAccountForStaff(staffId: string) {
    await this.requireStaff(staffId);
    const account = await this.findAccountByStaffId(staffId);
    return this.toPortalAccountView(account);
  }

  async sendInvitation(
    staffId: string,
    actorUserId: string,
    options: { resend?: boolean } = {},
  ): Promise<PortalInvitationResult> {
    const person = await this.requireStaff(staffId);
    const email = normalizeStaffEmail(person.email);
    if (!email) {
      throw new BadRequestException('Staff member must have an email address before inviting.');
    }

    let account = await this.findAccountByStaffId(staffId);
    if (account?.status === 'disabled') {
      throw new BadRequestException('Portal access is disabled for this staff member.');
    }

    if (!account) {
      await this.assertEmailAvailable(email, staffId);
      const inserted = await this.db
        .insert(staffAccounts)
        .values({
          staffId,
          email,
          status: 'invited',
        })
        .returning();
      account = inserted[0];
      await this.audit.record({
        staffId,
        staffAccountId: account.id,
        actorUserId,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.invitationCreated,
        detail: { email },
      });
    } else {
      if (options.resend) {
        await this.audit.record({
          staffId,
          staffAccountId: account.id,
          actorUserId,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.invitationResent,
          detail: { email },
        });
      }
      if (account.email !== email) {
        await this.assertEmailAvailable(email, staffId);
        await this.db
          .update(staffAccounts)
          .set({ email, updatedAt: new Date() })
          .where(eq(staffAccounts.id, account.id));
        account = { ...account, email };
      }
    }

    const rawToken = await this.auth.issueInviteToken(account.id);
    const refreshed = await this.db
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.id, account.id));
    account = refreshed[0]!;

    const platformEnv = {
      APP_PUBLIC_URL: this.config.get<string>('APP_PUBLIC_URL'),
      APP_HOST: this.config.get<string>('APP_HOST'),
      LEGACY_APP_HOST: this.config.get<string>('LEGACY_APP_HOST'),
      NODE_ENV: this.config.get<string>('NODE_ENV'),
    };

    const content = buildStaffInviteEmailContent({
      legalFirstName: person.legalFirstName,
      inviteToken: rawToken,
      expiresAt: account.inviteTokenExpiresAt ?? new Date(Date.now() + INVITE_TTL_MS),
      platformEnv,
    });

    try {
      await this.email.send({
        to: email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.audit.record({
        staffId,
        staffAccountId: account.id,
        actorUserId,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.invitationEmailSent,
        detail: { email, resend: Boolean(options.resend) },
      });
      return {
        ok: true,
        emailSent: true,
        resend: Boolean(options.resend),
        accountStatus: resolvePortalAccountDisplayStatus(account),
        inviteSentAt: account.inviteSentAt?.toISOString() ?? null,
        inviteExpiresAt: account.inviteTokenExpiresAt?.toISOString() ?? null,
      };
    } catch (err) {
      await this.audit.record({
        staffId,
        staffAccountId: account.id,
        actorUserId,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.invitationEmailFailed,
        detail: {
          email,
          resend: Boolean(options.resend),
          reason: err instanceof EmailDeliveryError ? err.message.slice(0, 200) : 'send_failed',
        },
      });
      return {
        ok: false,
        emailSent: false,
        resend: Boolean(options.resend),
        accountStatus: resolvePortalAccountDisplayStatus(account),
        inviteSentAt: account.inviteSentAt?.toISOString() ?? null,
        inviteExpiresAt: account.inviteTokenExpiresAt?.toISOString() ?? null,
        message:
          err instanceof EmailDeliveryError
            ? err.message
            : 'Invitation was created but the email could not be sent. Use Resend Invitation to retry.',
      };
    }
  }

  /**
   * Re-sends the invitation email for accounts that have not yet set a password.
   * Used by forgot-password when the invitation workflow remains authoritative.
   */
  async sendInvitationEmailForForgotPassword(staffId: string, accountId: string): Promise<void> {
    const person = await this.requireStaff(staffId);
    const account = (
      await this.db.select().from(staffAccounts).where(eq(staffAccounts.id, accountId))
    )[0];
    if (!account || account.passwordHash || account.status === 'disabled') {
      return;
    }

    const rawToken = await this.auth.issueInviteToken(account.id);
    const refreshed = await this.db
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.id, account.id));
    const updatedAccount = refreshed[0]!;

    const platformEnv = {
      APP_PUBLIC_URL: this.config.get<string>('APP_PUBLIC_URL'),
      APP_HOST: this.config.get<string>('APP_HOST'),
      LEGACY_APP_HOST: this.config.get<string>('LEGACY_APP_HOST'),
      NODE_ENV: this.config.get<string>('NODE_ENV'),
    };

    const content = buildStaffInviteEmailContent({
      legalFirstName: person.legalFirstName,
      inviteToken: rawToken,
      expiresAt: updatedAccount.inviteTokenExpiresAt ?? new Date(Date.now() + INVITE_TTL_MS),
      platformEnv,
    });

    try {
      await this.email.send({
        to: updatedAccount.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      await this.audit.record({
        staffId,
        staffAccountId: account.id,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.invitationEmailSent,
        detail: { source: 'forgot_password' },
      });
    } catch (err) {
      await this.audit.record({
        staffId,
        staffAccountId: account.id,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.invitationEmailFailed,
        detail: {
          source: 'forgot_password',
          reason:
            err instanceof EmailDeliveryError ? err.message.slice(0, 200) : 'send_failed',
        },
      });
    }
  }

  async disablePortalAccess(staffId: string, actorUserId: string) {
    const account = await this.requireAccount(staffId);
    await this.db
      .update(staffAccounts)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(staffAccounts.id, account.id));
    await this.audit.record({
      staffId,
      staffAccountId: account.id,
      actorUserId,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.portalDisabled,
    });
    return this.getPortalAccountForStaff(staffId);
  }

  async enablePortalAccess(staffId: string, actorUserId: string) {
    const account = await this.requireAccount(staffId);
    const nextStatus = account.onboardingCompletedAt
      ? 'active'
      : account.passwordHash
        ? 'incomplete'
        : 'invited';
    await this.db
      .update(staffAccounts)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(staffAccounts.id, account.id));
    await this.audit.record({
      staffId,
      staffAccountId: account.id,
      actorUserId,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.portalReEnabled,
      detail: { status: nextStatus },
    });
    return this.getPortalAccountForStaff(staffId);
  }

  private toPortalAccountView(account: typeof staffAccounts.$inferSelect | null) {
    if (!account) {
      return {
        accountStatus: 'no_account' as const,
        email: null,
        inviteSentAt: null,
        inviteExpiresAt: null,
        lastLoginAt: null,
        onboardingCompletedAt: null,
        onboardingStep: null,
      };
    }
    return {
      accountStatus: resolvePortalAccountDisplayStatus(account),
      email: account.email,
      inviteSentAt: account.inviteSentAt?.toISOString() ?? null,
      inviteExpiresAt: account.inviteTokenExpiresAt?.toISOString() ?? null,
      lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
      onboardingCompletedAt: account.onboardingCompletedAt?.toISOString() ?? null,
      onboardingStep: account.onboardingStep,
    };
  }

  private async requireStaff(staffId: string) {
    const rows = await this.db.select().from(staff).where(eq(staff.id, staffId));
    if (!rows[0]) throw new NotFoundException('Staff not found.');
    return rows[0];
  }

  private async requireAccount(staffId: string) {
    const account = await this.findAccountByStaffId(staffId);
    if (!account) throw new BadRequestException('This staff member does not have a portal account.');
    return account;
  }

  private findAccountByStaffId(staffId: string) {
    return this.db
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.staffId, staffId))
      .then((rows) => rows[0] ?? null);
  }

  private async assertEmailAvailable(email: string, staffId: string) {
    const staffRows = await this.db.select().from(staff).where(eq(staff.email, email));
    if (staffRows.some((row) => row.id !== staffId)) {
      throw new ConflictException('Another staff member already uses this email address.');
    }
    const accountRows = await this.db.select().from(staffAccounts).where(eq(staffAccounts.email, email));
    if (accountRows.some((row) => row.staffId !== staffId)) {
      throw new ConflictException('This email is already used by another portal account.');
    }
  }
}

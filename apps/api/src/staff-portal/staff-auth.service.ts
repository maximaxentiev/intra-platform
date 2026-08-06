import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { assertStrongPassword, hashPassword, verifyPassword } from '../auth/password.util';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { staff, staffAccounts } from '../db/schema';
import { StaffSessionService, type StaffSessionPayload } from './staff-session.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DUMMY_HASH = '$2a$12$0000000000000000000000000000000000000000000000000000';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class StaffAuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly sessions: StaffSessionService,
  ) {}

  /** Mints a fresh invite/reset token, stores its hash, returns the raw token. */
  async issueInviteToken(accountId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.db
      .update(staffAccounts)
      .set({
        inviteTokenHash: hashToken(token),
        inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
        inviteSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(staffAccounts.id, accountId));
    return token;
  }

  private async findByToken(token: string) {
    const rows = await this.db
      .select()
      .from(staffAccounts)
      .where(
        and(
          eq(staffAccounts.inviteTokenHash, hashToken(token)),
          gt(staffAccounts.inviteTokenExpiresAt, new Date()),
        ),
      );
    return rows[0] ?? null;
  }

  /** Validates an invite/reset token and returns who it belongs to. */
  async describeInvite(token: string) {
    const account = await this.findByToken(token);
    if (!account) throw new NotFoundException('This link is invalid or has expired.');
    const person = (await this.db.select().from(staff).where(eq(staff.id, account.staffId)))[0];
    return {
      email: account.email,
      legalFirstName: person?.legalFirstName ?? '',
      legalLastName: person?.legalLastName ?? '',
      alreadySetUp: Boolean(account.passwordHash),
    };
  }

  /** Sets the password from an invite/reset link and signs the carer in. */
  async acceptInvite(token: string, password: string) {
    const account = await this.findByToken(token);
    if (!account) throw new NotFoundException('This link is invalid or has expired.');
    assertStrongPassword(password);
    const isFirstSetup = !account.passwordHash;
    await this.db
      .update(staffAccounts)
      .set({
        passwordHash: await hashPassword(password),
        inviteTokenHash: null,
        inviteTokenExpiresAt: null,
        status: isFirstSetup ? 'incomplete' : account.status,
        updatedAt: new Date(),
      })
      .where(eq(staffAccounts.id, account.id));

    return this.startSession({
      id: account.id,
      staffId: account.staffId,
      email: account.email,
    });
  }

  async login(email: string, password: string) {
    const rows = await this.db
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.email, email.trim().toLowerCase()));
    const account = rows[0];
    const ok = await verifyPassword(password, account?.passwordHash ?? DUMMY_HASH);
    if (!account || !account.passwordHash || !ok || account.status === 'disabled') {
      throw new UnauthorizedException('Invalid credentials.');
    }
    await this.db
      .update(staffAccounts)
      .set({ lastLoginAt: new Date() })
      .where(eq(staffAccounts.id, account.id));
    return this.startSession(account);
  }

  private async startSession(account: { id: string; staffId: string; email: string }) {
    const payload: StaffSessionPayload = {
      kind: 'staff',
      accountId: account.id,
      staffId: account.staffId,
      email: account.email,
    };
    const sid = await this.sessions.create(payload);
    return { sid, payload };
  }

  async logout(sid: string) {
    await this.sessions.destroy(sid);
  }

  /** Profile returned to the portal for the signed-in carer. */
  async me(session: StaffSessionPayload) {
    const account = (
      await this.db.select().from(staffAccounts).where(eq(staffAccounts.id, session.accountId))
    )[0];
    if (!account) throw new UnauthorizedException('Not authenticated.');
    const person = (await this.db.select().from(staff).where(eq(staff.id, account.staffId)))[0];
    return {
      accountId: account.id,
      staffId: account.staffId,
      email: account.email,
      status: account.status,
      onboardingStep: account.onboardingStep,
      onboardingCompletedAt: account.onboardingCompletedAt,
      legalFirstName: person?.legalFirstName ?? '',
      legalLastName: person?.legalLastName ?? '',
      phone: person?.phone ?? '',
      address: person?.address ?? '',
      city: person?.city ?? '',
    };
  }

  /**
   * Always resolves so the endpoint cannot be used to enumerate accounts.
   * Raw tokens are never logged; email delivery is Phase 7.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.email, email.trim().toLowerCase()));
    const account = rows[0];
    if (!account) return;
    await this.issueInviteToken(account.id);
  }
}

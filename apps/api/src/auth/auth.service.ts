import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { OPS_TEMPORARY_PASSWORD_TTL_MS } from './ops-password-reset.constants';
import {
  assertStrongPassword,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from './password.util';
import { SessionService, type SessionPayload } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
  ) {}

  async login(email: string, password: string): Promise<{ sid: string; user: SessionPayload }> {
    const user = await this.users.findByEmail(email);
    // Constant-ish response: verify against a dummy hash when user missing.
    const hash = user?.passwordHash ?? '$2a$12$0000000000000000000000000000000000000000000000000000';
    const ok = await verifyPassword(password, hash);
    if (!user || !ok || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    if (user.mustChangePassword && user.temporaryPasswordExpiresAt) {
      if (user.temporaryPasswordExpiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException(
          'This temporary password has expired. Contact an administrator for a new reset.',
        );
      }
    }

    const payload: SessionPayload = { userId: user.id, email: user.email, role: user.role };
    const sid = await this.sessions.create(payload);
    return { sid, user: payload };
  }

  async logout(sid: string): Promise<void> {
    await this.sessions.destroy(sid);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findByIdRaw(userId);
    if (!user) throw new UnauthorizedException();
    if (user.mustChangePassword) {
      throw new BadRequestException('Use the required password change flow.');
    }
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect.');
    assertStrongPassword(newPassword);
    await this.users.setPermanentPassword(userId, newPassword, { actorUserId: userId, forced: false });
  }

  async replaceForcedPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.users.findByIdRaw(userId);
    if (!user) throw new UnauthorizedException();
    if (!user.mustChangePassword) {
      throw new BadRequestException('Password change is not required.');
    }
    assertStrongPassword(newPassword);
    await this.users.setPermanentPassword(userId, newPassword, { actorUserId: userId, forced: true });
  }

  async adminResetPassword(
    targetUserId: string,
    actorUserId: string,
  ): Promise<{ temporaryPassword: string; expiresAt: string }> {
    const target = await this.users.findByIdRaw(targetUserId);
    if (!target) throw new NotFoundException('User not found.');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const expiresAt = new Date(Date.now() + OPS_TEMPORARY_PASSWORD_TTL_MS);

    await this.users.applyAdminPasswordReset({
      userId: targetUserId,
      passwordHash,
      expiresAt,
      actorUserId,
      targetEmail: target.email,
      targetName: target.fullName,
    });

    await this.sessions.destroyAllForUser(targetUserId);

    return { temporaryPassword, expiresAt: expiresAt.toISOString() };
  }

  // Used by bootstrap only.
  hashPassword = hashPassword;
}

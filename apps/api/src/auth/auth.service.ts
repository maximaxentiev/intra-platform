import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { assertStrongPassword, hashPassword, verifyPassword } from './password.util';
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
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect.');
    assertStrongPassword(newPassword);
    await this.users.setPassword(userId, newPassword);
  }

  // Used by bootstrap only.
  hashPassword = hashPassword;
}

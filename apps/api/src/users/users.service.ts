import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { assertStrongPassword, hashPassword } from '../auth/password.util';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { users } from '../db/schema';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService, buildFieldChanges } from '../platform-audit/platform-audit.service';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';
import { toOpsUserProfile, type OpsUserProfile } from './ops-user-profile.util';

function publicUser(u: typeof users.$inferSelect): OpsUserProfile {
  return toOpsUserProfile(u);
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  async findByEmail(email: string) {
    const rows = await this.db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return rows[0] ?? null;
  }

  async findByIdRaw(id: string) {
    const rows = await this.db.select().from(users).where(eq(users.id, id));
    return rows[0] ?? null;
  }

  async getProfile(id: string): Promise<OpsUserProfile> {
    const u = await this.findByIdRaw(id);
    if (!u) throw new NotFoundException('User not found.');
    return publicUser(u);
  }

  async mustChangePassword(userId: string): Promise<boolean> {
    const row = await this.findByIdRaw(userId);
    return row?.mustChangePassword === true;
  }

  async list() {
    const rows = await this.db.select().from(users).orderBy(users.fullName);
    return rows.map(publicUser);
  }

  async invite(dto: InviteUserDto, actorUserId?: string | null) {
    assertStrongPassword(dto.password);
    const email = dto.email.toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('A user with that email already exists.');

    const passwordHash = await hashPassword(dto.password);
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(users)
        .values({
          email,
          fullName: dto.fullName,
          role: dto.role,
          passwordHash,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
        })
        .returning();
      const created = rows[0]!;
      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.userInvited,
          actorType: actorUserId ? 'ops_user' : 'system',
          actorUserId: actorUserId ?? null,
          targetUserId: created.id,
          entityId: created.id,
          metadata: { email: created.email, role: created.role, name: created.fullName },
        },
        tx,
      );
      return publicUser(created);
    });
  }

  async updateProfile(id: string, fullName: string) {
    const rows = await this.db
      .update(users)
      .set({ fullName, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!rows[0]) throw new NotFoundException('User not found.');
    return publicUser(rows[0]);
  }

  async update(id: string, dto: UpdateUserDto, actorUserId: string) {
    const before = await this.findByIdRaw(id);
    if (!before) throw new NotFoundException('User not found.');

    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (dto.fullName !== undefined) patch.fullName = dto.fullName;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    return this.db.transaction(async (tx) => {
      const rows = await tx.update(users).set(patch).where(eq(users.id, id)).returning();
      if (!rows[0]) throw new NotFoundException('User not found.');

      const changes = buildFieldChanges(
        { fullName: before.fullName, role: before.role, isActive: before.isActive },
        { fullName: rows[0].fullName, role: rows[0].role, isActive: rows[0].isActive },
        ['fullName', 'role', 'isActive'],
      );
      if (changes) {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.userUpdated,
            actorType: 'ops_user',
            actorUserId,
            targetUserId: id,
            entityId: id,
            metadata: { changes },
          },
          tx,
        );
      }

      return publicUser(rows[0]);
    });
  }

  /** Sets a permanent password and clears any forced-change state. */
  async setPermanentPassword(
    id: string,
    newPassword: string,
    audit: { actorUserId: string; forced: boolean },
  ) {
    assertStrongPassword(newPassword);
    const before = await this.findByIdRaw(id);
    if (!before) throw new NotFoundException('User not found.');

    const passwordHash = await hashPassword(newPassword);
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(users)
        .set({
          passwordHash,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();
      if (!rows[0]) throw new NotFoundException('User not found.');

      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.userPasswordChanged,
          actorType: 'ops_user',
          actorUserId: audit.actorUserId,
          targetUserId: id,
          entityId: id,
          metadata: {
            email: rows[0].email,
            name: rows[0].fullName,
            forced: audit.forced,
          },
        },
        tx,
      );

      return publicUser(rows[0]);
    });
  }

  async applyAdminPasswordReset(params: {
    userId: string;
    passwordHash: string;
    expiresAt: Date;
    actorUserId: string;
    targetEmail: string;
    targetName: string;
  }) {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(users)
        .set({
          passwordHash: params.passwordHash,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: params.expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, params.userId))
        .returning();
      if (!rows[0]) throw new NotFoundException('User not found.');
      if (!rows[0].mustChangePassword) {
        throw new InternalServerErrorException('Forced password change flag was not persisted.');
      }

      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.userPasswordReset,
          actorType: 'ops_user',
          actorUserId: params.actorUserId,
          targetUserId: params.userId,
          entityId: params.userId,
          metadata: {
            email: params.targetEmail,
            name: params.targetName,
          },
        },
        tx,
      );

      return publicUser(rows[0]);
    });
  }

  /** @deprecated Prefer setPermanentPassword for normal password updates. */
  async setPassword(id: string, newPassword: string) {
    await this.setPermanentPassword(id, newPassword, { actorUserId: id, forced: false });
  }

  async count(): Promise<number> {
    const rows = await this.db.select({ id: users.id }).from(users);
    return rows.length;
  }
}

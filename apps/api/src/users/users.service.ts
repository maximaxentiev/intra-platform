import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { users } from '../db/schema';
import { assertStrongPassword, hashPassword } from '../auth/password.util';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService, buildFieldChanges } from '../platform-audit/platform-audit.service';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';

function publicUser(u: typeof users.$inferSelect) {
  const { passwordHash, ...rest } = u;
  void passwordHash;
  return rest;
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

  async getProfile(id: string) {
    const u = await this.findByIdRaw(id);
    if (!u) throw new NotFoundException('User not found.');
    return publicUser(u);
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
        .values({ email, fullName: dto.fullName, role: dto.role, passwordHash })
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

  async setPassword(id: string, newPassword: string) {
    assertStrongPassword(newPassword);
    const passwordHash = await hashPassword(newPassword);
    await this.db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
  }

  async count(): Promise<number> {
    const rows = await this.db.select({ id: users.id }).from(users);
    return rows.length;
  }
}

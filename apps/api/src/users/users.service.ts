import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { users } from '../db/schema';
import { assertStrongPassword, hashPassword } from '../auth/password.util';
import { InviteUserDto, UpdateUserDto } from './dto/users.dto';

function publicUser(u: typeof users.$inferSelect) {
  const { passwordHash, ...rest } = u;
  void passwordHash;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

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

  async invite(dto: InviteUserDto) {
    assertStrongPassword(dto.password);
    const email = dto.email.toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('A user with that email already exists.');

    const passwordHash = await hashPassword(dto.password);
    const rows = await this.db
      .insert(users)
      .values({ email, fullName: dto.fullName, role: dto.role, passwordHash })
      .returning();
    return publicUser(rows[0]);
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

  async update(id: string, dto: UpdateUserDto) {
    const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (dto.fullName !== undefined) patch.fullName = dto.fullName;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    const rows = await this.db.update(users).set(patch).where(eq(users.id, id)).returning();
    if (!rows[0]) throw new NotFoundException('User not found.');
    return publicUser(rows[0]);
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

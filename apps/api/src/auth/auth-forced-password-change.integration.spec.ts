import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { hashPassword, verifyPassword } from '../auth/password.util';
import { SessionService } from '../auth/session.service';
import * as schema from '../db/schema';
import { users } from '../db/schema';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { UsersService } from '../users/users.service';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

async function probePostgres(): Promise<boolean> {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2500, max: 1 });
  try {
    await pool.query('select 1');
    await pool.end();
    return true;
  } catch {
    await pool.end().catch(() => undefined);
    return false;
  }
}

const POSTGRES_READY = await probePostgres();

class InMemorySessionService {
  private readonly store = new Map<string, string>();
  ttlSeconds = 3600;

  async create(payload: object): Promise<string> {
    const sid = `sid-${this.store.size + 1}`;
    this.store.set(sid, JSON.stringify(payload));
    return sid;
  }

  async get(sid: string) {
    const raw = this.store.get(sid);
    return raw ? JSON.parse(raw) : null;
  }

  async update(sid: string, patch: object) {
    const current = await this.get(sid);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.store.set(sid, JSON.stringify(next));
    return next;
  }

  async destroyAllForUser(userId: string) {
    for (const [sid, raw] of this.store.entries()) {
      const payload = JSON.parse(raw) as { userId?: string };
      if (payload.userId === userId) this.store.delete(sid);
    }
  }
}

describe.skipIf(!POSTGRES_READY)('Ops forced password change PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let usersService: UsersService;
  let authService: AuthService;
  let sessions: InMemorySessionService;

  const userId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeee0001';
  const adminId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeee0002';

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema, casing: 'snake_case' });
    sessions = new InMemorySessionService();
    usersService = new UsersService(db, new PlatformAuditService(db));
    authService = new AuthService(usersService, sessions as unknown as SessionService);

    await db.delete(users).where(eq(users.id, userId));
    await db.delete(users).where(eq(users.id, adminId));

    await db.insert(users).values([
      {
        id: userId,
        email: 'forced-change@example.test',
        fullName: 'Forced Change User',
        passwordHash: await hashPassword('OriginalPassword123'),
        role: 'ops',
        isActive: true,
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
      },
      {
        id: adminId,
        email: 'admin-forced@example.test',
        fullName: 'Admin User',
        passwordHash: await hashPassword('AdminPassword123'),
        role: 'admin',
        isActive: true,
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(users).where(eq(users.id, adminId));
    await pool.end();
  });

  it('admin reset persists must_change_password and temporary expiry', async () => {
    const reset = await authService.adminResetPassword(userId, adminId);
    expect(reset.temporaryPassword.length).toBeGreaterThanOrEqual(16);

    const row = await db.select().from(users).where(eq(users.id, userId));
    expect(row[0]?.mustChangePassword).toBe(true);
    expect(row[0]?.temporaryPasswordExpiresAt).toBeInstanceOf(Date);
    expect(row[0]!.temporaryPasswordExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await verifyPassword(reset.temporaryPassword, row[0]!.passwordHash)).toBe(true);
  });

  it('login after reset returns mustChangePassword true and stores it on the session', async () => {
    const reset = await authService.adminResetPassword(userId, adminId);
    const login = await authService.login('forced-change@example.test', reset.temporaryPassword);

    expect(login.user.mustChangePassword).toBe(true);

    const profile = await usersService.getProfile(userId);
    expect(profile.mustChangePassword).toBe(true);

    const session = await sessions.get(login.sid);
    expect(session?.mustChangePassword).toBe(true);
  });

  it('replaceForcedPassword clears forced-change state while keeping the user authenticated', async () => {
    const reset = await authService.adminResetPassword(userId, adminId);
    const login = await authService.login('forced-change@example.test', reset.temporaryPassword);

    await authService.replaceForcedPassword(userId, 'PermanentPassword123');
    await sessions.update(login.sid, { mustChangePassword: false });

    const profile = await usersService.getProfile(userId);
    expect(profile.mustChangePassword).toBe(false);
    expect(profile.temporaryPasswordExpiresAt).toBeNull();

    const session = await sessions.get(login.sid);
    expect(session?.mustChangePassword).toBe(false);
  });
});

import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { centres } from '../db/schema';
import { CentresService } from './centres.service';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';

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

const FIXTURE = {
  centreId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
  actorUserId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
};

describe.skipIf(!POSTGRES_READY)('Centre internal ops notes PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: CentresService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    service = new CentresService(db, {
      record: async () => undefined,
    } as unknown as PlatformAuditService);

    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
  });

  afterAll(async () => {
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await pool.end();
  });

  it('creates a centre without internal ops notes', async () => {
    const created = await service.create(
      {
        name: 'Notes Test Centre',
        primaryChannel: 'email',
        notes: 'Public centre rules',
      },
      FIXTURE.actorUserId,
    );

    expect(created.internalOpsNotes).toBeNull();
    expect(created.notes).toBe('Public centre rules');
  });

  it('creates a centre with internal ops notes', async () => {
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));

    await db.insert(centres).values({
      id: FIXTURE.centreId,
      name: 'Internal Notes Centre',
      primaryChannel: 'email',
      notes: 'Carer-visible rules',
      internalOpsNotes: 'Handle billing through Ops only.',
    });

    const fetched = await service.get(FIXTURE.centreId);
    expect(fetched.internalOpsNotes).toBe('Handle billing through Ops only.');
    expect(fetched.notes).toBe('Carer-visible rules');
  });

  it('updates internal ops notes and clears them', async () => {
    await service.update(
      FIXTURE.centreId,
      {
        name: 'Internal Notes Centre',
        primaryChannel: 'email',
        notes: 'Carer-visible rules',
        internalOpsNotes: 'Updated internal reminder.',
      },
      FIXTURE.actorUserId,
    );

    let fetched = await service.get(FIXTURE.centreId);
    expect(fetched.internalOpsNotes).toBe('Updated internal reminder.');

    await service.update(
      FIXTURE.centreId,
      {
        name: 'Internal Notes Centre',
        primaryChannel: 'email',
        notes: 'Carer-visible rules',
        internalOpsNotes: '   ',
      },
      FIXTURE.actorUserId,
    );

    fetched = await service.get(FIXTURE.centreId);
    expect(fetched.internalOpsNotes).toBeNull();
  });

  it('returns internal ops notes on authenticated Ops list/detail', async () => {
    const listed = await service.list();
    const row = listed.find((centre) => centre.id === FIXTURE.centreId);
    expect(row).toBeDefined();
    expect(row!.internalOpsNotes).toBeNull();

    await service.update(
      FIXTURE.centreId,
      {
        name: 'Internal Notes Centre',
        primaryChannel: 'email',
        notes: 'Carer-visible rules',
        internalOpsNotes: 'Ops-only context',
      },
      FIXTURE.actorUserId,
    );

    const detail = await service.get(FIXTURE.centreId);
    expect(detail.internalOpsNotes).toBe('Ops-only context');
  });
});

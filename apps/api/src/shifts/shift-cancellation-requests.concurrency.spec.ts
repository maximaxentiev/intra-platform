import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import {
  centres,
  shiftCancellationRequests,
  shifts,
  staff,
  staffAccounts,
  staffPortalAuditEvents,
} from '../db/schema';
import { StaffPortalAuditService } from '../staff-portal/staff-portal-audit.service';
import { ShiftCancellationRequestsService } from './shift-cancellation-requests.service';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

const SHIFT_ID = 'aaaa1111-1111-4111-8111-111111111111';
const CENTRE_ID = 'bbbb2222-2222-4222-8222-222222222222';
const STAFF_ID = 'cccc3333-3333-4333-8333-333333333333';
const ACCOUNT_ID = 'dddd4444-4444-4444-8444-444444444444';

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

describe.runIf(POSTGRES_READY)('ShiftCancellationRequests postgres concurrency', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ShiftCancellationRequestsService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    db = drizzle(pool, { schema, casing: 'snake_case' });

    await db.execute(`
      DO $$ BEGIN
        CREATE TYPE shift_cancellation_request_status AS ENUM ('pending', 'resolved');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS shift_cancellation_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE cascade,
        staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE cascade,
        reason text NOT NULL,
        status shift_cancellation_request_status NOT NULL DEFAULT 'pending',
        requested_at timestamptz NOT NULL DEFAULT now(),
        resolved_at timestamptz,
        resolved_by_user_id uuid,
        resolution_note text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `).catch(() => undefined);

    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS shift_cancellation_requests_one_pending_per_shift_staff_idx
      ON shift_cancellation_requests (shift_id, staff_id)
      WHERE status = 'pending';
    `).catch(() => undefined);

    await db.delete(staffPortalAuditEvents).where(eq(staffPortalAuditEvents.staffId, STAFF_ID));
    await db.delete(shiftCancellationRequests).where(eq(shiftCancellationRequests.shiftId, SHIFT_ID));
    await db.delete(shifts).where(eq(shifts.id, SHIFT_ID));
    await db.delete(staffAccounts).where(eq(staffAccounts.id, ACCOUNT_ID));
    await db.delete(staff).where(eq(staff.id, STAFF_ID));
    await db.delete(centres).where(eq(centres.id, CENTRE_ID));

    await db.insert(centres).values({
      id: CENTRE_ID,
      name: 'Concurrency Centre',
      address: '1 Test St',
      city: 'Toronto',
    });

    await db.insert(staff).values({
      id: STAFF_ID,
      legalName: 'Jane Smith',
      displayName: '',
      useDisplayName: false,
      email: 'jane.concurrency@example.test',
      role: 'ECE',
      status: 'active',
    });

    await db.insert(staffAccounts).values({
      id: ACCOUNT_ID,
      staffId: STAFF_ID,
      email: 'jane.concurrency@example.test',
      passwordHash: 'hash',
      status: 'active',
      onboardingStep: 3,
      profileCompletedAt: new Date(),
      documentsCompletedAt: new Date(),
      availabilityCompletedAt: new Date(),
      onboardingCompletedAt: new Date(),
    });

    await db.insert(shifts).values({
      id: SHIFT_ID,
      centreId: CENTRE_ID,
      shiftDate: '2099-01-15',
      startTime: '08:00:00',
      endTime: '16:00:00',
      roleNeeded: 'ECE',
      status: 'filled',
      assignedStaffId: STAFF_ID,
    });

    service = new ShiftCancellationRequestsService(db, new StaffPortalAuditService(db));
  });

  afterAll(async () => {
    await db.delete(shiftCancellationRequests).where(eq(shiftCancellationRequests.shiftId, SHIFT_ID));
    await db.delete(shifts).where(eq(shifts.id, SHIFT_ID));
    await db.delete(staffAccounts).where(eq(staffAccounts.id, ACCOUNT_ID));
    await db.delete(staff).where(eq(staff.id, STAFF_ID));
    await db.delete(centres).where(eq(centres.id, CENTRE_ID));
    await pool.end();
  });

  it('creates only one pending request under concurrent submission', async () => {
    await db.delete(shiftCancellationRequests).where(eq(shiftCancellationRequests.shiftId, SHIFT_ID));
    await db.delete(staffPortalAuditEvents).where(eq(staffPortalAuditEvents.staffId, STAFF_ID));

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        service.createCarerRequest({
          shiftId: SHIFT_ID,
          staffId: STAFF_ID,
          staffAccountId: ACCOUNT_ID,
          reason: 'Concurrent test reason',
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(8);

    const pending = await db
      .select()
      .from(shiftCancellationRequests)
      .where(eq(shiftCancellationRequests.shiftId, SHIFT_ID));
    expect(pending.filter((r) => r.status === 'pending')).toHaveLength(1);

    const auditRows = await db
      .select()
      .from(staffPortalAuditEvents)
      .where(eq(staffPortalAuditEvents.staffId, STAFF_ID));
    expect(auditRows.filter((r) => r.eventType === 'shift_cancellation_requested')).toHaveLength(1);
  });
});

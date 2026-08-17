import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import {
  centreContacts,
  centres,
  shiftAssignmentNotifications,
  shifts,
  staff,
  users,
} from '../db/schema';
import { EmailService } from '../email/email.service';
import { RecordingEmailTransport } from '../email/email.transport';
import { StaffDocumentShareLifecycleService } from '../staff-documents/staff-document-share-lifecycle.service';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from './shift-assignment-notifications.service';
import { ShiftsService } from './shifts.service';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

const SHIFT_ID = '55555555-5555-4555-8555-555555555551';
const CENTRE_ID = '66666666-6666-4666-8666-666666666661';
const STAFF_ID = '77777777-7777-4777-8777-777777777771';
const OPS_USER_ID = '88888888-8888-4888-8888-888888888881';

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

describe.runIf(POSTGRES_READY)('ShiftsService.assign postgres concurrency', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ShiftsService;
  let email: EmailService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    db = drizzle(pool, { schema, casing: 'snake_case' });

    await pool.query(`
      CREATE TYPE IF NOT EXISTS shift_assignment_notification_recipient_type AS ENUM ('centre', 'carer');
    `).catch(() => undefined);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS shift_assignment_notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE cascade,
        assigned_staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE cascade,
        recipient_type text NOT NULL,
        trigger text NOT NULL,
        status text NOT NULL,
        recipient_email text NOT NULL DEFAULT '',
        provider_id text,
        failure_code text,
        failure_reason text,
        actor_user_id uuid REFERENCES users(id) ON DELETE set null,
        created_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz
      );
    `).catch(() => undefined);

    email = new EmailService({
      get: (key: string) => {
        if (key === 'EMAIL_FROM') return 'Intra Platform <noreply@intra.ca>';
        if (key === 'APP_PUBLIC_URL') return 'https://platform.example';
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      },
    } as ConfigService);
    email.useTransport(new RecordingEmailTransport());

    const shareLifecycle = {
      buildActiveStaffDocumentShareUrl: vi.fn().mockResolvedValue('https://platform.example/documents/test#tok'),
      generateShareLink: vi.fn(),
    } as unknown as StaffDocumentShareLifecycleService;

    const confirmation = new ShiftAssignmentConfirmationService(
      db,
      email,
      {
        get: (key: string) => {
          if (key === 'APP_PUBLIC_URL') return 'https://platform.example';
          if (key === 'NODE_ENV') return 'test';
          return undefined;
        },
      } as ConfigService,
      new ShiftAssignmentNotificationsService(db),
      shareLifecycle,
    );

    service = new ShiftsService(db, confirmation);

    await db.delete(shiftAssignmentNotifications).where(eq(shiftAssignmentNotifications.shiftId, SHIFT_ID));
    await db.delete(shifts).where(eq(shifts.id, SHIFT_ID));
    await db.delete(centreContacts).where(eq(centreContacts.centreId, CENTRE_ID));
    await db.delete(centres).where(eq(centres.id, CENTRE_ID));
    await db.delete(staff).where(eq(staff.id, STAFF_ID));
    await db.delete(users).where(eq(users.id, OPS_USER_ID));

    await db.insert(users).values({
      id: OPS_USER_ID,
      email: 'ops-assign@test.example',
      passwordHash: 'hash',
      fullName: 'Ops Assign',
    });
    await db.insert(staff).values({
      id: STAFF_ID,
      legalName: 'Assign Test',
      legalFirstName: 'Assign',
      legalLastName: 'Test',
      displayName: 'Assign Test',
      email: 'assign-test@example.test',
    });
    await db.insert(centres).values({
      id: CENTRE_ID,
      name: 'Assign Test Centre',
      address: '1 Test Street',
      city: 'Toronto',
    });
    await db.insert(centreContacts).values({
      centreId: CENTRE_ID,
      name: 'Primary',
      email: 'primary@centre.test',
      sortOrder: 0,
    });
    await db.insert(shifts).values({
      id: SHIFT_ID,
      centreId: CENTRE_ID,
      shiftDate: '2026-09-01',
      startTime: '09:00:00',
      endTime: '17:00:00',
      roleNeeded: 'ECE',
      status: 'pending',
    });
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  it('treats concurrent same-staff assigns as a single assignment change', async () => {
    await db
      .update(shifts)
      .set({ assignedStaffId: null, status: 'pending' })
      .where(eq(shifts.id, SHIFT_ID));
    await db.delete(shiftAssignmentNotifications).where(eq(shiftAssignmentNotifications.shiftId, SHIFT_ID));

    const results = await Promise.all([
      service.assign(SHIFT_ID, STAFF_ID, OPS_USER_ID),
      service.assign(SHIFT_ID, STAFF_ID, OPS_USER_ID),
    ]);

    const changed = results.filter((r) => r.assignment.changed);
    const noop = results.filter((r) => r.assignment.alreadyAssigned);

    expect(changed.length).toBe(1);
    expect(noop.length).toBe(1);

    const rows = await db
      .select()
      .from(shiftAssignmentNotifications)
      .where(eq(shiftAssignmentNotifications.shiftId, SHIFT_ID));
    const assignTriggers = rows.filter((row) => row.trigger === 'assign');
    expect(assignTriggers.length).toBeGreaterThan(0);
    expect(assignTriggers.length).toBeLessThanOrEqual(2);
  });
});

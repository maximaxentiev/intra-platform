import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import {
  availability,
  centreContacts,
  centres,
  shiftAssignmentNotifications,
  shifts,
  staff,
  staffAccounts,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
  users,
} from '../db/schema';
import { EmailService } from '../email/email.service';
import { RecordingEmailTransport } from '../email/email.transport';
import { StaffDocumentShareLifecycleService } from '../staff-documents/staff-document-share-lifecycle.service';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from './shift-assignment-notifications.service';
import { ShiftMatchingService } from './shift-matching.service';
import { ShiftsService } from './shifts.service';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

const CENTRE_ID = '66666666-6666-4666-8666-666666666661';
const OPS_USER_ID = '88888888-8888-4888-8888-888888888881';
const STAFF_A = '77777777-7777-4777-8777-777777777771';
const STAFF_B = '77777777-7777-4777-8777-777777777772';
const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOUNT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SHIFT_DATE = '2026-09-01';
const WEEK_START = '2026-08-31';

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

async function seedEligibleStaff(
  db: NodePgDatabase<typeof schema>,
  staffId: string,
  accountId: string,
  email: string,
  role: string,
) {
  await db.delete(staffDocumentSets).where(eq(staffDocumentSets.staffId, staffId));
  await db.delete(staffAccounts).where(eq(staffAccounts.staffId, staffId));
  await db.delete(availability).where(eq(availability.staffId, staffId));
  await db.delete(staff).where(eq(staff.id, staffId));

  await db.insert(staff).values({
    id: staffId,
    legalName: `Staff ${staffId.slice(0, 8)}`,
    legalFirstName: 'Staff',
    legalLastName: 'Test',
    displayName: 'Staff Test',
    email,
    role,
    status: 'active',
  });

  await db.insert(staffAccounts).values({
    id: accountId,
    staffId,
    email,
    status: 'incomplete',
    onboardingCompletedAt: new Date('2026-01-01T12:00:00.000Z'),
  });

  await db.insert(availability).values({
    staffId,
    weekStartDate: WEEK_START,
    dayOfWeek: 1,
    startTime: '07:00:00',
    endTime: '20:00:00',
  });

  const docIdsByStaff: Record<
    string,
    Array<{
      type: 'vulnerable_sector_check' | 'first_aid_cpr' | 'immunizations';
      setId: string;
      submissionId: string;
      fileId: string;
    }>
  > = {
    [STAFF_A]: [
      {
        type: 'vulnerable_sector_check',
        setId: '77777777-7777-4777-8777-777777777781',
        submissionId: '77777777-7777-4777-8777-777777777791',
        fileId: '77777777-7777-4777-8777-7777777777a1',
      },
      {
        type: 'first_aid_cpr',
        setId: '77777777-7777-4777-8777-777777777782',
        submissionId: '77777777-7777-4777-8777-777777777792',
        fileId: '77777777-7777-4777-8777-7777777777a2',
      },
      {
        type: 'immunizations',
        setId: '77777777-7777-4777-8777-777777777783',
        submissionId: '77777777-7777-4777-8777-777777777793',
        fileId: '77777777-7777-4777-8777-7777777777a3',
      },
    ],
    [STAFF_B]: [
      {
        type: 'vulnerable_sector_check',
        setId: '77777777-7777-4777-8777-777777777872',
        submissionId: '77777777-7777-4777-8777-777777777882',
        fileId: '77777777-7777-4777-8777-7777777778b1',
      },
      {
        type: 'first_aid_cpr',
        setId: '77777777-7777-4777-8777-777777777873',
        submissionId: '77777777-7777-4777-8777-777777777883',
        fileId: '77777777-7777-4777-8777-7777777778b2',
      },
      {
        type: 'immunizations',
        setId: '77777777-7777-4777-8777-777777777874',
        submissionId: '77777777-7777-4777-8777-777777777884',
        fileId: '77777777-7777-4777-8777-7777777778b3',
      },
    ],
  };

  const docTypes = docIdsByStaff[staffId] ?? [];

  for (const doc of docTypes) {
    await db.insert(staffDocumentSets).values({
      id: doc.setId,
      staffId,
      documentType: doc.type,
    });

    await db.insert(staffDocumentSubmissions).values({
      id: doc.submissionId,
      documentSetId: doc.setId,
      reviewStatus: 'approved',
      submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      submittedByActorType: 'carer',
      reviewedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: doc.submissionId })
      .where(eq(staffDocumentSets.id, doc.setId));

    await db.insert(staffDocumentFiles).values({
      id: doc.fileId,
      submissionId: doc.submissionId,
      originalFilename: 'doc.pdf',
      contentType: 'application/pdf',
      byteSize: 100,
      storageKey: `test/${doc.submissionId}.pdf`,
    });
  }
}

const POSTGRES_READY = await probePostgres();

describe.runIf(POSTGRES_READY)('Shift matching postgres concurrency', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ShiftsService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
    db = drizzle(pool, { schema, casing: 'snake_case' });

    const email = new EmailService({
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
    } as unknown as StaffDocumentShareLifecycleService;

    const confirmation = new ShiftAssignmentConfirmationService(
      db,
      email,
      { get: () => 'test' } as ConfigService,
      new ShiftAssignmentNotificationsService(db),
      shareLifecycle,
    );

    service = new ShiftsService(db, confirmation, new ShiftMatchingService(db));

    await db.delete(users).where(eq(users.id, OPS_USER_ID));
    await db.insert(users).values({
      id: OPS_USER_ID,
      email: 'ops-matching@test.example',
      passwordHash: 'hash',
      fullName: 'Ops Matching',
    });

    await db.delete(shifts).where(eq(shifts.centreId, CENTRE_ID));
    await db.delete(centreContacts).where(eq(centreContacts.centreId, CENTRE_ID));
    await db
      .insert(centres)
      .values({
        id: CENTRE_ID,
        name: 'Matching Test Centre',
        address: '1 Test Street',
        city: 'Toronto',
      })
      .onConflictDoUpdate({
        target: centres.id,
        set: { name: 'Matching Test Centre', address: '1 Test Street', city: 'Toronto' },
      });
    await db.insert(centreContacts).values({
      centreId: CENTRE_ID,
      name: 'Primary',
      email: 'primary@centre.test',
      sortOrder: 0,
    });

    await seedEligibleStaff(db, STAFF_A, ACCOUNT_A, 'staff-a@example.test', 'ECA');
    await seedEligibleStaff(db, STAFF_B, ACCOUNT_B, 'staff-b@example.test', 'ECA');
  });

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
  });

  beforeEach(async () => {
    await db
      .update(shifts)
      .set({ assignedStaffId: null, status: 'pending' })
      .where(eq(shifts.centreId, CENTRE_ID));
  });

  async function insertShift(id: string, startTime: string, endTime: string) {
    await db.delete(shifts).where(eq(shifts.id, id));
    await db.insert(shifts).values({
      id,
      centreId: CENTRE_ID,
      shiftDate: SHIFT_DATE,
      startTime,
      endTime,
      roleNeeded: 'ECA',
      status: 'pending',
    });
  }

  it('A. allows only one concurrent overlapping assignment for the same staff', async () => {
    const shiftA = '55555555-5555-4555-8555-555555555551';
    const shiftB = '55555555-5555-4555-8555-555555555552';
    await insertShift(shiftA, '09:00:00', '13:00:00');
    await insertShift(shiftB, '11:00:00', '15:00:00');

    const results = await Promise.allSettled([
      service.assign(shiftA, STAFF_A, OPS_USER_ID),
      service.assign(shiftB, STAFF_A, OPS_USER_ID),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  it('B. rejects a second assignment when the 2-hour prior buffer would be violated', async () => {
    const shiftA = '55555555-5555-4555-8555-555555555553';
    const shiftB = '55555555-5555-4555-8555-555555555554';
    await insertShift(shiftA, '09:00:00', '13:00:00');
    await insertShift(shiftB, '14:00:00', '18:00:00');

    await service.assign(shiftA, STAFF_A, OPS_USER_ID);
    await expect(service.assign(shiftB, STAFF_A, OPS_USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('C. allows both assignments with an exact 2-hour gap when eligible', async () => {
    const shiftA = '55555555-5555-4555-8555-555555555555';
    const shiftB = '55555555-5555-4555-8555-555555555556';
    await insertShift(shiftA, '08:00:00', '10:00:00');
    await insertShift(shiftB, '12:00:00', '14:00:00');

    await service.assign(shiftA, STAFF_A, OPS_USER_ID);
    const second = await service.assign(shiftB, STAFF_A, OPS_USER_ID);

    expect(second.assignment.changed).toBe(true);
  });

  it('D. assigns different staff to conflicting shifts independently', async () => {
    const shiftA = '55555555-5555-4555-8555-555555555557';
    const shiftB = '55555555-5555-4555-8555-555555555558';
    await insertShift(shiftA, '09:00:00', '13:00:00');
    await insertShift(shiftB, '11:00:00', '15:00:00');

    const [first, second] = await Promise.all([
      service.assign(shiftA, STAFF_A, OPS_USER_ID),
      service.assign(shiftB, STAFF_B, OPS_USER_ID),
    ]);

    expect(first.assignment.changed).toBe(true);
    expect(second.assignment.changed).toBe(true);
  });
});

describe.runIf(!POSTGRES_READY)('Shift matching postgres concurrency', () => {
  it('skipped — PostgreSQL not available', () => {
    expect(POSTGRES_READY).toBe(false);
  });
});

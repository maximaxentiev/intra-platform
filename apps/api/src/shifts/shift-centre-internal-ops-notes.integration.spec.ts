import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { centres, shifts } from '../db/schema';
import { CentresService } from '../centres/centres.service';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { createMockShiftCancellationService } from './shift-cancellation-test.util';
import { createMockShiftReminderService } from './shift-reminder-test.util';
import { createMockShiftUpdateCommunicationService } from './shift-update-communication-test.util';
import { createMockShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication-test.util';
import { createMockShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-test.util';
import { ShiftsService } from './shifts.service';

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
  centreId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
  actorUserId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
};

function buildShiftsService(db: NodePgDatabase<typeof schema>) {
  return new ShiftsService(
    db,
    {
      sendAssignmentConfirmations: vi.fn(),
    } as unknown as ShiftAssignmentConfirmationService,
    {
      evaluateStaffForShift: vi.fn(),
    } as unknown as ShiftMatchingService,
    createMockShiftReminderService(),
    createMockShiftCancellationService(),
    new PlatformAuditService(db),
    createMockShiftUpdateCommunicationService(),
    createMockShiftManualUnassignCommunicationService(),
    createMockShiftBatchProgressCommunicationService(),
  );
}

describe.skipIf(!POSTGRES_READY)('Shift workspace centre internal ops notes PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let shiftsService: ShiftsService;
  let centresService: CentresService;
  let shiftId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    shiftsService = buildShiftsService(db);
    centresService = new CentresService(db, {
      record: async () => undefined,
    } as unknown as PlatformAuditService);

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centreId));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));

    await db.insert(centres).values({
      id: FIXTURE.centreId,
      name: 'Shift Notes Centre',
      primaryChannel: 'email',
      internalOpsNotes: 'Old synthetic note',
    });

    const created = await shiftsService.create(
      {
        centreId: FIXTURE.centreId,
        shiftDate: '2026-10-01',
        startTime: '09:00',
        endTime: '17:00',
        roleNeeded: 'ECE',
        addedToStaffpoint: false,
        confirmationNotes: 'Room 2',
      },
      FIXTURE.actorUserId,
    );
    shiftId = created.id;
  });

  afterAll(async () => {
    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centreId));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreId));
    await pool.end();
  });

  it('returns live centre internal ops notes on shift detail without copying to the shift row', async () => {
    const initial = await shiftsService.get(shiftId);
    expect(initial.centreInternalOpsNotes).toBe('Old synthetic note');

    const centre = await centresService.get(FIXTURE.centreId);
    await centresService.update(
      FIXTURE.centreId,
      {
        name: centre.name,
        primaryChannel: centre.primaryChannel,
        notes: centre.notes,
        internalOpsNotes: 'New synthetic note',
      },
      FIXTURE.actorUserId,
    );

    const refreshed = await shiftsService.get(shiftId);
    expect(refreshed.centreInternalOpsNotes).toBe('New synthetic note');

    const [shiftRow] = await db
      .select({ confirmationNotes: shifts.shiftConfirmationNotes })
      .from(shifts)
      .where(eq(shifts.id, shiftId));
    expect(shiftRow.confirmationNotes).toBe('Room 2');
  });

  it('returns null centre internal ops notes when the centre field is whitespace-only', async () => {
    const centre = await centresService.get(FIXTURE.centreId);
    await centresService.update(
      FIXTURE.centreId,
      {
        name: centre.name,
        primaryChannel: centre.primaryChannel,
        notes: centre.notes,
        internalOpsNotes: '   ',
      },
      FIXTURE.actorUserId,
    );

    const detail = await shiftsService.get(shiftId);
    expect(detail.centreInternalOpsNotes).toBeNull();
  });
});

describe('Shift workspace centre internal ops notes PostgreSQL integration (environment)', () => {
  it.skipIf(POSTGRES_READY)('skips when PostgreSQL is unavailable locally', () => {
    expect(POSTGRES_READY).toBe(false);
  });
});

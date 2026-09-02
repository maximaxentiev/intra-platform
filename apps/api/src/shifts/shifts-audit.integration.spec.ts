import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import * as schema from '../db/schema';
import {
  centres,
  platformAuditEvents,
  shifts,
  staff,
  users,
} from '../db/schema';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftCancellationService } from './shift-cancellation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { ShiftReminderService } from './shift-reminder.service';
import { createMockShiftReminderService } from './shift-reminder-test.util';
import { createMockShiftCancellationService } from './shift-cancellation-test.util';
import { createMockShiftUpdateCommunicationService } from './shift-update-communication-test.util';
import { createMockShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication-test.util';
import { createMockShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-test.util';
import { assignContactedStaffForIntegration } from './shifts-integration-test.util';
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
  centre: '99999999-9999-4999-8999-999999999901',
  staffA: '99999999-9999-4999-8999-999999999902',
  staffB: '99999999-9999-4999-8999-999999999903',
  opsUser: '99999999-9999-4999-8999-999999999904',
};

function buildService(db: NodePgDatabase<typeof schema>, platformAudit?: PlatformAuditService) {
  const shiftMatching = {
    evaluateStaffForShift: vi.fn().mockResolvedValue({ eligible: true, reasons: [] }),
  } as unknown as ShiftMatchingService;

  return new ShiftsService(
    db,
    {
      sendAssignmentConfirmations: vi.fn().mockResolvedValue({
        centre: { attempted: false, sent: false },
        carer: { attempted: false, sent: false },
      }),
    } as unknown as ShiftAssignmentConfirmationService,
    shiftMatching,
    createMockShiftReminderService(),
    createMockShiftCancellationService(),
    platformAudit ?? new PlatformAuditService(db),
    createMockShiftUpdateCommunicationService(),
    createMockShiftManualUnassignCommunicationService(),
      
    createMockShiftBatchProgressCommunicationService(),
  );
}

describe.skipIf(!POSTGRES_READY)('ShiftsService platform audit integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ShiftsService;
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensurePlatformAuditTable(pool);
    service = buildService(db);

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centre));
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB]));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centre));
    await pool.query(`DELETE FROM users WHERE email = $1`, ['shift-audit-ops@example.test']);
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'shift-audit-ops@example.test',
      fullName: 'Shift Audit Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centre,
      name: 'Shift Audit Centre',
      city: 'Toronto',
      status: 'active',
    });
    await db.insert(staff).values([
      {
        id: FIXTURE.staffA,
        legalName: 'Audit Staff A',
        email: 'audit-a@example.test',
        city: 'Toronto',
        role: 'ECE',
        status: 'active',
      },
      {
        id: FIXTURE.staffB,
        legalName: 'Audit Staff B',
        email: 'audit-b@example.test',
        city: 'Toronto',
        role: 'ECE',
        status: 'active',
      },
    ]);
  });

  afterAll(async () => {
    if (shiftIds.length > 0) {
      await db.delete(platformAuditEvents).where(inArray(platformAuditEvents.shiftId, shiftIds));
      await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    }
    await db.delete(staff).where(inArray(staff.id, [FIXTURE.staffA, FIXTURE.staffB]));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centre));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));
    await pool.end();
  });

  async function auditActionsForShift(shiftId: string): Promise<string[]> {
    const rows = await db
      .select({ action: platformAuditEvents.action })
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.shiftId, shiftId));
    return rows.map((row) => row.action);
  }

  it('records shift_created on create', async () => {
    const created = await service.create(
      {
        centreId: FIXTURE.centre,
        shiftDate: '2026-09-01',
        startTime: '09:00:00',
        endTime: '17:00:00',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(created.id);

    expect(await auditActionsForShift(created.id)).toEqual(['shift_created']);
  });

  it('records shift_updated with changed fields only', async () => {
    const created = await service.create(
      {
        centreId: FIXTURE.centre,
        shiftDate: '2026-09-02',
        startTime: '09:00:00',
        endTime: '17:00:00',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(created.id);

    await service.update(created.id, { startTime: '10:00:00' }, FIXTURE.opsUser);
    const rows = await db
      .select({ action: platformAuditEvents.action, metadata: platformAuditEvents.metadata })
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.shiftId, created.id));

    expect(rows.some((row) => row.action === 'shift_updated')).toBe(true);
    const updated = rows.find((row) => row.action === 'shift_updated');
    expect(updated?.metadata).toEqual(
      expect.objectContaining({
        changes: expect.objectContaining({
          startTime: { from: '09:00:00', to: '10:00:00' },
        }),
      }),
    );
  });

  it('records assign, reassign, and unassign distinctly', async () => {
    const created = await service.create(
      {
        centreId: FIXTURE.centre,
        shiftDate: '2026-09-03',
        startTime: '09:00:00',
        endTime: '17:00:00',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(created.id);

    await assignContactedStaffForIntegration(service, created.id, FIXTURE.staffA, FIXTURE.opsUser);
    await assignContactedStaffForIntegration(service, created.id, FIXTURE.staffB, FIXTURE.opsUser);
    await service.unassign(created.id, FIXTURE.opsUser);

    const actions = await auditActionsForShift(created.id);
    expect(actions).toContain('shift_assigned');
    expect(actions).toContain('shift_reassigned');
    expect(actions).toContain('shift_unassigned');
  });

  it('records shift_cancelled and shift_completed_manual', async () => {
    const created = await service.create(
      {
        centreId: FIXTURE.centre,
        shiftDate: '2026-09-04',
        startTime: '09:00:00',
        endTime: '17:00:00',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(created.id);
    await assignContactedStaffForIntegration(service, created.id, FIXTURE.staffA, FIXTURE.opsUser);

    await service.changeStatus(
      created.id,
      { status: 'cancelled', cancellationReason: 'Centre closed for maintenance' },
      FIXTURE.opsUser,
    );

    const completedShift = await service.create(
      {
        centreId: FIXTURE.centre,
        shiftDate: '2026-09-05',
        startTime: '09:00:00',
        endTime: '17:00:00',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(completedShift.id);
    await assignContactedStaffForIntegration(
      service,
      completedShift.id,
      FIXTURE.staffA,
      FIXTURE.opsUser,
    );
    await service.changeStatus(completedShift.id, { status: 'completed' }, FIXTURE.opsUser);

    expect(await auditActionsForShift(created.id)).toContain('shift_cancelled');
    expect(await auditActionsForShift(completedShift.id)).toContain('shift_completed_manual');
  });

  it('rolls back the business mutation when audit insert fails', async () => {
    const failingAudit = {
      record: vi.fn().mockRejectedValue(new Error('audit insert failed')),
    } as unknown as PlatformAuditService;
    const rollbackService = buildService(db, failingAudit);

    await expect(
      rollbackService.create(
        {
          centreId: FIXTURE.centre,
          shiftDate: '2026-09-06',
          startTime: '09:00:00',
          endTime: '17:00:00',
        },
        FIXTURE.opsUser,
      ),
    ).rejects.toThrow('audit insert failed');

    const orphanRows = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.shiftDate, '2026-09-06'));
    expect(orphanRows).toHaveLength(0);
  });
});

import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureCommunicationsTables } from '../automated-communications/test-communications-schema.util';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import * as schema from '../db/schema';
import {
  centres,
  communicationDeliveries,
  platformAuditEvents,
  scheduledCommunications,
  shiftAssignmentNotifications,
  shiftComments,
  shifts,
  staff,
  staffPortalAuditEvents,
  users,
} from '../db/schema';
import { ReportsActivityService } from './reports-activity.service';
import { ReportsService } from './reports.service';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsStaffService } from './reports-staff.service';
import { ReportsDocumentsService } from './reports-documents.service';
import { ReportsExportService } from './reports-export.service';

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

function csvDataRowCount(content: string): number {
  const lines = content.replace(/^\uFEFF/, '').trimEnd().split('\n');
  return Math.max(0, lines.length - 1);
}

const ACTIVITY_FIXTURE_RANGE = {
  dateFrom: '2026-08-10',
  dateTo: '2026-08-12',
};

const FIXTURE = {
  centre: 'ffffffff-ffff-4fff-8fff-ffffffffff01',
  staff: 'ffffffff-ffff-4fff-8fff-ffffffffff02',
  opsUser: 'ffffffff-ffff-4fff-8fff-ffffffffff03',
  shiftLegacy: 'ffffffff-ffff-4fff-8fff-ffffffffff04',
  shiftAudited: 'ffffffff-ffff-4fff-8fff-ffffffffff05',
  portalEvent: 'ffffffff-ffff-4fff-8fff-ffffffffff06',
  assignNotify: 'ffffffff-ffff-4fff-8fff-ffffffffff07',
  commSchedule: 'ffffffff-ffff-4fff-8fff-ffffffffff08',
  commDelivery: 'ffffffff-ffff-4fff-8fff-ffffffffff09',
  platformEvent: 'ffffffff-ffff-4fff-8fff-ffffffffff10',
  shiftComment: 'ffffffff-ffff-4fff-8fff-ffffffffff11',
};

describe.skipIf(!POSTGRES_READY)('Reports activity PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ReportsActivityService;
  let exportService: ReportsExportService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensureCommunicationsTables(pool);
    await ensurePlatformAuditTable(pool);
    service = new ReportsActivityService(db);
    const reportsService = new ReportsService(db);
    exportService = new ReportsExportService(
      new ReportsShiftService(db, reportsService),
      new ReportsStaffService(db, reportsService),
      new ReportsDocumentsService(db, reportsService),
      service,
    );

    await db.delete(shiftComments).where(eq(shiftComments.id, FIXTURE.shiftComment));
    await db.delete(communicationDeliveries).where(eq(communicationDeliveries.id, FIXTURE.commDelivery));
    await db
      .delete(scheduledCommunications)
      .where(eq(scheduledCommunications.id, FIXTURE.commSchedule));
    await db
      .delete(shiftAssignmentNotifications)
      .where(eq(shiftAssignmentNotifications.id, FIXTURE.assignNotify));
    await db
      .delete(staffPortalAuditEvents)
      .where(eq(staffPortalAuditEvents.id, FIXTURE.portalEvent));
    await db.delete(platformAuditEvents).where(eq(platformAuditEvents.id, FIXTURE.platformEvent));
    await db.delete(shifts).where(inArray(shifts.id, [FIXTURE.shiftLegacy, FIXTURE.shiftAudited]));
    await db.delete(staff).where(eq(staff.id, FIXTURE.staff));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centre));
    await pool.query(`DELETE FROM users WHERE email = $1`, ['ops-activity@example.test']);
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'ops-activity@example.test',
      fullName: 'Ops Activity User',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centre,
      name: 'Activity Test Centre',
      city: 'Toronto',
      status: 'active',
    });
    await db.insert(staff).values({
      id: FIXTURE.staff,
      legalName: 'Activity Test Staff',
      email: 'activity-staff@example.test',
      city: 'Toronto',
      role: 'ECE',
      status: 'active',
    });

    await db.insert(shifts).values([
      {
        id: FIXTURE.shiftLegacy,
        centreId: FIXTURE.centre,
        shiftDate: '2026-08-10',
        startTime: '09:00:00',
        endTime: '17:00:00',
        status: 'filled',
        assignedStaffId: FIXTURE.staff,
        createdAt: new Date('2026-08-10T14:00:00.000Z'),
        updatedAt: new Date('2026-08-20T14:00:00.000Z'),
      },
      {
        id: FIXTURE.shiftAudited,
        centreId: FIXTURE.centre,
        shiftDate: '2026-08-12',
        startTime: '09:00:00',
        endTime: '17:00:00',
        status: 'filled',
        assignedStaffId: FIXTURE.staff,
        createdAt: new Date('2026-08-12T14:00:00.000Z'),
        updatedAt: new Date('2026-08-12T14:00:00.000Z'),
      },
    ]);

    await db.insert(platformAuditEvents).values({
      id: FIXTURE.platformEvent,
      occurredAt: new Date('2026-08-12T15:00:00.000Z'),
      actorType: 'ops_user',
      actorUserId: FIXTURE.opsUser,
      action: 'shift_created',
      entityType: 'shift',
      entityId: FIXTURE.shiftAudited,
      shiftId: FIXTURE.shiftAudited,
      centreId: FIXTURE.centre,
      staffId: FIXTURE.staff,
      metadata: { shiftDate: '2026-08-12' },
    });

    await db.insert(staffPortalAuditEvents).values({
      id: FIXTURE.portalEvent,
      staffId: FIXTURE.staff,
      actorUserId: FIXTURE.opsUser,
      eventType: 'ops_document_approved',
      detail: { documentType: 'first_aid_cpr' },
      createdAt: new Date('2026-08-11T12:00:00.000Z'),
    });

    await db.insert(shiftAssignmentNotifications).values({
      id: FIXTURE.assignNotify,
      shiftId: FIXTURE.shiftLegacy,
      assignedStaffId: FIXTURE.staff,
      recipientType: 'carer',
      trigger: 'assign',
      status: 'sent',
      actorUserId: FIXTURE.opsUser,
      createdAt: new Date('2026-08-10T16:00:00.000Z'),
      sentAt: new Date('2026-08-10T16:05:00.000Z'),
    });

    await db.insert(scheduledCommunications).values({
      id: FIXTURE.commSchedule,
      idempotencyKey: `activity-test-${FIXTURE.commSchedule}`,
      communicationType: 'document_expiry_7d',
      entityType: 'staff_document',
      entityId: FIXTURE.staff,
      recipientType: 'staff',
      recipientEntityId: FIXTURE.staff,
      scheduledFor: new Date('2026-08-11T08:00:00.000Z'),
      status: 'sent',
    });
    await db.insert(communicationDeliveries).values({
      id: FIXTURE.commDelivery,
      scheduledCommunicationId: FIXTURE.commSchedule,
      idempotencyKey: `activity-delivery-${FIXTURE.commDelivery}`,
      attemptNumber: 1,
      status: 'sent',
      attemptedAt: new Date('2026-08-11T08:01:00.000Z'),
      sentAt: new Date('2026-08-11T08:01:00.000Z'),
    });

    await db.insert(shiftComments).values({
      id: FIXTURE.shiftComment,
      shiftId: FIXTURE.shiftLegacy,
      authorId: FIXTURE.opsUser,
      body: 'This comment must not appear in activity log.',
      createdAt: new Date('2026-08-10T18:00:00.000Z'),
    });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('returns mixed-source events newest first with truthful legacy shift creation only', async () => {
    const result = await service.getActivityLog({
      dateFrom: '2026-08-10',
      dateTo: '2026-08-12',
      pageSize: 100,
    });

    const ids = result.items.map((item) => item.id);
    expect(ids).toContain(`platform:${FIXTURE.platformEvent}`);
    expect(ids).toContain(`portal:${FIXTURE.portalEvent}`);
    expect(ids).toContain(`assign_notify:${FIXTURE.assignNotify}`);
    expect(ids).toContain(`comm_delivery:${FIXTURE.commDelivery}`);
    expect(ids).toContain(`legacy_shift:${FIXTURE.shiftLegacy}`);
    expect(ids).not.toContain(`legacy_shift:${FIXTURE.shiftAudited}`);
    expect(ids.some((id) => id.includes('shift_comment'))).toBe(false);

    for (let index = 0; index < result.items.length - 1; index += 1) {
      const current = new Date(result.items[index]!.occurredAt).getTime();
      const next = new Date(result.items[index + 1]!.occurredAt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it('does not invent update or assignment events from updated_at alone', async () => {
    const result = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      shiftId: FIXTURE.shiftLegacy,
    });

    const actions = result.items.map((item) => item.action);
    expect(actions).not.toContain('shift_updated');
    expect(actions).not.toContain('shift_assigned');
    expect(actions).not.toContain('shift_reassigned');
  });

  it('filters by category before pagination', async () => {
    const documents = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      category: 'documents',
    });
    expect(documents.totalCount).toBeGreaterThan(0);
    expect(documents.items.every((item) => item.category === 'documents')).toBe(true);

    const communications = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      category: 'communications',
    });
    expect(communications.items.every((item) => item.category === 'communications')).toBe(true);
    expect(communications.totalCount).toBeGreaterThan(0);
  });

  it('filters by staff and centre relationships', async () => {
    const staffScoped = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      staffId: FIXTURE.staff,
    });
    expect(staffScoped.totalCount).toBeGreaterThan(0);
    expect(staffScoped.items.every((item) => item.staff?.id === FIXTURE.staff)).toBe(true);

    const centreScoped = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      centreId: FIXTURE.centre,
    });
    expect(centreScoped.totalCount).toBeGreaterThan(0);
    expect(centreScoped.items.every((item) => item.centre?.id === FIXTURE.centre)).toBe(true);
  });

  it('shows unknown actor for legacy shift record creation', async () => {
    const result = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      shiftId: FIXTURE.shiftLegacy,
    });
    const legacy = result.items.find((item) => item.action === 'shift_record_created');
    expect(legacy?.actor.type).toBe('unknown');
    expect(legacy?.actor.name).toBe('Unknown');
  });

  it('defaults to the last 30 Toronto calendar days', async () => {
    const result = await service.getActivityLog({});
    expect(result.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('defaults to pageSize 10 when omitted', async () => {
    const result = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
    });
    expect(result.pageSize).toBe(10);
    expect(result.page).toBe(1);
  });

  it('accepts pageSize 25 and 50', async () => {
    const page25 = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      pageSize: 25,
    });
    expect(page25.pageSize).toBe(25);

    const page50 = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      pageSize: 50,
    });
    expect(page50.pageSize).toBe(50);
  });

  it('returns correct page 2 slice with pageSize 10', async () => {
    const page1 = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      pageSize: 10,
      page: 1,
    });
    const page2 = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      pageSize: 10,
      page: 2,
    });

    expect(page1.totalCount).toBe(page2.totalCount);
    expect(page1.items.length).toBeLessThanOrEqual(10);
    if (page1.totalCount > 10) {
      expect(page2.items.length).toBeGreaterThan(0);
      expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id);
    }
  });

  it('applies category filter before pagination', async () => {
    const all = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      pageSize: 100,
    });
    const documents = await service.getActivityLog({
      ...ACTIVITY_FIXTURE_RANGE,
      category: 'documents',
      pageSize: 100,
    });
    expect(documents.totalCount).toBeLessThanOrEqual(all.totalCount);
    expect(documents.items.every((item) => item.category === 'documents')).toBe(true);
  });

  describe('CSV export', () => {
    it('activity log export matches filtered totalCount and ignores pagination', async () => {
      const query = {
        ...ACTIVITY_FIXTURE_RANGE,
        category: 'documents' as const,
        page: 2,
        pageSize: 1,
      };
      const json = await service.getActivityLog(query);
      const csv = await exportService.exportActivityLog(query);

      expect(csv.rowCount).toBe(json.totalCount);
      expect(csvDataRowCount(csv.content)).toBe(json.totalCount);
      expect(csv.filename).toBe('activity-log-2026-08-10-to-2026-08-12.csv');
      expect(csv.content).toContain('Timestamp,Category,Action,Activity');
      expect(csv.content).not.toContain('metadata');
    });
  });
});

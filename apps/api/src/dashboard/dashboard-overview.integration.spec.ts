import { and, eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureCommunicationsTables } from '../automated-communications/test-communications-schema.util';
import * as schema from '../db/schema';
import {
  centres,
  communicationDeliveries,
  platformAuditEvents,
  scheduledCommunications,
  shiftAssignmentNotifications,
  shifts,
  staff,
  staffAccounts,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import { ReportsActivityService } from '../reports/reports-activity.service';
import { ReportsDocumentsService } from '../reports/reports-documents.service';
import { ReportsService } from '../reports/reports.service';
import { DashboardOverviewService } from './dashboard-overview.service';
import type { StaffDocumentType } from '../staff-documents/staff-document.constants';

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
  centreA: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
  centreB: 'dddddddd-dddd-4ddd-8ddd-dddddddddd02',
  staffAssigned: 'dddddddd-dddd-4ddd-8ddd-dddddddddd11',
  staffPortalActive: 'dddddddd-dddd-4ddd-8ddd-dddddddddd12',
  staffNoAccount: 'dddddddd-dddd-4ddd-8ddd-dddddddddd13',
  staffInvited: 'dddddddd-dddd-4ddd-8ddd-dddddddddd14',
  staffIncomplete: 'dddddddd-dddd-4ddd-8ddd-dddddddddd15',
  staffDisabled: 'dddddddd-dddd-4ddd-8ddd-dddddddddd16',
  staffInactive: 'dddddddd-dddd-4ddd-8ddd-dddddddddd17',
  staffDocPending: 'dddddddd-dddd-4ddd-8ddd-dddddddddd18',
  today: '2026-08-21',
  tomorrow: '2026-08-22',
  dayPlus7: '2026-08-28',
  dayPlus8: '2026-08-29',
  yesterday: '2026-08-20',
  fixedNow: new Date('2026-08-21T16:00:00.000Z'),
};

const FIXTURE_SHIFT_IDS: string[] = [];

async function insertApprovedCategory(
  db: NodePgDatabase<typeof schema>,
  staffId: string,
  documentType: StaffDocumentType,
) {
  const [set] = await db
    .insert(staffDocumentSets)
    .values({ staffId, documentType, remindersEnabled: true })
    .returning();
  const [submission] = await db
    .insert(staffDocumentSubmissions)
    .values({
      documentSetId: set.id,
      reviewStatus: 'approved',
      processedDate: documentType === 'vulnerable_sector_check' ? '2025-08-01' : null,
      expiryDate: documentType === 'first_aid_cpr' ? '2027-01-01' : null,
      submittedAt: new Date('2026-01-01T10:00:00.000Z'),
      submittedByActorType: 'ops_user',
    })
    .returning();
  await db
    .update(staffDocumentSets)
    .set({ currentSubmissionId: submission.id })
    .where(eq(staffDocumentSets.id, set.id));
  await db.insert(staffDocumentFiles).values({
    submissionId: submission.id,
    storageKey: `${staffId}/${documentType}.pdf`,
    originalFilename: `${documentType}.pdf`,
    contentType: 'application/pdf',
    byteSize: 100,
  });
}

describe.skipIf(!POSTGRES_READY)('Dashboard overview PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: DashboardOverviewService;
  let documentsReport: ReportsDocumentsService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 6 });
    db = drizzle(pool, { schema });
    await ensureCommunicationsTables(pool);

    const reportsService = new ReportsService(db);
    documentsReport = new ReportsDocumentsService(db, reportsService);
    service = new DashboardOverviewService(
      db,
      documentsReport,
      new ReportsActivityService(db),
    );

    await db.insert(centres).values([
      { id: FIXTURE.centreA, name: 'Alpha Centre', city: 'Toronto' },
      { id: FIXTURE.centreB, name: 'Beta Centre', city: 'Toronto' },
    ]);

    await db.insert(staff).values([
      {
        id: FIXTURE.staffAssigned,
        legalName: 'Assigned Staff',
        legalFirstName: 'Assigned',
        legalLastName: 'Staff',
        email: 'assigned@example.com',
        role: 'ECE',
        status: 'active',
      },
      {
        id: FIXTURE.staffPortalActive,
        legalName: 'Portal Active',
        legalFirstName: 'Portal',
        legalLastName: 'Active',
        email: 'portal-active@example.com',
        role: 'ECE',
        status: 'active',
      },
      {
        id: FIXTURE.staffNoAccount,
        legalName: 'No Account',
        legalFirstName: 'No',
        legalLastName: 'Account',
        email: 'no-account@example.com',
        role: 'ECA',
        status: 'active',
      },
      {
        id: FIXTURE.staffInvited,
        legalName: 'Invited Staff',
        legalFirstName: 'Invited',
        legalLastName: 'Staff',
        email: 'invited@example.com',
        role: 'ECA',
        status: 'active',
      },
      {
        id: FIXTURE.staffIncomplete,
        legalName: 'Incomplete Staff',
        legalFirstName: 'Incomplete',
        legalLastName: 'Staff',
        email: 'incomplete@example.com',
        role: 'ECE',
        status: 'active',
      },
      {
        id: FIXTURE.staffDisabled,
        legalName: 'Disabled Staff',
        legalFirstName: 'Disabled',
        legalLastName: 'Staff',
        email: 'disabled@example.com',
        role: 'ECA',
        status: 'active',
      },
      {
        id: FIXTURE.staffInactive,
        legalName: 'Inactive Staff',
        legalFirstName: 'Inactive',
        legalLastName: 'Staff',
        email: 'inactive@example.com',
        role: 'ECA',
        status: 'inactive',
      },
      {
        id: FIXTURE.staffDocPending,
        legalName: 'Doc Pending',
        legalFirstName: 'Doc',
        legalLastName: 'Pending',
        email: 'doc-pending@example.com',
        role: 'ECE',
        status: 'active',
      },
    ]);

    await db.insert(staffAccounts).values([
      {
        staffId: FIXTURE.staffPortalActive,
        email: 'portal-active@example.com',
        passwordHash: 'hash',
        status: 'active',
        onboardingCompletedAt: new Date('2026-01-01'),
      },
      {
        staffId: FIXTURE.staffInvited,
        email: 'invited@example.com',
        status: 'invited',
      },
      {
        staffId: FIXTURE.staffIncomplete,
        email: 'incomplete@example.com',
        passwordHash: 'hash',
        status: 'active',
      },
      {
        staffId: FIXTURE.staffDisabled,
        email: 'disabled@example.com',
        passwordHash: 'hash',
        status: 'disabled',
      },
    ]);

    for (const staffId of [FIXTURE.staffPortalActive, FIXTURE.staffAssigned, FIXTURE.staffNoAccount]) {
      for (const type of ['vulnerable_sector_check', 'first_aid_cpr', 'immunizations'] as const) {
        await insertApprovedCategory(db, staffId, type);
      }
    }

    const [pendingSet] = await db
      .insert(staffDocumentSets)
      .values({ staffId: FIXTURE.staffDocPending, documentType: 'vulnerable_sector_check' })
      .returning();
    const [pendingSubmission] = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: pendingSet.id,
        reviewStatus: 'pending_review',
        submittedAt: new Date('2026-01-01T10:00:00.000Z'),
        submittedByActorType: 'carer',
      })
      .returning();
    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: pendingSubmission.id })
      .where(eq(staffDocumentSets.id, pendingSet.id));
    await db.insert(staffDocumentFiles).values({
      submissionId: pendingSubmission.id,
      storageKey: 'pending/vsc.pdf',
      originalFilename: 'vsc.pdf',
      contentType: 'application/pdf',
      byteSize: 100,
    });

    const shiftRows = [
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
        centreId: FIXTURE.centreB,
        shiftDate: FIXTURE.today,
        startTime: '09:00:00',
        endTime: '12:00:00',
        status: 'pending' as const,
        roleNeeded: 'ECE',
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.today,
        startTime: '10:00:00',
        endTime: '13:00:00',
        status: 'filled' as const,
        assignedStaffId: FIXTURE.staffAssigned,
        roleNeeded: 'ECE',
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.today,
        startTime: '14:00:00',
        endTime: '17:00:00',
        status: 'completed' as const,
        assignedStaffId: FIXTURE.staffAssigned,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.today,
        startTime: '18:00:00',
        endTime: '20:00:00',
        status: 'cancelled' as const,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee05',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.today,
        startTime: '19:00:00',
        endTime: '21:00:00',
        status: 'pending' as const,
        roleNeeded: 'ECA',
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee06',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.tomorrow,
        startTime: '08:00:00',
        endTime: '11:00:00',
        status: 'pending' as const,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee07',
        centreId: FIXTURE.centreB,
        shiftDate: FIXTURE.tomorrow,
        startTime: '15:00:00',
        endTime: '18:00:00',
        status: 'pending' as const,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee08',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.dayPlus7,
        startTime: '09:00:00',
        endTime: '12:00:00',
        status: 'pending' as const,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee09',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.dayPlus8,
        startTime: '09:00:00',
        endTime: '12:00:00',
        status: 'pending' as const,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.yesterday,
        startTime: '09:00:00',
        endTime: '12:00:00',
        status: 'pending' as const,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.tomorrow,
        startTime: '09:00:00',
        endTime: '12:00:00',
        status: 'filled' as const,
        assignedStaffId: FIXTURE.staffAssigned,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12',
        centreId: FIXTURE.centreB,
        shiftDate: FIXTURE.tomorrow,
        startTime: '10:00:00',
        endTime: '13:00:00',
        status: 'completed' as const,
        assignedStaffId: FIXTURE.staffAssigned,
      },
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee13',
        centreId: FIXTURE.centreA,
        shiftDate: FIXTURE.tomorrow,
        startTime: '11:00:00',
        endTime: '14:00:00',
        status: 'cancelled' as const,
      },
    ];

    for (const row of shiftRows) {
      FIXTURE_SHIFT_IDS.push(row.id);
    }
    await db.insert(shifts).values(shiftRows);

    const filledToday = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02';
    const recentAssignmentFailureAt = new Date('2026-08-21T10:00:00.000Z');
    const oldAssignmentFailureAt = new Date('2026-08-19T12:00:00.000Z');
    const boundaryAssignmentFailureAt = new Date('2026-08-20T16:00:00.000Z');
    const beforeBoundaryAssignmentFailureAt = new Date('2026-08-20T15:59:59.999Z');

    await db.insert(shiftAssignmentNotifications).values([
      {
        shiftId: filledToday,
        assignedStaffId: FIXTURE.staffAssigned,
        recipientType: 'centre',
        recipientEmail: 'centre-recent@example.com',
        trigger: 'assign',
        status: 'failed',
        createdAt: recentAssignmentFailureAt,
      },
      {
        shiftId: filledToday,
        assignedStaffId: FIXTURE.staffAssigned,
        recipientType: 'centre',
        recipientEmail: 'centre-old@example.com',
        trigger: 'assign',
        status: 'failed',
        createdAt: oldAssignmentFailureAt,
      },
      {
        shiftId: filledToday,
        assignedStaffId: FIXTURE.staffAssigned,
        recipientType: 'centre',
        recipientEmail: 'centre-boundary@example.com',
        trigger: 'assign',
        status: 'failed',
        createdAt: boundaryAssignmentFailureAt,
      },
      {
        shiftId: filledToday,
        assignedStaffId: FIXTURE.staffAssigned,
        recipientType: 'centre',
        recipientEmail: 'centre-before-boundary@example.com',
        trigger: 'assign',
        status: 'failed',
        createdAt: beforeBoundaryAssignmentFailureAt,
      },
      {
        shiftId: filledToday,
        assignedStaffId: FIXTURE.staffAssigned,
        recipientType: 'carer',
        recipientEmail: 'carer@example.com',
        trigger: 'assign',
        status: 'sent',
        sentAt: new Date('2026-08-21T12:00:00.000Z'),
        createdAt: new Date('2026-08-21T12:00:00.000Z'),
      },
    ]);

    const recentAutomatedFailureAt = new Date('2026-08-21T12:00:00.000Z');
    const oldAutomatedFailureAt = new Date('2026-08-19T12:00:00.000Z');

    const [recentFailedComm] = await db
      .insert(scheduledCommunications)
      .values({
        idempotencyKey: 'dashboard-test-failed-comm-recent',
        communicationType: 'shift_reminder_1d',
        entityType: 'shift',
        entityId: filledToday,
        recipientType: 'carer',
        recipientEntityId: FIXTURE.staffAssigned,
        scheduledFor: new Date('2026-08-20T12:00:00.000Z'),
        status: 'failed',
        attempts: 5,
        updatedAt: recentAutomatedFailureAt,
        createdAt: recentAutomatedFailureAt,
      })
      .returning();

    await db.insert(scheduledCommunications).values({
      idempotencyKey: 'dashboard-test-failed-comm-old',
      communicationType: 'shift_reminder_2h',
      entityType: 'shift',
      entityId: filledToday,
      recipientType: 'carer',
      recipientEntityId: FIXTURE.staffAssigned,
      scheduledFor: new Date('2026-08-18T12:00:00.000Z'),
      status: 'failed',
      attempts: 5,
      updatedAt: oldAutomatedFailureAt,
      createdAt: oldAutomatedFailureAt,
    });

    const [retrySucceededComm] = await db
      .insert(scheduledCommunications)
      .values({
        idempotencyKey: 'dashboard-test-retry-succeeded',
        communicationType: 'shift_reminder_3d',
        entityType: 'shift',
        entityId: filledToday,
        recipientType: 'carer',
        recipientEntityId: FIXTURE.staffAssigned,
        scheduledFor: new Date('2026-08-19T12:00:00.000Z'),
        status: 'sent',
        attempts: 2,
      })
      .returning();

    await db.insert(communicationDeliveries).values([
      {
        scheduledCommunicationId: retrySucceededComm.id,
        idempotencyKey: 'dashboard-test-retry-succeeded-1',
        attemptNumber: 1,
        recipientEmail: 'carer@example.com',
        status: 'failed',
        attemptedAt: new Date('2026-08-19T12:00:00.000Z'),
      },
      {
        scheduledCommunicationId: retrySucceededComm.id,
        idempotencyKey: 'dashboard-test-retry-succeeded-2',
        attemptNumber: 2,
        recipientEmail: 'carer@example.com',
        status: 'sent',
        attemptedAt: new Date('2026-08-19T12:05:00.000Z'),
        sentAt: new Date('2026-08-19T12:05:00.000Z'),
      },
      {
        scheduledCommunicationId: recentFailedComm.id,
        idempotencyKey: 'dashboard-test-failed-comm-recent-1',
        attemptNumber: 1,
        recipientEmail: 'carer@example.com',
        status: 'failed',
        attemptedAt: recentAutomatedFailureAt,
      },
    ]);

    await db.insert(platformAuditEvents).values({
      action: 'shift_created',
      actorType: 'ops_user',
      actorUserId: null,
      entityType: 'shift',
      entityId: filledToday,
      shiftId: filledToday,
      centreId: FIXTURE.centreA,
      occurredAt: new Date('2026-08-21T10:00:00.000Z'),
      metadata: {},
    });
  });

  afterAll(async () => {
    if (!pool) return;
    await db.delete(platformAuditEvents).where(eq(platformAuditEvents.shiftId, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02'));
    await db.delete(communicationDeliveries).where(
      inArray(communicationDeliveries.idempotencyKey, [
        'dashboard-test-retry-succeeded-1',
        'dashboard-test-retry-succeeded-2',
        'dashboard-test-failed-comm-recent-1',
      ]),
    );
    await db.delete(scheduledCommunications).where(
      inArray(scheduledCommunications.idempotencyKey, [
        'dashboard-test-failed-comm-recent',
        'dashboard-test-failed-comm-old',
        'dashboard-test-retry-succeeded',
      ]),
    );
    await db.delete(shiftAssignmentNotifications).where(
      eq(shiftAssignmentNotifications.shiftId, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02'),
    );
    await db.delete(shifts).where(inArray(shifts.id, FIXTURE_SHIFT_IDS));
    await db.delete(staffDocumentFiles).where(
      inArray(staffDocumentFiles.storageKey, ['pending/vsc.pdf']),
    );
    await db.delete(staffDocumentSubmissions);
    await db.delete(staffDocumentSets).where(
      inArray(staffDocumentSets.staffId, [
        FIXTURE.staffPortalActive,
        FIXTURE.staffAssigned,
        FIXTURE.staffNoAccount,
        FIXTURE.staffDocPending,
      ]),
    );
    await db.delete(staffAccounts).where(
      inArray(staffAccounts.staffId, [
        FIXTURE.staffPortalActive,
        FIXTURE.staffInvited,
        FIXTURE.staffIncomplete,
        FIXTURE.staffDisabled,
      ]),
    );
    await db.delete(staff).where(
      inArray(staff.id, [
        FIXTURE.staffAssigned,
        FIXTURE.staffPortalActive,
        FIXTURE.staffNoAccount,
        FIXTURE.staffInvited,
        FIXTURE.staffIncomplete,
        FIXTURE.staffDisabled,
        FIXTURE.staffInactive,
        FIXTURE.staffDocPending,
      ]),
    );
    await db.delete(centres).where(inArray(centres.id, [FIXTURE.centreA, FIXTURE.centreB]));
    await pool.end();
  });

  it('uses Toronto timezone and today date in response', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.timezone).toBe('America/Toronto');
    expect(result.today.date).toBe(FIXTURE.today);
  });

  it('returns today counts by status including cancelled in total', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.today.total).toBe(5);
    expect(result.today.pending).toBe(2);
    expect(result.today.filled).toBe(1);
    expect(result.today.completed).toBe(1);
    expect(result.today.cancelled).toBe(1);
  });

  it('returns today shifts sorted by start time then centre name with cap metadata', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.today.shifts.length).toBeLessThanOrEqual(12);
    expect(result.today.hasMoreShifts).toBe(false);
    const starts = result.today.shifts.map((s) => s.startTime);
    expect(starts).toEqual(['09:00:00', '10:00:00', '14:00:00', '18:00:00', '19:00:00']);
    const filled = result.today.shifts.find((s) => s.shiftId === 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02');
    expect(filled?.assignedStaffName).toBe('Assigned Staff');
    const pending = result.today.shifts.find((s) => s.shiftId === 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01');
    expect(pending?.assignedStaffId).toBeNull();
    expect(pending?.startsAt).toMatch(/2026-08-21/);
    expect(typeof pending?.minutesUntilStart).toBe('number');
  });

  it('surfaces urgent pending shifts within 24h and excludes distant pending', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    const urgentIds = result.attention.urgentPendingShifts.map((s) => s.shiftId);
    expect(urgentIds).toContain('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01');
    expect(urgentIds).toContain('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee05');
    expect(urgentIds).toContain('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee06');
    expect(urgentIds).not.toContain('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee07');
    expect(urgentIds).not.toContain('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10');
    expect(result.attention.totalUrgentPendingCount).toBeGreaterThanOrEqual(3);
  });

  it('excludes today from next 7 days and includes tomorrow through day +7', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.next7Days.dateFrom).toBe(FIXTURE.tomorrow);
    expect(result.next7Days.dateTo).toBe(FIXTURE.dayPlus7);
    expect(result.next7Days.total).toBe(6);
    expect(result.next7Days.pending).toBe(3);
    expect(result.next7Days.filled).toBe(1);
    expect(result.next7Days.completed).toBe(1);
    expect(result.next7Days.cancelled).toBe(1);
  });

  it('uses authoritative fill rate formula with null on zero denominator', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.next7Days.fillRate).toBe(40);
  });

  it('returns next 7 pending shifts sorted with cap metadata', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.next7Days.pendingShifts.map((s) => s.shiftId)).toEqual([
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee06',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee07',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee08',
    ]);
    expect(result.next7Days.totalPendingCount).toBe(3);
    expect(result.next7Days.hasMorePendingShifts).toBe(false);
  });

  it('matches document compliance report semantics for all staff', async () => {
    const reportSummary = (await documentsReport.getActiveStaffComplianceSummary());
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.documents).toEqual(reportSummary);
    expect(result.documents.pendingReview).toBeGreaterThanOrEqual(1);
    expect(result.attention.documents.pendingReview).toBe(result.documents.pendingReview);
  });

  it('returns staff readiness counts for all staff', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.staffReadiness.staffCount).toBeGreaterThanOrEqual(7);
    expect(result.staffReadiness.portalActive).toBeGreaterThanOrEqual(1);
    expect(result.staffReadiness.noAccount).toBeGreaterThanOrEqual(1);
    expect(result.staffReadiness.invited).toBeGreaterThanOrEqual(1);
    expect(result.staffReadiness.incomplete).toBeGreaterThanOrEqual(1);
    expect(result.staffReadiness.disabled).toBeGreaterThanOrEqual(1);
  });

  it('counts communication failures within the rolling 24-hour window only', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.attention.communications.windowHours).toBe(24);
    expect(result.attention.communications.failedAssignmentConfirmations).toBe(2);
    expect(result.attention.communications.failedAutomatedCommunications).toBe(1);
    expect(result.attention.communications.totalFailures).toBe(3);
    expect(result.attention.communications.recentFailures.length).toBeLessThanOrEqual(5);
    for (const failure of result.attention.communications.recentFailures) {
      expect(new Date(failure.occurredAt).getTime()).toBeGreaterThanOrEqual(
        FIXTURE.fixedNow.getTime() - 24 * 60 * 60 * 1000,
      );
    }
  });

  it('excludes successful communications and retry-success scheduled communications', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(
      result.attention.communications.recentFailures.some(
        (item) => item.communicationType === 'shift_reminder_3d',
      ),
    ).toBe(false);
    expect(
      result.attention.communications.recentFailures.some(
        (item) => item.type === 'assignment_confirmation' && item.staffName === null,
      ),
    ).toBe(false);
  });

  it('includes boundary failures at exactly 24 hours and excludes older failures', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    const assignmentFailures = result.attention.communications.recentFailures.filter(
      (item) => item.type === 'assignment_confirmation',
    );
    expect(assignmentFailures.some((item) => item.occurredAt === '2026-08-20T16:00:00.000Z')).toBe(
      true,
    );
    expect(
      assignmentFailures.some((item) => item.occurredAt === '2026-08-19T12:00:00.000Z'),
    ).toBe(false);
    expect(
      assignmentFailures.some((item) => item.occurredAt === '2026-08-20T15:59:59.999Z'),
    ).toBe(false);
  });

  it('returns up to 6 recent activity items newest first from existing audit data', async () => {
    const result = await service.overview(FIXTURE.fixedNow);
    expect(result.recentActivity.length).toBeLessThanOrEqual(6);
    for (const item of result.recentActivity) {
      expect(item.occurredAt).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.action).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.actor).toBeTruthy();
    }
    if (result.recentActivity.length >= 2) {
      expect(
        result.recentActivity[0].occurredAt.localeCompare(result.recentActivity[1].occurredAt),
      ).toBeGreaterThanOrEqual(0);
    }
  });
});

import { computeFillRatePercent } from '../reports/report-percentage.util';

describe('Dashboard overview fill rate zero denominator', () => {
  it('returns null fill rate when no pending/filled/completed shifts in range', () => {
    expect(computeFillRatePercent(0, 0, 0)).toBeNull();
  });
});

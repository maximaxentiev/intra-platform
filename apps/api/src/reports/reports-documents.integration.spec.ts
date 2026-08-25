import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureCommunicationsTables } from '../automated-communications/test-communications-schema.util';
import * as schema from '../db/schema';
import {
  communicationDeliveries,
  scheduledCommunications,
  staff,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import { buildDocumentExpiryIdempotencyKey } from '../staff-documents/document-expiry-reminder.types';
import {
  addCalendarDays,
  formatDateOnly,
  startOfUtcDay,
} from '../staff-documents/staff-document-dates.util';
import type { StaffDocumentType } from '../staff-documents/staff-document.constants';
import { ReportsDocumentsService } from './reports-documents.service';
import { ReportsService } from './reports.service';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsStaffService } from './reports-staff.service';
import { ReportsActivityService } from './reports-activity.service';
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

const FIXTURE = {
  staffA: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
  staffB: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
  staffC: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03',
  staffD: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04',
  staffE: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee05',
  staffF: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee06',
  staffG: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee07',
  staffInactive: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee08',
  oldSubmission: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
};

const FIXTURE_ACTIVE_STAFF_IDS = [
  FIXTURE.staffA,
  FIXTURE.staffB,
  FIXTURE.staffC,
  FIXTURE.staffD,
  FIXTURE.staffE,
  FIXTURE.staffF,
  FIXTURE.staffG,
];

async function insertApprovedCategory(
  db: NodePgDatabase<typeof schema>,
  staffId: string,
  documentType: StaffDocumentType,
  input: {
    processedDate?: string;
    expiryDate?: string;
    submissionId?: string;
  } = {},
): Promise<string> {
  const setRows = await db
    .insert(staffDocumentSets)
    .values({
      staffId,
      documentType,
      remindersEnabled: true,
    })
    .returning({ id: staffDocumentSets.id });
  const setId = setRows[0]!.id;

  const submissionRows = await db
    .insert(staffDocumentSubmissions)
    .values({
      id: input.submissionId,
      documentSetId: setId,
      reviewStatus: 'approved',
      processedDate: input.processedDate ?? null,
      expiryDate: input.expiryDate ?? null,
      submittedAt: new Date('2026-01-01T10:00:00.000Z'),
      submittedByActorType: 'ops_user',
    })
    .returning({ id: staffDocumentSubmissions.id });
  const submissionId = submissionRows[0]!.id;

  await db.insert(staffDocumentFiles).values({
    submissionId,
    originalFilename: 'proof.pdf',
    contentType: 'application/pdf',
    byteSize: 100,
    storageKey: `test/${staffId}/${documentType}.pdf`,
  });

  await db
    .update(staffDocumentSets)
    .set({ currentSubmissionId: submissionId })
    .where(eq(staffDocumentSets.id, setId));

  return submissionId;
}

describe.skipIf(!POSTGRES_READY)('Reports documents PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: ReportsDocumentsService;
  let exportService: ReportsExportService;
  const setIds: string[] = [];
  const submissionIds: string[] = [];
  const fileIds: string[] = [];
  const scheduledIds: string[] = [];
  const deliveryIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensureCommunicationsTables(pool);
    const reportsService = new ReportsService(db);
    service = new ReportsDocumentsService(db, reportsService);
    exportService = new ReportsExportService(
      new ReportsShiftService(db, reportsService),
      new ReportsStaffService(db, reportsService),
      service,
      new ReportsActivityService(db),
    );

    await db.delete(staff).where(inArray(staff.id, [...FIXTURE_ACTIVE_STAFF_IDS, FIXTURE.staffInactive]));

    const today = startOfUtcDay(new Date());
    const expiringSoonDate = formatDateOnly(addCalendarDays(today, 20));
    const expiredDate = formatDateOnly(addCalendarDays(today, -10));

    await db.insert(staff).values([
      {
        id: FIXTURE.staffA,
        legalName: 'Staff A Compliant',
        email: `${FIXTURE.staffA}@example.test`,
        city: 'Toronto',
        role: 'ECE',
        status: 'active',
      },
      {
        id: FIXTURE.staffB,
        legalName: 'Staff B Expiring',
        email: `${FIXTURE.staffB}@example.test`,
        city: 'Toronto',
        role: 'ECA',
        status: 'active',
      },
      {
        id: FIXTURE.staffC,
        legalName: 'Staff C Expired FA',
        email: `${FIXTURE.staffC}@example.test`,
        city: 'Toronto',
        role: 'Nanny',
        status: 'active',
      },
      {
        id: FIXTURE.staffD,
        legalName: 'Staff D Pending Imm',
        email: `${FIXTURE.staffD}@example.test`,
        city: 'Toronto',
        role: 'ECE',
        status: 'active',
      },
      {
        id: FIXTURE.staffE,
        legalName: 'Staff E Issue VSC',
        email: `${FIXTURE.staffE}@example.test`,
        city: 'Toronto',
        role: 'ECA',
        status: 'active',
      },
      {
        id: FIXTURE.staffF,
        legalName: 'Staff F Zero Docs',
        email: `${FIXTURE.staffF}@example.test`,
        city: 'Toronto',
        role: 'ECE',
        status: 'active',
      },
      {
        id: FIXTURE.staffG,
        legalName: 'Staff G Covid Only Gap',
        email: `${FIXTURE.staffG}@example.test`,
        city: 'Toronto',
        role: 'ECA',
        status: 'active',
      },
      {
        id: FIXTURE.staffInactive,
        legalName: 'Inactive Staff',
        email: `${FIXTURE.staffInactive}@example.test`,
        city: 'Toronto',
        role: 'ECA',
        status: 'inactive',
      },
    ]);

    // A — all required approved (VSC annual model dates)
    await insertApprovedCategory(db, FIXTURE.staffA, 'vulnerable_sector_check', {
      processedDate: '2026-08-01',
      expiryDate: '2027-08-01',
    });
    await insertApprovedCategory(db, FIXTURE.staffA, 'first_aid_cpr', {
      expiryDate: '2027-06-01',
    });
    await insertApprovedCategory(db, FIXTURE.staffA, 'immunizations');
    await insertApprovedCategory(db, FIXTURE.staffA, 'covid19_vaccination');

    // B — VSC expiring soon (+ reminder fixtures on current submission)
    const staffBVscSubmission = await insertApprovedCategory(
      db,
      FIXTURE.staffB,
      'vulnerable_sector_check',
      {
        processedDate: '2025-08-01',
        expiryDate: expiringSoonDate,
      },
    );
    await insertApprovedCategory(db, FIXTURE.staffB, 'first_aid_cpr', {
      expiryDate: '2027-06-01',
    });
    await insertApprovedCategory(db, FIXTURE.staffB, 'immunizations');

    // C — First Aid expired
    await insertApprovedCategory(db, FIXTURE.staffC, 'vulnerable_sector_check', {
      processedDate: '2024-01-01',
      expiryDate: '2027-01-01',
    });
    await insertApprovedCategory(db, FIXTURE.staffC, 'first_aid_cpr', {
      expiryDate: expiredDate,
    });
    await insertApprovedCategory(db, FIXTURE.staffC, 'immunizations');

    // D — immunizations pending
    await insertApprovedCategory(db, FIXTURE.staffD, 'vulnerable_sector_check', {
      processedDate: '2024-01-01',
      expiryDate: '2027-01-01',
    });
    await insertApprovedCategory(db, FIXTURE.staffD, 'first_aid_cpr', {
      expiryDate: '2027-06-01',
    });
    const immSet = await db
      .insert(staffDocumentSets)
      .values({ staffId: FIXTURE.staffD, documentType: 'immunizations', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const immSubmission = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: immSet[0]!.id,
        reviewStatus: 'pending_review',
        submittedAt: new Date('2026-02-01T10:00:00.000Z'),
        submittedByActorType: 'carer',
      })
      .returning({ id: staffDocumentSubmissions.id });
    await db.insert(staffDocumentFiles).values({
      submissionId: immSubmission[0]!.id,
      originalFilename: 'imm.pdf',
      contentType: 'application/pdf',
      byteSize: 100,
      storageKey: `test/${FIXTURE.staffD}/imm.pdf`,
    });
    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: immSubmission[0]!.id })
      .where(eq(staffDocumentSets.id, immSet[0]!.id));

    // E — VSC issue flagged
    const vscSet = await db
      .insert(staffDocumentSets)
      .values({ staffId: FIXTURE.staffE, documentType: 'vulnerable_sector_check', remindersEnabled: true })
      .returning({ id: staffDocumentSets.id });
    const vscSubmission = await db
      .insert(staffDocumentSubmissions)
      .values({
        documentSetId: vscSet[0]!.id,
        reviewStatus: 'issue_flagged',
        processedDate: '2024-01-01',
        expiryDate: '2027-01-01',
        submittedAt: new Date('2026-01-01T10:00:00.000Z'),
        submittedByActorType: 'carer',
        issueNote: 'Blurry scan',
      })
      .returning({ id: staffDocumentSubmissions.id });
    await db.insert(staffDocumentFiles).values({
      submissionId: vscSubmission[0]!.id,
      originalFilename: 'vsc.pdf',
      contentType: 'application/pdf',
      byteSize: 100,
      storageKey: `test/${FIXTURE.staffE}/vsc.pdf`,
    });
    await db
      .update(staffDocumentSets)
      .set({ currentSubmissionId: vscSubmission[0]!.id })
      .where(eq(staffDocumentSets.id, vscSet[0]!.id));
    await insertApprovedCategory(db, FIXTURE.staffE, 'first_aid_cpr', {
      expiryDate: '2027-06-01',
    });
    await insertApprovedCategory(db, FIXTURE.staffE, 'immunizations');

    // F — zero documents (no sets)

    // G — all required approved, COVID missing
    await insertApprovedCategory(db, FIXTURE.staffG, 'vulnerable_sector_check', {
      processedDate: '2024-01-01',
      expiryDate: '2027-01-01',
    });
    await insertApprovedCategory(db, FIXTURE.staffG, 'first_aid_cpr', {
      expiryDate: '2027-06-01',
    });
    await insertApprovedCategory(db, FIXTURE.staffG, 'immunizations');

    // Superseded submission with old reminder (should be ignored)
    const oldSet = await db
      .select({ id: staffDocumentSets.id })
      .from(staffDocumentSets)
      .where(
        eq(staffDocumentSets.staffId, FIXTURE.staffB),
      );
    const vscSetId = oldSet.find(() => true)?.id;
    if (!vscSetId) throw new Error('missing staff B VSC set');
    await db.insert(staffDocumentSubmissions).values({
      id: FIXTURE.oldSubmission,
      documentSetId: vscSetId,
      reviewStatus: 'approved',
      processedDate: '2020-01-01',
      expiryDate: '2021-01-01',
      submittedAt: new Date('2020-01-01T10:00:00.000Z'),
      submittedByActorType: 'ops_user',
      supersededAt: new Date('2026-01-01T10:00:00.000Z'),
    });
    const oldScheduled = await db
      .insert(scheduledCommunications)
      .values({
        idempotencyKey: buildDocumentExpiryIdempotencyKey({
          submissionId: FIXTURE.oldSubmission,
          offsetDays: 30,
        }),
        communicationType: 'document_expiry_30d',
        entityType: 'staff_document',
        entityId: FIXTURE.oldSubmission,
        recipientType: 'staff_account',
        scheduledFor: new Date('2020-12-01T09:00:00.000Z'),
        status: 'sent',
      })
      .returning({ id: scheduledCommunications.id });
    scheduledIds.push(oldScheduled[0]!.id);

    const currentScheduled = await db
      .insert(scheduledCommunications)
      .values({
        idempotencyKey: buildDocumentExpiryIdempotencyKey({
          submissionId: staffBVscSubmission,
          offsetDays: 14,
        }),
        communicationType: 'document_expiry_14d',
        entityType: 'staff_document',
        entityId: staffBVscSubmission,
        recipientType: 'staff_account',
        scheduledFor: new Date('2026-08-05T13:01:00.000Z'),
        status: 'sent',
      })
      .returning({ id: scheduledCommunications.id });
    scheduledIds.push(currentScheduled[0]!.id);

    const delivery = await db
      .insert(communicationDeliveries)
      .values({
        scheduledCommunicationId: currentScheduled[0]!.id,
        idempotencyKey: `${currentScheduled[0]!.id}:1`,
        attemptNumber: 1,
        status: 'sent',
        sentAt: new Date('2026-08-05T13:01:00.000Z'),
        attemptedAt: new Date('2026-08-05T13:01:00.000Z'),
      })
      .returning({ id: communicationDeliveries.id });
    deliveryIds.push(delivery[0]!.id);

    const futureScheduled = await db
      .insert(scheduledCommunications)
      .values({
        idempotencyKey: buildDocumentExpiryIdempotencyKey({
          submissionId: staffBVscSubmission,
          offsetDays: 7,
        }),
        communicationType: 'document_expiry_7d',
        entityType: 'staff_document',
        entityId: staffBVscSubmission,
        recipientType: 'staff_account',
        scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'scheduled',
      })
      .returning({ id: scheduledCommunications.id });
    scheduledIds.push(futureScheduled[0]!.id);
  });

  afterAll(async () => {
    if (deliveryIds.length > 0) {
      await db.delete(communicationDeliveries).where(inArray(communicationDeliveries.id, deliveryIds));
    }
    if (scheduledIds.length > 0) {
      await db
        .delete(scheduledCommunications)
        .where(inArray(scheduledCommunications.id, scheduledIds));
    }

    const staffIds = Object.values(FIXTURE);
    const sets = await db
      .select({ id: staffDocumentSets.id })
      .from(staffDocumentSets)
      .where(inArray(staffDocumentSets.staffId, staffIds));
    setIds.push(...sets.map((row) => row.id));

    if (setIds.length > 0) {
      await db.delete(staffDocumentSets).where(inArray(staffDocumentSets.id, setIds));
    }

    await db.delete(staff).where(inArray(staff.id, staffIds));
    await pool.end();
  });

  it('defaults to all staff when staffIds omitted', async () => {
    const result = await service.getDocumentCompliance({ pageSize: 100 });
    expect(result.staffIds).toBeNull();
    expect(result.totalCount).toBeGreaterThanOrEqual(FIXTURE_ACTIVE_STAFF_IDS.length);
    expect(result.items.some((row) => row.staffId === FIXTURE.staffInactive)).toBe(true);

    const fixtureSlice = await service.getDocumentCompliance({
      staffIds: [FIXTURE.staffF],
      pageSize: 100,
    });
    expect(fixtureSlice.items.some((row) => row.staffId === FIXTURE.staffF)).toBe(true);
  });

  it('returns explicit staff roster including zero-document staff', async () => {
    const result = await service.getDocumentCompliance({
      staffIds: FIXTURE_ACTIVE_STAFF_IDS,
      pageSize: 100,
    });

    expect(result.staffIds).toEqual(FIXTURE_ACTIVE_STAFF_IDS);
    expect(result.items.some((row) => row.staffId === FIXTURE.staffF)).toBe(true);
    expect(result.items.some((row) => row.staffId === FIXTURE.staffInactive)).toBe(false);

    const staffF = result.items.find((row) => row.staffId === FIXTURE.staffF)!;
    expect(staffF.overallComplianceStatus).toBe('needs_attention');
    expect(staffF.documents.vulnerableSectorCheck.status).toBe('not_submitted');
    expect(staffF.documents.covid19Vaccination.status).toBe('not_submitted');
    expect(staffF.documents.covid19Vaccination.optional).toBe(true);
  });

  it('classifies test matrix staff statuses', async () => {
    const result = await service.getDocumentCompliance({
      staffIds: FIXTURE_ACTIVE_STAFF_IDS,
      pageSize: 100,
    });
    const byId = new Map(result.items.map((row) => [row.staffId, row]));

    expect(byId.get(FIXTURE.staffA)?.overallComplianceStatus).toBe('compliant');
    expect(byId.get(FIXTURE.staffB)?.documents.vulnerableSectorCheck.status).toBe('expiring_soon');
    expect(byId.get(FIXTURE.staffB)?.overallComplianceStatus).toBe('expiring_soon');
    expect(byId.get(FIXTURE.staffC)?.overallComplianceStatus).toBe('needs_attention');
    expect(byId.get(FIXTURE.staffD)?.overallComplianceStatus).toBe('needs_attention');
    expect(byId.get(FIXTURE.staffE)?.overallComplianceStatus).toBe('needs_attention');
    expect(byId.get(FIXTURE.staffG)?.overallComplianceStatus).toBe('compliant');

    expect(byId.get(FIXTURE.staffC)?.documents.firstAidCpr.status).toBe('expired');
    expect(byId.get(FIXTURE.staffD)?.documents.immunizations.status).toBe('pending_review');
    expect(byId.get(FIXTURE.staffE)?.documents.vulnerableSectorCheck.status).toBe('issue_flagged');
  });

  it('reports VSC processed and renewal due from stored expiry_date', async () => {
    const result = await service.getDocumentCompliance({
      staffIds: [FIXTURE.staffA],
      pageSize: 100,
    });
    const row = result.items[0]!;

    expect(row.documents.vulnerableSectorCheck.processedDate).toBe('2026-08-01');
    expect(row.documents.vulnerableSectorCheck.expiryDate).toBe('2027-08-01');
  });

  it('summarizes reminders for current submission only', async () => {
    const result = await service.getDocumentCompliance({
      staffIds: [FIXTURE.staffB],
      pageSize: 100,
    });
    const vsc = result.items[0]!.documents.vulnerableSectorCheck;

    expect(vsc.latestReminderStatus).toBe('sent');
    expect(vsc.latestReminderSentAt).toBeTruthy();
    expect(vsc.nextReminderAt).toBeTruthy();
  });

  it('filters by document status with optional documentType scoping', async () => {
    const expired = await service.getDocumentCompliance({
      status: 'expired',
      pageSize: 100,
    });
    expect(expired.items.some((row) => row.staffId === FIXTURE.staffC)).toBe(true);
    expect(expired.items.some((row) => row.staffId === FIXTURE.staffA)).toBe(false);

    const covidMissing = await service.getDocumentCompliance({
      status: 'not_submitted',
      documentType: 'covid19_vaccination',
      pageSize: 100,
    });
    expect(covidMissing.items.some((row) => row.staffId === FIXTURE.staffG)).toBe(true);
    expect(covidMissing.items.some((row) => row.staffId === FIXTURE.staffA)).toBe(false);
  });

  it('paginates staff rows with defaults and hasMore', async () => {
    const page1 = await service.getDocumentCompliance({ page: 1, pageSize: 3 });
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(3);
    expect(page1.items).toHaveLength(3);
    expect(page1.totalCount).toBeGreaterThanOrEqual(7);
    expect(page1.hasMore).toBe(true);

    const filtered = await service.getDocumentCompliance({
      status: 'compliant',
      pageSize: 100,
    });
    expect(filtered.totalCount).toBeLessThan(page1.totalCount);
    expect(filtered.summary.compliant).toBe(filtered.totalCount);
  });

  it('uses bounded batch queries independent of page size', async () => {
    let queryCount = 0;
    const originalQuery = pool.query.bind(pool);
    pool.query = ((...args: Parameters<typeof pool.query>) => {
      queryCount += 1;
      return originalQuery(...args);
    }) as typeof pool.query;

    await service.getDocumentCompliance({ pageSize: 25 });
    const queriesFor25 = queryCount;

    queryCount = 0;
    await service.getDocumentCompliance({ pageSize: 5 });
    const queriesFor5 = queryCount;

    expect(queriesFor25).toBeLessThanOrEqual(6);
    expect(queriesFor5).toBe(queriesFor25);
  });

  describe('CSV export', () => {
    it('document compliance export matches filtered totalCount and omits sensitive fields', async () => {
      const query = {
        status: 'compliant' as const,
        page: 2,
        pageSize: 2,
      };
      const json = await service.getDocumentCompliance(query);
      const csv = await exportService.exportDocumentCompliance(query);

      expect(csv.rowCount).toBe(json.totalCount);
      expect(csvDataRowCount(csv.content)).toBe(json.totalCount);
      expect(csv.filename).toMatch(/^document-compliance-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(csv.content).toContain('Staff Name,Role,Overall Compliance');
      expect(csv.content).toContain('VSC Status');
      expect(csv.content).not.toMatch(/storage_key|share_url|token|s3/i);
    });
  });
});

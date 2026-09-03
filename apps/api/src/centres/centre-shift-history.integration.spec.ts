import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import {
  centreContacts,
  centres,
  shiftBatches,
  shifts,
  staff,
} from '../db/schema';
import { RecordingEmailTransport } from '../email/email.transport';
import { EmailService } from '../email/email.service';
import { ReportsService } from '../reports/reports.service';
import { ReportsShiftService } from '../reports/reports-shift.service';
import { ReportsExportService } from '../reports/reports-export.service';
import { ReportsStaffService } from '../reports/reports-staff.service';
import { ReportsDocumentsService } from '../reports/reports-documents.service';
import { ReportsActivityService } from '../reports/reports-activity.service';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { ScheduledCommunicationsService } from '../automated-communications/scheduled-communications.service';
import { CommunicationsQueueService } from '../automated-communications/communications-queue.service';
import { CommunicationProcessorRegistry } from '../automated-communications/communication-processor.registry';
import { AutomatedCommunicationsProcessor } from '../automated-communications/automated-communications.processor';
import { ConfigService } from '@nestjs/config';
import { CentreShiftHistoryService } from './centre-shift-history.service';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { registerCentreShiftHistoryProcessor } from './centre-shift-history.processor';

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
  centreA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  centreB: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  contactA: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
  contactB: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
  staffA: 'cccccccc-cccc-4ccc-8ccc-cccccccccca1',
  batchA: 'dddddddd-dddd-4ddd-8ddd-ddddddddddb1',
  dateFrom: '2026-08-10',
  dateTo: '2026-08-12',
};

describe.skipIf(!POSTGRES_READY)('Centre shift history PostgreSQL integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let service: CentreShiftHistoryService;
  let exportService: ReportsExportService;
  let email: EmailService;
  let processor: AutomatedCommunicationsProcessor;
  let registry: CommunicationProcessorRegistry;
  let recording: RecordingEmailTransport;
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    const reportsService = new ReportsService(db);
    const reportsShift = new ReportsShiftService(db, reportsService);
    exportService = new ReportsExportService(
      reportsShift,
      new ReportsStaffService(db, reportsService),
      new ReportsDocumentsService(db, reportsService),
      new ReportsActivityService(db),
    );
    const scheduled = new ScheduledCommunicationsService(db);
    const queue = {
      syncJobSchedule: vi.fn().mockResolvedValue(undefined),
      getRetryAttempts: () => 3,
    } as unknown as CommunicationsQueueService;
    const automated = new AutomatedCommunicationsService(scheduled, queue);
    email = new EmailService(new ConfigService({ RESEND_API_KEY: 're_test' }));
    recording = new RecordingEmailTransport();
    email.useTransport(recording);
    service = new CentreShiftHistoryService(
      db,
      exportService,
      automated,
      email,
      new PlatformAuditService(db),
    );

    registry = new CommunicationProcessorRegistry();
    registerCentreShiftHistoryProcessor(registry, new ConfigService({ NODE_ENV: 'test' }), exportService);
    processor = new AutomatedCommunicationsProcessor(
      new ConfigService({ REDIS_URL: 'redis://127.0.0.1:6379' }),
      db,
      scheduled,
      email,
      registry,
      queue,
    );

    await db.delete(shifts).where(inArray(shifts.centreId, [FIXTURE.centreA, FIXTURE.centreB]));
    await db.delete(shiftBatches).where(inArray(shiftBatches.centreId, [FIXTURE.centreA]));
    await db.delete(centreContacts).where(inArray(centreContacts.centreId, [FIXTURE.centreA, FIXTURE.centreB]));
    await db.delete(staff).where(eq(staff.id, FIXTURE.staffA));
    await db.delete(centres).where(inArray(centres.id, [FIXTURE.centreA, FIXTURE.centreB]));

    await db.insert(centres).values([
      {
        id: FIXTURE.centreA,
        name: 'Alpha Centre',
        city: 'Toronto',
        internalOpsNotes: 'SENTINEL_CENTRE_INTERNAL_OPS_NOTES',
      },
      { id: FIXTURE.centreB, name: 'Beta Centre', city: 'Ottawa' },
    ]);

    await db.insert(centreContacts).values([
      {
        id: FIXTURE.contactA,
        centreId: FIXTURE.centreA,
        name: 'Jane Smith',
        title: 'Director',
        email: 'jane.alpha@example.test',
        phone: '4165550100',
        sortOrder: 0,
      },
      {
        id: FIXTURE.contactB,
        centreId: FIXTURE.centreB,
        name: 'Bob Beta',
        title: 'Manager',
        email: 'bob.beta@example.test',
        phone: '6135550100',
        sortOrder: 0,
      },
    ]);

    await db.insert(staff).values({
      id: FIXTURE.staffA,
      legalFirstName: 'Alexandra',
      legalLastName: 'Morgan',
      legalName: 'Alexandra Morgan',
      displayName: 'Lex',
      useDisplayName: true,
      email: 'lex@example.test',
      phone: '4165559999',
      city: 'Toronto',
      role: 'ECE',
    });

    await db.insert(shiftBatches).values({
      id: FIXTURE.batchA,
      centreId: FIXTURE.centreA,
    });

    const rows = await db
      .insert(shifts)
      .values([
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-09',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
          notes: 'SENTINEL_INTERNAL_SHIFT_COMMENT',
          shiftConfirmationNotes: 'SENTINEL_EXTERNAL_SHIFT_NOTE',
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-10',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'filled',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
          batchId: FIXTURE.batchA,
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-11',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'cancelled',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-12',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'pending',
        },
        {
          centreId: FIXTURE.centreA,
          shiftDate: '2026-08-13',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
        },
        {
          centreId: FIXTURE.centreB,
          shiftDate: '2026-08-11',
          startTime: '09:00:00',
          endTime: '17:00:00',
          status: 'completed',
          assignedStaffId: FIXTURE.staffA,
          roleNeeded: 'ECE',
        },
      ])
      .returning({ id: shifts.id });

    shiftIds.push(...rows.map((row) => row.id));
  });

  afterAll(async () => {
    if (shiftIds.length > 0) {
      await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    }
    await db.delete(shiftBatches).where(eq(shiftBatches.id, FIXTURE.batchA));
    await db.delete(centreContacts).where(inArray(centreContacts.id, [FIXTURE.contactA, FIXTURE.contactB]));
    await db.delete(staff).where(eq(staff.id, FIXTURE.staffA));
    await db.delete(centres).where(inArray(centres.id, [FIXTURE.centreA, FIXTURE.centreB]));
    await pool.end();
  });

  it('exports legal Carer names and all statuses for inclusive date range', async () => {
    const csv = await exportService.exportCentreShiftHistory(
      FIXTURE.centreA,
      'Alpha Centre',
      FIXTURE.dateFrom,
      FIXTURE.dateTo,
    );

    expect(csv.rowCount).toBe(4);
    expect(csv.content).toContain('Alexandra Morgan');
    expect(csv.content).not.toContain(',Lex,');
    expect(csv.content).not.toContain('Lex\n');
    expect(csv.content).toContain('Filled');
    expect(csv.content).toContain('Cancelled');
    expect(csv.content).toContain('Pending');
    expect(csv.content).not.toContain('SENTINEL_CENTRE_INTERNAL_OPS_NOTES');
    expect(csv.content).not.toContain('SENTINEL_INTERNAL_SHIFT_COMMENT');
    expect(csv.content).not.toContain('SENTINEL_EXTERNAL_SHIFT_NOTE');
    expect(csv.content).not.toContain('lex@example.test');
    expect(csv.content).not.toContain('4165559999');
    expect(csv.filename).toContain('alpha-centre-shift-history-2026-08-10-to-2026-08-12.csv');
  });

  it('excludes other centres and out-of-range shifts', async () => {
    const csv = await exportService.exportCentreShiftHistory(
      FIXTURE.centreA,
      'Alpha Centre',
      FIXTURE.dateFrom,
      FIXTURE.dateTo,
    );

    expect(csv.content).not.toContain('Beta Centre');
    expect(csv.content).not.toContain('2026-08-09');
    expect(csv.content).not.toContain('2026-08-13');
  });

  it('includes batch child shift rows only', async () => {
    const csv = await exportService.exportCentreShiftHistory(
      FIXTURE.centreA,
      'Alpha Centre',
      FIXTURE.dateFrom,
      FIXTURE.dateTo,
    );

    expect(csv.content).toContain('2026-08-10');
    expect(csv.content).not.toContain(FIXTURE.batchA);
  });

  it('preview disables send/download for empty range', async () => {
    const preview = await service.getPreview(FIXTURE.centreA, '2026-01-01', '2026-01-31');
    expect(preview.shiftCount).toBe(0);
    expect(preview.canSendEmail).toBe(false);
    expect(preview.canDownloadCsv).toBe(false);
    expect(preview.emptyMessage).toMatch(/No Shifts were found/i);
  });

  it('rejects email schedule without primary contact', async () => {
    await db.delete(centreContacts).where(eq(centreContacts.centreId, FIXTURE.centreA));
    await expect(
      service.scheduleEmail(FIXTURE.centreA, FIXTURE.dateFrom, FIXTURE.dateTo, 'ops-user'),
    ).rejects.toThrow(/primary Centre contact/i);
    await db.insert(centreContacts).values({
      id: FIXTURE.contactA,
      centreId: FIXTURE.centreA,
      name: 'Jane Smith',
      title: 'Director',
      email: 'jane.alpha@example.test',
      phone: '4165550100',
      sortOrder: 0,
    });
  });

  it('processor sends one CSV attachment with legal names', async () => {
    recording.sent.length = 0;

    const scheduled = await service.scheduleEmail(
      FIXTURE.centreA,
      FIXTURE.dateFrom,
      FIXTURE.dateTo,
      'ops-user-id',
    );

    await processor.processJob({
      data: { scheduledCommunicationId: scheduled.scheduledCommunicationId },
      attemptsMade: 1,
    } as never);

    expect(recording.sent).toHaveLength(1);
    const message = recording.sent[0]!;
    expect(message.to).toBe('jane.alpha@example.test');
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments![0]!.filename).toContain('alpha-centre-shift-history');
    expect(message.attachments![0]!.contentType).toBe('text/csv');
    const csvText = Buffer.from(message.attachments![0]!.content, 'base64').toString('utf8');
    expect(csvText).toContain('Alexandra Morgan');
    expect(csvText).not.toContain(',Lex,');
  });
});

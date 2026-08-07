import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { staff, staffAccounts } from '../db/schema';
import { normalizeStaffEmail } from '../staff-portal/portal-account-status.util';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from '../staff-portal/staff-portal-audit.service';
import { StaffPortalInvitationsService } from '../staff-portal/staff-portal-invitations.service';
import {
  STAFF_CSV_ALLOWED_MIME_TYPES,
  STAFF_CSV_MAX_BYTES,
  STAFF_CSV_MAX_ROWS,
} from './staff-csv-import.config';
import {
  buildPreviewRows,
  summarizePreview,
  type StaffCsvPreviewRow,
} from './staff-csv-import.util';
import { StaffService } from './staff.service';
import type { StaffCanonicalRole } from './staff-role.util';

export type StaffCsvPreviewResponse = {
  summary: ReturnType<typeof summarizePreview>;
  rows: StaffCsvPreviewRow[];
  limits: { maxBytes: number; maxRows: number };
};

export type StaffCsvImportRowResult = {
  rowNumber: number;
  email: string;
  displayName: string;
  phone: string;
  outcome:
    | 'created'
    | 'skipped_duplicate'
    | 'skipped_invalid'
    | 'failed'
    | 'invitation_sent'
    | 'invitation_failed';
  staffId?: string;
  message?: string;
};

export type StaffCsvImportResponse = {
  batchId: string;
  summary: {
    totalProcessed: number;
    staffCreated: number;
    skipped: number;
    duplicates: number;
    failed: number;
    invitationsSent: number;
    invitationEmailFailures: number;
  };
  rows: StaffCsvImportRowResult[];
};

@Injectable()
export class StaffCsvImportService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly staff: StaffService,
    private readonly portalInvites: StaffPortalInvitationsService,
    private readonly audit: StaffPortalAuditService,
  ) {}

  async previewFromUpload(file: Express.Multer.File | undefined): Promise<StaffCsvPreviewResponse> {
    const content = this.readUpload(file);
    const { staffEmails, portalEmails } = await this.loadExistingEmails();
    const { rows, headerError, rowLimitExceeded } = buildPreviewRows(
      content,
      staffEmails,
      portalEmails,
    );
    if (headerError) throw new BadRequestException(headerError);
    if (rowLimitExceeded) {
      throw new BadRequestException(`CSV exceeds the maximum of ${STAFF_CSV_MAX_ROWS} data rows.`);
    }
    return {
      summary: summarizePreview(rows),
      rows,
      limits: { maxBytes: STAFF_CSV_MAX_BYTES, maxRows: STAFF_CSV_MAX_ROWS },
    };
  }

  async executeImport(
    file: Express.Multer.File | undefined,
    actorUserId: string,
    sendPortalInvitations: boolean,
  ): Promise<StaffCsvImportResponse> {
    const content = this.readUpload(file);
    const { staffEmails, portalEmails } = await this.loadExistingEmails();
    const { rows, headerError, rowLimitExceeded } = buildPreviewRows(
      content,
      staffEmails,
      portalEmails,
    );
    if (headerError) throw new BadRequestException(headerError);
    if (rowLimitExceeded) {
      throw new BadRequestException(`CSV exceeds the maximum of ${STAFF_CSV_MAX_ROWS} data rows.`);
    }

    const batchId = randomUUID();
    const results: StaffCsvImportRowResult[] = [];
    let staffCreated = 0;
    let skipped = 0;
    let duplicates = 0;
    let failed = 0;
    let invitationsSent = 0;
    let invitationEmailFailures = 0;
    let firstCreatedStaffId: string | null = null;

    for (const row of rows) {
      if (row.status !== 'valid') {
        const outcome = row.status === 'duplicate' ? 'skipped_duplicate' : 'skipped_invalid';
        if (row.status === 'duplicate') duplicates += 1;
        else skipped += 1;
        results.push({
          rowNumber: row.rowNumber,
          email: row.email,
          displayName: row.displayName,
          phone: row.phone,
          outcome,
          message: row.issues.join(' '),
        });
        continue;
      }

      try {
        const created = await this.staff.createManual(
          {
            displayName: row.displayName,
            legalFirstName: row.legalFirstName,
            legalLastName: row.legalLastName,
            email: row.email,
            phone: row.phone,
            address: row.address,
            city: row.city,
            role: row.role as StaffCanonicalRole,
          },
          actorUserId,
          { source: 'csv_import', importBatchId: batchId },
        );
        staffEmails.add(normalizeStaffEmail(row.email));
        staffCreated += 1;
        if (!firstCreatedStaffId) firstCreatedStaffId = created.id;

        let outcome: StaffCsvImportRowResult['outcome'] = 'created';
        let message: string | undefined;

        if (sendPortalInvitations) {
          const invite = await this.portalInvites.sendInvitation(created.id, actorUserId, {
            resend: false,
          });
          if (invite.emailSent) {
            outcome = 'invitation_sent';
            invitationsSent += 1;
          } else {
            outcome = 'invitation_failed';
            invitationEmailFailures += 1;
            message = invite.message ?? 'Invitation email could not be sent.';
          }
        }

        results.push({
          rowNumber: row.rowNumber,
          email: row.email,
          displayName: row.displayName,
          phone: row.phone,
          outcome,
          staffId: created.id,
          message,
        });
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : 'Import failed for this row.';
        if (/already exists|already used/i.test(message)) {
          duplicates += 1;
          failed -= 1;
          results.push({
            rowNumber: row.rowNumber,
            email: row.email,
            displayName: row.displayName,
            phone: row.phone,
            outcome: 'skipped_duplicate',
            message,
          });
        } else {
          results.push({
            rowNumber: row.rowNumber,
            email: row.email,
            displayName: row.displayName,
            phone: row.phone,
            outcome: 'failed',
            message,
          });
        }
      }
    }

    if (firstCreatedStaffId) {
      // Batch summary is tied to the first imported staff for schema reasons (staff_id NOT NULL).
      // It is ops/import metadata, not portal lifecycle — must not block deletion.
      await this.audit.record({
        staffId: firstCreatedStaffId,
        actorUserId,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.staffBulkImportCompleted,
        detail: {
          batchId,
          staffCreated,
          skipped,
          duplicates,
          failed,
          invitationsSent,
          invitationEmailFailures,
          sendPortalInvitations,
        },
      });
    }

    return {
      batchId,
      summary: {
        totalProcessed: rows.length,
        staffCreated,
        skipped,
        duplicates,
        failed,
        invitationsSent,
        invitationEmailFailures,
      },
      rows: results,
    };
  }

  private readUpload(file: Express.Multer.File | undefined): string {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A CSV file is required.');
    }
    if (file.size > STAFF_CSV_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `CSV file exceeds the maximum size of ${STAFF_CSV_MAX_BYTES} bytes.`,
      );
    }
    const mime = (file.mimetype ?? '').toLowerCase();
    const name = (file.originalname ?? '').toLowerCase();
    const mimeOk = STAFF_CSV_ALLOWED_MIME_TYPES.has(mime);
    const extOk = name.endsWith('.csv');
    if (!mimeOk && !extOk) {
      throw new UnsupportedMediaTypeException('Only CSV files are accepted.');
    }
    return file.buffer.toString('utf8');
  }

  private async loadExistingEmails() {
    const staffRows = await this.db.select({ email: staff.email }).from(staff);
    const accountRows = await this.db.select({ email: staffAccounts.email }).from(staffAccounts);
    const staffEmails = new Set(
      staffRows.map((r) => normalizeStaffEmail(r.email)).filter(Boolean),
    );
    const portalEmails = new Set(
      accountRows.map((r) => normalizeStaffEmail(r.email)).filter(Boolean),
    );
    return { staffEmails, portalEmails };
  }
}

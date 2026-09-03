import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AutomatedCommunicationsService } from '../automated-communications/automated-communications.service';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres } from '../db/schema';
import { EmailService } from '../email/email.service';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { validateReportDateRange } from '../reports/report-date.util';
import { ReportsExportService } from '../reports/reports-export.service';
import { resolveCentrePrimaryContact } from './centre-primary-contact.util';
import {
  buildCentreShiftHistoryIdempotencyKey,
  CENTRE_SHIFT_HISTORY_COMMUNICATION_TYPE,
} from './centre-shift-history.types';

export type CentreShiftHistoryPreview = {
  centreId: string;
  centreName: string;
  dateFrom: string;
  dateTo: string;
  shiftCount: number;
  recipient: { name: string; email: string } | null;
  canSendEmail: boolean;
  canDownloadCsv: boolean;
  emptyMessage: string | null;
  missingPrimaryContactMessage: string | null;
};

@Injectable()
export class CentreShiftHistoryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reportsExport: ReportsExportService,
    private readonly automated: AutomatedCommunicationsService,
    private readonly email: EmailService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  async getPreview(
    centreId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<CentreShiftHistoryPreview> {
    const centre = await this.requireCentre(centreId);
    validateReportDateRange(dateFrom, dateTo);

    const csv = await this.reportsExport.exportCentreShiftHistory(
      centreId,
      centre.name,
      dateFrom,
      dateTo,
    );
    const primaryContact = await resolveCentrePrimaryContact(this.db, centreId);
    const empty = csv.rowCount === 0;

    return {
      centreId,
      centreName: centre.name,
      dateFrom,
      dateTo,
      shiftCount: csv.rowCount,
      recipient: primaryContact
        ? { name: primaryContact.name, email: primaryContact.email }
        : null,
      canSendEmail: !empty && !!primaryContact && this.email.isConfigured(),
      canDownloadCsv: !empty,
      emptyMessage: empty
        ? 'No Shifts were found for this Centre in the selected date range.'
        : null,
      missingPrimaryContactMessage: primaryContact
        ? null
        : 'Add a primary Centre contact with a valid email before sending.',
    };
  }

  async exportCsv(centreId: string, dateFrom: string, dateTo: string) {
    const centre = await this.requireCentre(centreId);
    validateReportDateRange(dateFrom, dateTo);

    const csv = await this.reportsExport.exportCentreShiftHistory(
      centreId,
      centre.name,
      dateFrom,
      dateTo,
    );
    if (csv.rowCount === 0) {
      throw new BadRequestException(
        'No Shifts were found for this Centre in the selected date range.',
      );
    }
    return csv;
  }

  async scheduleEmail(
    centreId: string,
    dateFrom: string,
    dateTo: string,
    actorUserId: string,
  ) {
    const centre = await this.requireCentre(centreId);
    validateReportDateRange(dateFrom, dateTo);

    if (!this.email.isConfigured()) {
      throw new BadRequestException('Email is not configured on this server.');
    }

    const preview = await this.getPreview(centreId, dateFrom, dateTo);
    if (preview.shiftCount === 0) {
      throw new BadRequestException(preview.emptyMessage!);
    }
    if (!preview.recipient) {
      throw new BadRequestException(preview.missingPrimaryContactMessage!);
    }

    const requestId = randomUUID();
    const idempotencyKey = buildCentreShiftHistoryIdempotencyKey({
      centreId,
      dateFrom,
      dateTo,
      requestId,
    });

    const scheduled = await this.automated.scheduleAndEnqueue({
      idempotencyKey,
      communicationType: CENTRE_SHIFT_HISTORY_COMMUNICATION_TYPE,
      entityType: 'centre',
      entityId: centreId,
      recipientType: 'centre',
      recipientEntityId: centreId,
      scheduledFor: new Date(),
    });

    await this.platformAudit.record({
      action: PLATFORM_AUDIT_ACTIONS.centreShiftHistoryEmailScheduled,
      actorType: 'ops_user',
      actorUserId,
      entityType: 'centre',
      entityId: centreId,
      centreId,
      metadata: {
        centreName: centre.name,
        dateFrom,
        dateTo,
        shiftRowCount: preview.shiftCount,
        recipientEmail: preview.recipient.email,
        recipientName: preview.recipient.name,
        scheduledCommunicationId: scheduled.id,
      },
    });

    return {
      scheduledCommunicationId: scheduled.id,
      shiftCount: preview.shiftCount,
      recipient: preview.recipient,
      dateFrom,
      dateTo,
    };
  }

  private async requireCentre(centreId: string) {
    const rows = await this.db
      .select({ id: centres.id, name: centres.name })
      .from(centres)
      .where(eq(centres.id, centreId))
      .limit(1);
    const centre = rows[0];
    if (!centre) {
      throw new NotFoundException('Centre not found.');
    }
    return centre;
  }
}

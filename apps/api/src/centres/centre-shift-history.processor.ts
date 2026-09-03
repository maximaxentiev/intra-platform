import type { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { CommunicationProcessor } from '../automated-communications/communication-processor.registry';
import type { CommunicationProcessorContext } from '../automated-communications/communication-processor.registry';
import type {
  CommunicationProcessorOutcome,
  CommunicationType,
} from '../automated-communications/automated-communications.types';
import type { PlatformUrlEnv } from '../config/platform-url';
import type { Database } from '../db/drizzle.module';
import { centres, scheduledCommunications } from '../db/schema';
import { ReportsExportService } from '../reports/reports-export.service';
import { resolveCentrePrimaryContact } from './centre-primary-contact.util';
import { buildCentreShiftHistoryEmailContent } from './centre-shift-history-email.template';
import {
  CENTRE_SHIFT_HISTORY_COMMUNICATION_TYPE,
  parseCentreShiftHistoryIdempotencyKey,
} from './centre-shift-history.types';

function resolvePlatformEnv(config: ConfigService): PlatformUrlEnv {
  return {
    NODE_ENV: config.get<string>('NODE_ENV') ?? 'development',
    APP_PUBLIC_URL: config.get<string>('APP_PUBLIC_URL') ?? undefined,
    APP_HOST: config.get<string>('APP_HOST') ?? undefined,
  };
}

export class CentreShiftHistoryCommunicationProcessor implements CommunicationProcessor {
  readonly communicationType: CommunicationType = CENTRE_SHIFT_HISTORY_COMMUNICATION_TYPE;

  constructor(
    private readonly config: ConfigService,
    private readonly reportsExport: ReportsExportService,
  ) {}

  async evaluate(
    db: Database,
    context: CommunicationProcessorContext,
  ): Promise<CommunicationProcessorOutcome> {
    const commRows = await db
      .select({ idempotencyKey: scheduledCommunications.idempotencyKey })
      .from(scheduledCommunications)
      .where(eq(scheduledCommunications.id, context.scheduledCommunicationId))
      .limit(1);

    const idempotencyKey = commRows[0]?.idempotencyKey;
    if (!idempotencyKey) return { kind: 'stale' };

    const parsed = parseCentreShiftHistoryIdempotencyKey(idempotencyKey);
    if (!parsed || parsed.centreId !== context.entityId) return { kind: 'stale' };

    const centreRows = await db
      .select({ id: centres.id, name: centres.name })
      .from(centres)
      .where(eq(centres.id, parsed.centreId))
      .limit(1);
    const centre = centreRows[0];
    if (!centre) return { kind: 'stale' };

    const primaryContact = await resolveCentrePrimaryContact(db, parsed.centreId);
    if (!primaryContact) {
      return {
        kind: 'permanent_failure',
        code: 'no_centre_primary_contact',
        reason: 'Centre primary contact email is unavailable.',
      };
    }

    const csv = await this.reportsExport.exportCentreShiftHistory(
      parsed.centreId,
      centre.name,
      parsed.dateFrom,
      parsed.dateTo,
    );
    if (csv.rowCount === 0) {
      return {
        kind: 'skipped',
        code: 'centre_shift_history_empty',
        reason: 'No Shifts were found for this Centre in the selected date range.',
      };
    }

    const content = buildCentreShiftHistoryEmailContent({
      contactName: primaryContact.name,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
      platformEnv: resolvePlatformEnv(this.config),
    });

    return {
      kind: 'valid',
      recipientEmail: primaryContact.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      attachments: [
        {
          filename: csv.filename,
          content: Buffer.from(csv.content, 'utf8').toString('base64'),
          contentType: 'text/csv',
        },
      ],
    };
  }
}

export function registerCentreShiftHistoryProcessor(
  registry: { register: (processor: CommunicationProcessor) => void },
  config: ConfigService,
  reportsExport: ReportsExportService,
): void {
  registry.register(new CentreShiftHistoryCommunicationProcessor(config, reportsExport));
}

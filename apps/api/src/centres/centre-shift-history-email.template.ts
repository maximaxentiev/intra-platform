import type { ConfigService } from '@nestjs/config';
import { buildIntraEmailLogoUrl } from '../config/platform-email-links';
import type { PlatformUrlEnv } from '../config/platform-url';
import { escapeShiftAssignmentEmailHtml } from '../shifts/shift-assignment-notification.util';
import { wrapIntraEmailHtml } from '../email/platform-email-branding.util';
import { centreContactFirstName } from './centre-primary-contact.util';

export function formatCentreShiftHistoryDateRangeLabel(dateFrom: string, dateTo: string): string {
  return `${dateFrom} to ${dateTo}`;
}

export function buildCentreShiftHistoryEmailContent(params: {
  contactName: string;
  dateFrom: string;
  dateTo: string;
  platformEnv: PlatformUrlEnv;
}) {
  const rangeLabel = formatCentreShiftHistoryDateRangeLabel(params.dateFrom, params.dateTo);
  const firstName = centreContactFirstName(params.contactName);
  const subject = `Shift history from Intra — ${rangeLabel}`;

  const text = [
    `Hi ${firstName},`,
    '',
    `Attached is your Intra Shift history for ${rangeLabel}.`,
    'The CSV includes the Shifts recorded for your Centre during this period.',
  ].join('\n');

  const html = wrapIntraEmailHtml(
    `<tr><td style="font-size:15px;line-height:1.6;color:#333;">Hi ${escapeShiftAssignmentEmailHtml(firstName)},</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.6;color:#333;">Attached is your Intra Shift history for ${escapeShiftAssignmentEmailHtml(rangeLabel)}.</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#333;">The CSV includes the Shifts recorded for your Centre during this period.</td></tr>`,
    buildIntraEmailLogoUrl(params.platformEnv),
  );

  return { subject, html, text };
}

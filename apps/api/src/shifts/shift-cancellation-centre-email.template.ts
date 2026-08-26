import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from './shift-assignment-display.util';

export function buildShiftCancellationCentreEmailContent(params: {
  centreName: string;
  carerLegalName: string;
  roleNeeded: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
}) {
  const dateLabel = formatShiftAssignmentDateLabel(params.shiftDate);
  const timeLabel = formatShiftAssignmentTimeRange(params.startTime, params.endTime);
  const subject = `Shift cancelled — ${params.centreName} — ${dateLabel}`;

  const roleLines =
    params.roleNeeded != null ? [`Role: ${params.roleNeeded}`, ''] : [];

  const text = [
    'Shift cancelled',
    '',
    'The scheduled shift below has been cancelled.',
    '',
    `Centre: ${params.centreName}`,
    `Carer: ${params.carerLegalName}`,
    ...roleLines,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
  ].join('\n');

  const roleHtml =
    params.roleNeeded != null
      ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Role:</strong> ${escapeShiftAssignmentEmailHtml(params.roleNeeded)}</td></tr>`
      : '';

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift cancelled</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">The scheduled shift below has been cancelled.</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Centre:</strong> ${escapeShiftAssignmentEmailHtml(params.centreName)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Carer:</strong> ${escapeShiftAssignmentEmailHtml(params.carerLegalName)}</td></tr>
        ${roleHtml}
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Date:</strong> ${escapeShiftAssignmentEmailHtml(dateLabel)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Time:</strong> ${escapeShiftAssignmentEmailHtml(timeLabel)}</td></tr>`);

  return { subject, html, text };
}

export function centreCancellationEmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}\n${content.html}`.toLowerCase();
  const forbidden = [
    'hourly',
    'billing',
    'staffpoint',
    '/documents/',
    'adjust hours',
    'cancellation reason',
    'family emergency',
    '@',
    'phone',
  ];
  return forbidden.every((term) => !blob.includes(term));
}

import { buildCarerShiftDetailLink } from '../config/platform-email-links';
import type { PlatformUrlEnv } from '../config/platform-url';
import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from './shift-assignment-display.util';

export function buildShiftCancellationCarerEmailContent(params: {
  centreName: string;
  centreAddress: string;
  centreCity: string;
  roleNeeded: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  shiftId: string;
  includePortalLink: boolean;
  platformEnv: PlatformUrlEnv;
}) {
  const dateLabel = formatShiftAssignmentDateLabel(params.shiftDate);
  const timeLabel = formatShiftAssignmentTimeRange(params.startTime, params.endTime);
  const subject = `Shift cancelled — ${params.centreName} — ${dateLabel}`;

  const addressLines = [params.centreAddress.trim(), params.centreCity.trim()].filter(Boolean);
  const roleText =
    params.roleNeeded != null ? [`Role: ${params.roleNeeded}`] : [];

  const portalUrl = params.includePortalLink
    ? buildCarerShiftDetailLink(params.shiftId, params.platformEnv)
    : null;

  const text = [
    'Shift cancelled',
    '',
    'Your scheduled shift has been cancelled.',
    '',
    `Centre: ${params.centreName}`,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    '',
    'Address:',
    ...addressLines,
    ...roleText,
    ...(portalUrl ? ['', 'View shift details:', portalUrl] : []),
  ].join('\n');

  const roleHtml =
    params.roleNeeded != null
      ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Role:</strong> ${escapeShiftAssignmentEmailHtml(params.roleNeeded)}</td></tr>`
      : '';

  const addressHtml = addressLines
    .map((line) => `<div>${escapeShiftAssignmentEmailHtml(line)}</div>`)
    .join('');

  const portalHtml = portalUrl
    ? `<tr><td style="padding-top:24px;" align="center">
          <a href="${escapeShiftAssignmentEmailHtml(portalUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">View shift details</a>
        </td></tr>`
    : '';

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift cancelled</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">Your scheduled shift has been cancelled.</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Centre:</strong> ${escapeShiftAssignmentEmailHtml(params.centreName)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Date:</strong> ${escapeShiftAssignmentEmailHtml(dateLabel)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Time:</strong> ${escapeShiftAssignmentEmailHtml(timeLabel)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Address:</strong><br/>${addressHtml}</td></tr>
        ${roleHtml}
        ${portalHtml}`);

  return { subject, html, text };
}

export function carerCancellationEmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}`.toLowerCase();
  const forbidden = ['hourly', 'billing', 'staffpoint', 'family emergency', 'cancellation reason'];
  return forbidden.every((term) => !blob.includes(term));
}

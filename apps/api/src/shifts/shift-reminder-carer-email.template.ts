import { buildCarerShiftDetailLink } from '../config/platform-email-links';
import type { PlatformUrlEnv } from '../config/platform-url';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeDisplay,
  formatShiftAssignmentTimeRange,
} from './shift-assignment-display.util';
import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import type { ShiftReminderInterval } from './shift-reminder.types';

function formatShiftReminderSubject(params: {
  interval: ShiftReminderInterval;
  centreName: string;
  shiftDate: string;
  startTime: string;
}): string {
  const dateLabel = formatShiftAssignmentDateLabel(params.shiftDate);
  const startDisplay = formatShiftAssignmentTimeDisplay(params.startTime);

  switch (params.interval) {
    case '3d':
      return `Upcoming shift in 3 days — ${params.centreName} — ${dateLabel}`;
    case '1d':
      return `Shift reminder for tomorrow — ${params.centreName} — ${dateLabel}`;
    case '2h':
      return `Shift reminder in 2 hours — ${params.centreName} — ${startDisplay}`;
  }
}

export function buildShiftReminderCarerEmailContent(params: {
  interval: ShiftReminderInterval;
  centreName: string;
  centreAddress: string;
  centreCity: string;
  centreNotes: string;
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
  const subject = formatShiftReminderSubject(params);

  const notesTrimmed = params.centreNotes.trim();
  const notesText =
    notesTrimmed.length > 0
      ? ['', 'Centre Rules, Policies, and Notes:', notesTrimmed]
      : [];
  const roleText =
    params.roleNeeded != null ? [`Role: ${params.roleNeeded}`] : [];

  const addressLines = [params.centreAddress.trim(), params.centreCity.trim()].filter(Boolean);
  const addressBlock = addressLines.length > 0 ? addressLines : [''];

  const portalUrl = params.includePortalLink
    ? buildCarerShiftDetailLink(params.shiftId, params.platformEnv)
    : null;

  const text = [
    'Upcoming shift reminder',
    '',
    `Centre: ${params.centreName}`,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    '',
    'Address:',
    ...addressBlock,
    ...roleText,
    ...notesText,
    ...(portalUrl ? ['', 'View shift details:', portalUrl] : []),
  ].join('\n');

  const roleHtml =
    params.roleNeeded != null
      ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Role:</strong> ${escapeShiftAssignmentEmailHtml(params.roleNeeded)}</td></tr>`
      : '';

  const notesHtml =
    notesTrimmed.length > 0
      ? `<tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Centre Rules, Policies, and Notes:</strong><br/>${escapeShiftAssignmentEmailHtml(notesTrimmed).replace(/\n/g, '<br/>')}</td></tr>`
      : '';

  const portalHtml = portalUrl
    ? `<tr><td style="padding-top:24px;" align="center">
          <a href="${escapeShiftAssignmentEmailHtml(portalUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">View shift details</a>
        </td></tr>`
    : '';

  const addressHtml = addressLines
    .map((line) => `<div>${escapeShiftAssignmentEmailHtml(line)}</div>`)
    .join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Upcoming shift reminder</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Centre:</strong> ${escapeShiftAssignmentEmailHtml(params.centreName)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Date:</strong> ${escapeShiftAssignmentEmailHtml(dateLabel)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Time:</strong> ${escapeShiftAssignmentEmailHtml(timeLabel)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Address:</strong><br/>${addressHtml}</td></tr>
        ${roleHtml}
        ${notesHtml}
        ${portalHtml}`);

  return { subject, html, text };
}

export function shiftReminderEmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}`.toLowerCase();
  const forbidden = ['hourly', 'billing', 'staffpoint', '/documents/'];
  return forbidden.every((term) => !blob.includes(term));
}

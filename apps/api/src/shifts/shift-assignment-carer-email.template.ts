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

export function buildShiftAssignmentCarerEmailContent(params: {
  centreName: string;
  centreAddress: string;
  centreCity: string;
  centreNotes: string;
  shiftConfirmationNotes: string;
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
  const subject = `Shift confirmation — ${params.centreName} — ${dateLabel}`;

  const centreRulesTrimmed = params.centreNotes.trim();
  const centreRulesText =
    centreRulesTrimmed.length > 0
      ? ['', 'Centre Rules, Policies, and Notes:', centreRulesTrimmed]
      : [];

  const shiftNotesTrimmed = params.shiftConfirmationNotes.trim();
  const shiftNotesText =
    shiftNotesTrimmed.length > 0 ? ['', 'Shift Notes:', shiftNotesTrimmed] : [];

  const roleText =
    params.roleNeeded != null ? [`Role: ${params.roleNeeded}`] : [];

  const addressLines = [params.centreAddress.trim(), params.centreCity.trim()].filter(Boolean);
  const addressBlock = addressLines.length > 0 ? addressLines : [''];

  const portalUrl = params.includePortalLink
    ? buildCarerShiftDetailLink(params.shiftId, params.platformEnv)
    : null;

  const text = [
    'Your shift is confirmed.',
    '',
    `Centre: ${params.centreName}`,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    '',
    'Address:',
    ...addressBlock,
    ...roleText,
    ...centreRulesText,
    ...shiftNotesText,
    ...(portalUrl ? ['', 'View shift details:', portalUrl] : []),
  ].join('\n');

  const roleHtml =
    params.roleNeeded != null
      ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Role:</strong> ${escapeShiftAssignmentEmailHtml(params.roleNeeded)}</td></tr>`
      : '';

  const centreRulesHtml =
    centreRulesTrimmed.length > 0
      ? `<tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Centre Rules, Policies, and Notes:</strong><br/>${escapeShiftAssignmentEmailHtml(centreRulesTrimmed).replace(/\n/g, '<br/>')}</td></tr>`
      : '';

  const shiftNotesHtml =
    shiftNotesTrimmed.length > 0
      ? `<tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Shift Notes:</strong><br/>${escapeShiftAssignmentEmailHtml(shiftNotesTrimmed).replace(/\n/g, '<br/>')}</td></tr>`
      : '';

  const portalHtml = portalUrl
    ? `<tr><td style="padding-top:24px;" align="center">
          <a href="${escapeShiftAssignmentEmailHtml(portalUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">View shift details</a>
        </td></tr>`
    : '';

  const addressHtml = addressLines
    .map(
      (line) =>
        `<div>${escapeShiftAssignmentEmailHtml(line)}</div>`,
    )
    .join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Your shift is confirmed.</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Centre:</strong> ${escapeShiftAssignmentEmailHtml(params.centreName)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Date:</strong> ${escapeShiftAssignmentEmailHtml(dateLabel)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Time:</strong> ${escapeShiftAssignmentEmailHtml(timeLabel)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Address:</strong><br/>${addressHtml}</td></tr>
        ${roleHtml}
        ${centreRulesHtml}
        ${shiftNotesHtml}
        ${portalHtml}`);

  return { subject, html, text };
}

export function carerAssignmentEmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}`.toLowerCase();
  const forbidden = ['cancellation', 'hourly', 'billing', 'staffpoint', '/documents/'];
  return forbidden.every((term) => !blob.includes(term));
}

/** Guard: legacy internal shifts.notes must never appear in external carer email. */
export function carerAssignmentEmailExcludesLegacyInternalNotes(content: {
  html: string;
  text: string;
  legacyInternalNote: string;
}) {
  if (!content.legacyInternalNote.trim()) return true;
  const blob = `${content.html}\n${content.text}`;
  return !blob.includes(content.legacyInternalNote);
}

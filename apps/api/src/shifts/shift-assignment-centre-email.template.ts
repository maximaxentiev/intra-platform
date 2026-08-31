import type { PlatformUrlEnv } from '../config/platform-url';
import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from './shift-assignment-display.util';

export function buildShiftAssignmentCentreEmailContent(params: {
  centreName: string;
  carerLegalName: string;
  roleNeeded: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  shiftConfirmationNotes: string;
  documentShareUrl: string;
}) {
  const dateLabel = formatShiftAssignmentDateLabel(params.shiftDate);
  const timeLabel = formatShiftAssignmentTimeRange(params.startTime, params.endTime);
  const subject = `Staff confirmed for ${params.centreName} — ${dateLabel}`;

  const shiftNotesTrimmed = params.shiftConfirmationNotes.trim();
  const shiftNotesText =
    shiftNotesTrimmed.length > 0 ? ['', 'Shift Notes:', shiftNotesTrimmed] : [];

  const roleLines =
    params.roleNeeded != null
      ? [`Role: ${params.roleNeeded}`, '']
      : [];

  const text = [
    'Staffing confirmation',
    '',
    `Carer: ${params.carerLegalName}`,
    ...roleLines,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    ...shiftNotesText,
    '',
    `View ${params.carerLegalName}'s current approved documents:`,
    params.documentShareUrl,
  ].join('\n');

  const roleHtml =
    params.roleNeeded != null
      ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Role:</strong> ${escapeShiftAssignmentEmailHtml(params.roleNeeded)}</td></tr>`
      : '';

  const shiftNotesHtml =
    shiftNotesTrimmed.length > 0
      ? `<tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Shift Notes:</strong><br/>${escapeShiftAssignmentEmailHtml(shiftNotesTrimmed).replace(/\n/g, '<br/>')}</td></tr>`
      : '';

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Staffing confirmation</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Carer:</strong> ${escapeShiftAssignmentEmailHtml(params.carerLegalName)}</td></tr>
        ${roleHtml}
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Date:</strong> ${escapeShiftAssignmentEmailHtml(dateLabel)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Time:</strong> ${escapeShiftAssignmentEmailHtml(timeLabel)}</td></tr>
        ${shiftNotesHtml}
        <tr><td style="padding-top:24px;" align="center">
          <a href="${escapeShiftAssignmentEmailHtml(params.documentShareUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">View ${escapeShiftAssignmentEmailHtml(params.carerLegalName)}&apos;s current approved documents</a>
        </td></tr>`);

  return { subject, html, text };
}

/** Guard for template tests — centre email must not leak internal shift fields. */
export function centreAssignmentEmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}\n${content.html}`.toLowerCase();
  const forbidden = [
    'cancellation',
    'hourly',
    'billing',
    'staffpoint',
    'internal',
    'assigned_staff',
  ];
  return forbidden.every((term) => !blob.includes(term));
}

/** Guard: legacy internal shifts.notes must never appear in external centre email. */
export function centreAssignmentEmailExcludesLegacyInternalNotes(content: {
  html: string;
  text: string;
  legacyInternalNote: string;
}) {
  if (!content.legacyInternalNote.trim()) return true;
  const blob = `${content.html}\n${content.text}`;
  return !blob.includes(content.legacyInternalNote);
}

export type ShiftAssignmentCentreEmailEnv = PlatformUrlEnv;

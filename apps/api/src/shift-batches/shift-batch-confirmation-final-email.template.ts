import { getStaffLegalFullName } from '@intra/shared';
import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from '../shifts/shift-assignment-notification.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from '../shifts/shift-assignment-display.util';

export type BatchFinalConfirmationShiftBlock = {
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string | null;
  carerLegalName: string;
  shiftConfirmationNotes: string;
  documentShareUrl: string;
};

export function buildBatchConfirmationFinalEmailContent(params: {
  centreName: string;
  activeShiftCount: number;
  assignments: BatchFinalConfirmationShiftBlock[];
}) {
  const subject = `Your Intra shift request is confirmed — ${params.centreName}`;

  const textBlocks = params.assignments.map((shift, index) => {
    const dateLabel = formatShiftAssignmentDateLabel(shift.shiftDate);
    const timeLabel = formatShiftAssignmentTimeRange(shift.startTime, shift.endTime);
    const notes = shift.shiftConfirmationNotes.trim();
    return [
      `Shift ${index + 1}`,
      `Date: ${dateLabel}`,
      `Time: ${timeLabel}`,
      shift.roleNeeded ? `Role: ${shift.roleNeeded}` : null,
      `Assigned Carer: ${shift.carerLegalName}`,
      notes ? `Shift Notes: ${notes}` : null,
      `View Carer Documents: ${shift.documentShareUrl}`,
    ]
      .filter(Boolean)
      .join('\n');
  });

  const text = [
    'Your shift request is now fully confirmed',
    '',
    `All ${params.activeShiftCount} active requested shifts for ${params.centreName} have been filled.`,
    'Assigned Carer details and secure document links are provided below.',
    '',
    ...textBlocks.flatMap((block, index) =>
      index === 0 ? [block] : ['', '---', '', block],
    ),
    '',
    'This confirmation includes all active shifts in the finalized request.',
  ].join('\n');

  const assignmentHtml = params.assignments
    .map((shift, index) => renderAssignmentBlockHtml(shift, index + 1, index > 0))
    .join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Your shift request is now fully confirmed</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">All ${escapeShiftAssignmentEmailHtml(String(params.activeShiftCount))} active requested shifts for ${escapeShiftAssignmentEmailHtml(params.centreName)} have been filled.</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">Assigned Carer details and secure document links are provided below.</td></tr>
        ${assignmentHtml}
        <tr><td style="padding-top:20px;font-size:14px;line-height:1.5;color:#666;">This confirmation includes all active shifts in the finalized request.</td></tr>`);

  return { subject, html, text };
}

export function renderAssignmentBlockHtml(
  shift: BatchFinalConfirmationShiftBlock,
  shiftNumber: number,
  withSeparator: boolean,
) {
  const dateLabel = formatShiftAssignmentDateLabel(shift.shiftDate);
  const timeLabel = formatShiftAssignmentTimeRange(shift.startTime, shift.endTime);
  const notes = shift.shiftConfirmationNotes.trim();
  const separator = withSeparator
    ? `<tr><td style="padding-top:24px;border-top:1px solid #e5e5e5;"></td></tr>`
    : `<tr><td style="padding-top:20px;"></td></tr>`;

  const roleHtml = shift.roleNeeded
    ? `<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>Role:</strong> ${escapeShiftAssignmentEmailHtml(shift.roleNeeded)}</td></tr>`
    : '';

  const notesHtml =
    notes.length > 0
      ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Shift Notes:</strong><br/>${escapeShiftAssignmentEmailHtml(notes).replace(/\n/g, '<br/>')}</td></tr>`
      : '';

  return `
        ${separator}
        <tr><td style="padding-top:${withSeparator ? '24' : '16'}px;font-size:17px;font-weight:600;color:#111;">Shift ${shiftNumber}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Date:</strong> ${escapeShiftAssignmentEmailHtml(dateLabel)}</td></tr>
        <tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>Time:</strong> ${escapeShiftAssignmentEmailHtml(timeLabel)}</td></tr>
        ${roleHtml}
        <tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>Assigned Carer:</strong> ${escapeShiftAssignmentEmailHtml(shift.carerLegalName)}</td></tr>
        ${notesHtml}
        <tr><td style="padding-top:16px;padding-bottom:24px;">
          <a href="${escapeShiftAssignmentEmailHtml(shift.documentShareUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px;">View Carer Documents</a>
        </td></tr>`;
}

export function batchFinalConfirmationEmailExcludesSensitiveData(content: {
  html: string;
  text: string;
  legacyInternalNote: string;
  internalCommentMarker: string;
}) {
  const blob = `${content.html}\n${content.text}`.toLowerCase();
  if (blob.includes('internal comment')) return false;
  if (content.legacyInternalNote.trim() && `${content.html}\n${content.text}`.includes(content.legacyInternalNote)) {
    return false;
  }
  if (content.internalCommentMarker.trim() && blob.includes(content.internalCommentMarker.toLowerCase())) {
    return false;
  }
  return !blob.includes('shift_comments');
}

export function resolveBatchFinalCarerLegalName(staff: {
  legalName: string | null;
  legalFirstName: string | null;
  legalLastName: string | null;
  displayName: string | null;
  useDisplayName: boolean | null;
}) {
  return (
    getStaffLegalFullName({
      legalFirstName: staff.legalFirstName,
      legalLastName: staff.legalLastName,
      legalName: staff.legalName,
    }) || 'Staff member'
  );
}

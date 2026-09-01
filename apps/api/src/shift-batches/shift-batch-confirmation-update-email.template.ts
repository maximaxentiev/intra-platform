import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from '../shifts/shift-assignment-notification.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from '../shifts/shift-assignment-display.util';
import type { BatchFinalConfirmationShiftBlock } from './shift-batch-confirmation-final-email.template';
import { renderAssignmentBlockHtml } from './shift-batch-confirmation-final-email.template';

export function buildBatchConfirmationUpdateEmailContent(params: {
  centreName: string;
  highlightedChanges: string[];
  assignments: BatchFinalConfirmationShiftBlock[];
}) {
  const subject = `Updates to your Intra shift request — ${params.centreName}`;

  const changeText =
    params.highlightedChanges.length > 0
      ? params.highlightedChanges.map((line) => `• ${line}`).join('\n')
      : '• See the updated shift schedule below.';

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
    'There are updates to your shift request.',
    '',
    'What changed',
    changeText,
    '',
    'Current confirmed shifts',
    '',
    ...textBlocks.flatMap((block, index) => (index === 0 ? [block] : ['', '---', '', block])),
  ].join('\n');

  const changeHtml = params.highlightedChanges
    .map(
      (line) =>
        `<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;">• ${escapeShiftAssignmentEmailHtml(line)}</td></tr>`,
    )
    .join('');

  const assignmentHtml = params.assignments
    .map((shift, index) => renderAssignmentBlockHtml(shift, index + 1, index > 0))
    .join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Updates to your shift request</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">There are updates to your confirmed shift request for ${escapeShiftAssignmentEmailHtml(params.centreName)}.</td></tr>
        <tr><td style="padding-top:20px;font-size:16px;font-weight:600;color:#111;">What changed</td></tr>
        ${changeHtml || `<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;">See the updated shift schedule below.</td></tr>`}
        <tr><td style="padding-top:24px;font-size:16px;font-weight:600;color:#111;">Current confirmed shifts</td></tr>
        ${assignmentHtml}`);

  return { subject, html, text };
}

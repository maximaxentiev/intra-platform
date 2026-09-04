import { renderCentreEmailCustomMessageHtmlRows } from '../email/centre-email-custom-content.util';
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

export function defaultBatchConfirmationUpdateEmailSubject(centreName: string) {
  return `Updates to your Intra shift request — ${centreName}`;
}

export function defaultBatchConfirmationUpdateEmailMessage(centreName: string) {
  return `There are updates to your confirmed shift request for ${centreName}.`;
}

export function buildBatchConfirmationUpdateEmailContent(params: {
  centreName: string;
  highlightedChanges: string[];
  assignments: BatchFinalConfirmationShiftBlock[];
  customSubject?: string;
  customMessage?: string;
  documentSharePreviewMode?: boolean;
}) {
  const subject =
    params.customSubject ?? defaultBatchConfirmationUpdateEmailSubject(params.centreName);
  const message =
    params.customMessage ?? defaultBatchConfirmationUpdateEmailMessage(params.centreName);
  const previewMode = params.documentSharePreviewMode === true;

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
    message.trim() || defaultBatchConfirmationUpdateEmailMessage(params.centreName),
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
    .map((shift, index) => renderAssignmentBlockHtml(shift, index + 1, index > 0, previewMode))
    .join('');

  const introHtml =
    renderCentreEmailCustomMessageHtmlRows(message) ||
    `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">${escapeShiftAssignmentEmailHtml(defaultBatchConfirmationUpdateEmailMessage(params.centreName))}</td></tr>`;

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Updates to your shift request</td></tr>
        ${introHtml}
        <tr><td style="padding-top:20px;font-size:16px;font-weight:600;color:#111;">What changed</td></tr>
        ${changeHtml || `<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;">See the updated shift schedule below.</td></tr>`}
        <tr><td style="padding-top:24px;font-size:16px;font-weight:600;color:#111;">Current confirmed shifts</td></tr>
        ${assignmentHtml}`);

  return {
    subject,
    html,
    text,
    defaultSubject: defaultBatchConfirmationUpdateEmailSubject(params.centreName),
    defaultMessage: defaultBatchConfirmationUpdateEmailMessage(params.centreName),
  };
}

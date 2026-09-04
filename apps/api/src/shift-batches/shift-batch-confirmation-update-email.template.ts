import {
  buildCentreEmailSecureDocMarker,
  renderCentreEmailFromEditableBody,
  validateCentreEmailSecureDocMarkers,
} from '../email/centre-email-body.util';
import { appendIntraEmailSignOffText } from '../email/platform-email-branding.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from '../shifts/shift-assignment-display.util';
import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from '../shifts/shift-assignment-notification.util';
import type { BatchFinalConfirmationShiftBlock } from './shift-batch-confirmation-final-email.template';
import { renderAssignmentBlockHtml } from './shift-batch-confirmation-final-email.template';

export function defaultBatchConfirmationUpdateEmailSubject(centreName: string) {
  return `Updates to your Intra shift request — ${centreName}`;
}

export function defaultBatchConfirmationUpdateEmailIntro(centreName: string) {
  return `There are updates to your confirmed shift request for ${centreName}.`;
}

export function buildBatchConfirmationUpdateEmailDefaultBody(params: {
  centreName: string;
  highlightedChanges: string[];
  assignments: BatchFinalConfirmationShiftBlock[];
}) {
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
      'View Carer Documents:',
      buildCentreEmailSecureDocMarker(shift.assignedStaffId),
    ]
      .filter((line): line is string => line != null && line.length > 0)
      .join('\n');
  });

  return [
    'Updates to your shift request',
    '',
    defaultBatchConfirmationUpdateEmailIntro(params.centreName),
    '',
    'What changed',
    changeText,
    '',
    'Current confirmed shifts',
    '',
    ...textBlocks.flatMap((block, index) => (index === 0 ? [block] : ['', '---', '', block])),
  ].join('\n');
}

export function buildBatchConfirmationUpdateEmailContent(params: {
  centreName: string;
  highlightedChanges: string[];
  assignments: BatchFinalConfirmationShiftBlock[];
  customSubject?: string;
  customBody?: string;
  documentSharePreviewMode?: boolean;
}) {
  const defaultSubject = defaultBatchConfirmationUpdateEmailSubject(params.centreName);
  const defaultBody = buildBatchConfirmationUpdateEmailDefaultBody(params);
  const subject = params.customSubject ?? defaultSubject;
  const body = params.customBody ?? defaultBody;
  const previewMode = params.documentSharePreviewMode === true;
  const expectedStaffIds = params.assignments.map((shift) => shift.assignedStaffId);
  const customized = subject !== defaultSubject || body !== defaultBody;

  if (customized) {
    validateCentreEmailSecureDocMarkers(body, expectedStaffIds);
    const documentLinks = new Map(
      params.assignments.map((shift) => [
        shift.assignedStaffId,
        { url: shift.documentShareUrl, carerLegalName: shift.carerLegalName },
      ]),
    );
    const rendered = renderCentreEmailFromEditableBody({
      body,
      previewMode,
      documentLinks,
    });
    return { subject, html: rendered.html, text: rendered.text, defaultSubject, defaultBody };
  }

  const changeText =
    params.highlightedChanges.length > 0
      ? params.highlightedChanges.map((line) => `• ${line}`).join('\n')
      : '• See the updated shift schedule below.';

  const changeHtml = params.highlightedChanges
    .map(
      (line) =>
        `<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;">• ${escapeShiftAssignmentEmailHtml(line)}</td></tr>`,
    )
    .join('');

  const assignmentHtml = params.assignments
    .map((shift, index) => renderAssignmentBlockHtml(shift, index + 1, index > 0, previewMode))
    .join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Updates to your shift request</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">${escapeShiftAssignmentEmailHtml(defaultBatchConfirmationUpdateEmailIntro(params.centreName))}</td></tr>
        <tr><td style="padding-top:20px;font-size:16px;font-weight:600;color:#111;">What changed</td></tr>
        ${changeHtml || `<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;">See the updated shift schedule below.</td></tr>`}
        <tr><td style="padding-top:24px;font-size:16px;font-weight:600;color:#111;">Current confirmed shifts</td></tr>
        ${assignmentHtml}`);

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

  const text = appendIntraEmailSignOffText(
    [
      defaultBatchConfirmationUpdateEmailIntro(params.centreName),
      '',
      'What changed',
      changeText,
      '',
      'Current confirmed shifts',
      '',
      ...textBlocks.flatMap((block, index) => (index === 0 ? [block] : ['', '---', '', block])),
    ].join('\n'),
  );

  return { subject, html, text, defaultSubject, defaultBody };
}

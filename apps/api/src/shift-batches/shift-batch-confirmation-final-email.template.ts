import { getStaffLegalFullName } from '@intra/shared';
import {
  buildCentreEmailSecureDocMarker,
  renderCentreEmailFromEditableBody,
  validateCentreEmailSecureDocMarkers,
} from '../email/centre-email-body.util';
import {
  documentShareLabelForCentreEmailPreview,
  documentShareUrlForCentreEmailPreview,
} from '../email/centre-email-custom-content.util';
import { appendIntraEmailSignOffText } from '../email/platform-email-branding.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from '../shifts/shift-assignment-display.util';
import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from '../shifts/shift-assignment-notification.util';

export type BatchFinalConfirmationShiftBlock = {
  assignedStaffId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string | null;
  carerLegalName: string;
  shiftConfirmationNotes: string;
  documentShareUrl: string;
};

export function defaultBatchConfirmationFinalEmailSubject(centreName: string) {
  return `Your Intra shift request is confirmed — ${centreName}`;
}

export function buildBatchConfirmationFinalEmailDefaultBody(params: {
  centreName: string;
  activeShiftCount: number;
  assignments: BatchFinalConfirmationShiftBlock[];
}) {
  const intro = defaultBatchConfirmationFinalIntro(params);
  const textBlocks = params.assignments.map((shift, index) =>
    buildBatchAssignmentDefaultBodyBlock(shift, index + 1),
  );

  return [
    'Your shift request is now fully confirmed',
    '',
    intro,
    '',
    ...textBlocks.flatMap((block, index) => (index === 0 ? [block] : ['', '---', '', block])),
    '',
    'This confirmation includes all active shifts in the finalized request.',
  ].join('\n');
}

function defaultBatchConfirmationFinalIntro(params: {
  activeShiftCount: number;
  centreName: string;
}) {
  return [
    `All ${params.activeShiftCount} active requested shifts for ${params.centreName} have been filled.`,
    'Assigned Carer details and secure document links are provided below.',
  ].join('\n\n');
}

function buildBatchAssignmentDefaultBodyBlock(
  shift: BatchFinalConfirmationShiftBlock,
  shiftNumber: number,
) {
  const dateLabel = formatShiftAssignmentDateLabel(shift.shiftDate);
  const timeLabel = formatShiftAssignmentTimeRange(shift.startTime, shift.endTime);
  const notes = shift.shiftConfirmationNotes.trim();
  return [
    `Shift ${shiftNumber}`,
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
}

export function buildBatchConfirmationFinalEmailContent(params: {
  centreName: string;
  activeShiftCount: number;
  assignments: BatchFinalConfirmationShiftBlock[];
  customSubject?: string;
  customBody?: string;
  documentSharePreviewMode?: boolean;
}) {
  const defaultSubject = defaultBatchConfirmationFinalEmailSubject(params.centreName);
  const defaultBody = buildBatchConfirmationFinalEmailDefaultBody(params);
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

  const intro = defaultBatchConfirmationFinalIntro({
    activeShiftCount: params.activeShiftCount,
    centreName: params.centreName,
  });
  const textBlocks = params.assignments.map((shift, index) =>
    buildBatchAssignmentDefaultBodyBlock(shift, index + 1),
  );

  const assignmentHtml = params.assignments
    .map((shift, index) => renderAssignmentBlockHtml(shift, index + 1, index > 0, previewMode))
    .join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Your shift request is now fully confirmed</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">All ${escapeShiftAssignmentEmailHtml(String(params.activeShiftCount))} active requested shifts for ${escapeShiftAssignmentEmailHtml(params.centreName)} have been filled.</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">Assigned Carer details and secure document links are provided below.</td></tr>
        ${assignmentHtml}
        <tr><td style="padding-top:20px;font-size:14px;line-height:1.5;color:#666;">This confirmation includes all active shifts in the finalized request.</td></tr>`);

  const text = appendIntraEmailSignOffText(
    [
      'Your shift request is now fully confirmed',
      '',
      intro,
      '',
      ...textBlocks.flatMap((block, index) => (index === 0 ? [block] : ['', '---', '', block])),
      '',
      'This confirmation includes all active shifts in the finalized request.',
    ].join('\n'),
  );

  return { subject, html, text, defaultSubject, defaultBody };
}

export function renderAssignmentBlockHtml(
  shift: BatchFinalConfirmationShiftBlock,
  shiftNumber: number,
  withSeparator: boolean,
  documentSharePreviewMode = false,
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

  const documentShareUrl = documentShareUrlForCentreEmailPreview(
    shift.documentShareUrl,
    documentSharePreviewMode,
  );
  const documentSharePreviewLabel = documentShareLabelForCentreEmailPreview(documentSharePreviewMode);
  const documentButtonLabel = documentSharePreviewLabel
    ? 'View Carer Documents (secure link included when sent)'
    : 'View Carer Documents';

  return `
        ${separator}
        <tr><td style="padding-top:${withSeparator ? '24' : '16'}px;font-size:17px;font-weight:600;color:#111;">Shift ${shiftNumber}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Date:</strong> ${escapeShiftAssignmentEmailHtml(dateLabel)}</td></tr>
        <tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>Time:</strong> ${escapeShiftAssignmentEmailHtml(timeLabel)}</td></tr>
        ${roleHtml}
        <tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>Assigned Carer:</strong> ${escapeShiftAssignmentEmailHtml(shift.carerLegalName)}</td></tr>
        ${notesHtml}
        <tr><td style="padding-top:16px;padding-bottom:24px;">
          <a href="${escapeShiftAssignmentEmailHtml(documentShareUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px;">${documentButtonLabel}</a>
        </td></tr>
        ${documentSharePreviewLabel ? `<tr><td style="padding-top:4px;padding-bottom:8px;font-size:13px;line-height:1.5;color:#666;">${escapeShiftAssignmentEmailHtml(documentSharePreviewLabel)}</td></tr>` : ''}`;
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

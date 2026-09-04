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
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from './shift-assignment-display.util';

export function defaultShiftAssignmentCentreEmailSubject(params: {
  centreName: string;
  shiftDate: string;
}) {
  const dateLabel = formatShiftAssignmentDateLabel(params.shiftDate);
  return `Staff confirmed for ${params.centreName} — ${dateLabel}`;
}

export function buildShiftAssignmentCentreEmailDefaultBody(params: {
  carerLegalName: string;
  roleNeeded: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  shiftConfirmationNotes: string;
  assignedStaffId: string;
}) {
  const dateLabel = formatShiftAssignmentDateLabel(params.shiftDate);
  const timeLabel = formatShiftAssignmentTimeRange(params.startTime, params.endTime);
  const shiftNotesTrimmed = params.shiftConfirmationNotes.trim();
  return [
    'Staffing confirmation',
    '',
    `Carer: ${params.carerLegalName}`,
    ...(params.roleNeeded != null ? [`Role: ${params.roleNeeded}`] : []),
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    ...(shiftNotesTrimmed.length > 0 ? ['', 'Shift Notes:', shiftNotesTrimmed] : []),
    '',
    `View ${params.carerLegalName}'s current approved documents:`,
    buildCentreEmailSecureDocMarker(params.assignedStaffId),
  ].join('\n');
}

export function buildShiftAssignmentCentreEmailContent(params: {
  centreName: string;
  carerLegalName: string;
  assignedStaffId: string;
  roleNeeded: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  shiftConfirmationNotes: string;
  documentShareUrl: string;
  customSubject?: string;
  customBody?: string;
  documentSharePreviewMode?: boolean;
}) {
  const defaultSubject = defaultShiftAssignmentCentreEmailSubject({
    centreName: params.centreName,
    shiftDate: params.shiftDate,
  });
  const defaultBody = buildShiftAssignmentCentreEmailDefaultBody({
    carerLegalName: params.carerLegalName,
    roleNeeded: params.roleNeeded,
    shiftDate: params.shiftDate,
    startTime: params.startTime,
    endTime: params.endTime,
    shiftConfirmationNotes: params.shiftConfirmationNotes,
    assignedStaffId: params.assignedStaffId,
  });
  const subject = params.customSubject ?? defaultSubject;
  const body = params.customBody ?? defaultBody;
  const previewMode = params.documentSharePreviewMode === true;
  const customized = subject !== defaultSubject || body !== defaultBody;

  if (customized) {
    validateCentreEmailSecureDocMarkers(body, [params.assignedStaffId]);
    const rendered = renderCentreEmailFromEditableBody({
      body,
      previewMode,
      documentLinks: new Map([
        [
          params.assignedStaffId,
          { url: params.documentShareUrl, carerLegalName: params.carerLegalName },
        ],
      ]),
    });
    return {
      subject,
      html: rendered.html,
      text: rendered.text,
      defaultSubject,
      defaultBody,
    };
  }

  const dateLabel = formatShiftAssignmentDateLabel(params.shiftDate);
  const timeLabel = formatShiftAssignmentTimeRange(params.startTime, params.endTime);
  const documentShareUrl = documentShareUrlForCentreEmailPreview(
    params.documentShareUrl,
    previewMode,
  );
  const documentSharePreviewLabel = documentShareLabelForCentreEmailPreview(previewMode);
  const shiftNotesTrimmed = params.shiftConfirmationNotes.trim();

  const roleHtml =
    params.roleNeeded != null
      ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Role:</strong> ${escapeShiftAssignmentEmailHtml(params.roleNeeded)}</td></tr>`
      : '';

  const shiftNotesHtml =
    shiftNotesTrimmed.length > 0
      ? `<tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Shift Notes:</strong><br/>${escapeShiftAssignmentEmailHtml(shiftNotesTrimmed).replace(/\n/g, '<br/>')}</td></tr>`
      : '';

  const documentButtonLabel = documentSharePreviewLabel
    ? 'View approved documents (secure link included when sent)'
    : `View ${escapeShiftAssignmentEmailHtml(params.carerLegalName)}&apos;s current approved documents`;

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Staffing confirmation</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Carer:</strong> ${escapeShiftAssignmentEmailHtml(params.carerLegalName)}</td></tr>
        ${roleHtml}
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Date:</strong> ${escapeShiftAssignmentEmailHtml(dateLabel)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Time:</strong> ${escapeShiftAssignmentEmailHtml(timeLabel)}</td></tr>
        ${shiftNotesHtml}
        <tr><td style="padding-top:24px;" align="center">
          <a href="${escapeShiftAssignmentEmailHtml(documentShareUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">${documentButtonLabel}</a>
        </td></tr>
        ${documentSharePreviewLabel ? `<tr><td style="padding-top:8px;font-size:13px;line-height:1.5;color:#666;text-align:center;">${escapeShiftAssignmentEmailHtml(documentSharePreviewLabel)}</td></tr>` : ''}`);

  const text = appendIntraEmailSignOffText(
    [
      'Staffing confirmation',
      '',
      `Carer: ${params.carerLegalName}`,
      ...(params.roleNeeded != null ? [`Role: ${params.roleNeeded}`, ''] : []),
      `Date: ${dateLabel}`,
      `Time: ${timeLabel}`,
      ...(shiftNotesTrimmed.length > 0 ? ['', 'Shift Notes:', shiftNotesTrimmed] : []),
      '',
      `View ${params.carerLegalName}'s current approved documents:`,
      documentSharePreviewLabel ?? params.documentShareUrl,
    ].join('\n'),
  );

  return { subject, html, text, defaultSubject, defaultBody };
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

export type ShiftAssignmentCentreEmailEnv = import('../config/platform-url').PlatformUrlEnv;

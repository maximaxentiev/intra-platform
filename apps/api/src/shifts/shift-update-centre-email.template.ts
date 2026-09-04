import { renderCentreEmailFromEditableBody } from '../email/centre-email-body.util';
import { appendIntraEmailSignOffText } from '../email/platform-email-branding.util';
import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import type { ShiftCommunicationChange } from './shift-update-changes.util';
import { formatChangeForUpdateEmail } from './shift-update-changes.util';

export function defaultShiftUpdateCentreEmailSubject(centreName: string) {
  return `Shift update — ${centreName}`;
}

export function buildShiftUpdateCentreEmailDefaultBody(params: {
  centreName: string;
  carerLegalName: string | null;
  includedChanges: ShiftCommunicationChange[];
}) {
  const formatted = params.includedChanges.map((change) => formatChangeForUpdateEmail(change));
  return [
    'Shift update',
    '',
    'An upcoming Intra Shift has been updated.',
    '',
    params.carerLegalName ? `Assigned staff: ${params.carerLegalName}` : null,
    ...formatted.map((item) => item.textLine),
  ]
    .filter((line): line is string => line != null && line.length > 0)
    .join('\n');
}

export function buildShiftUpdateCentreEmailContent(params: {
  centreName: string;
  carerLegalName: string | null;
  includedChanges: ShiftCommunicationChange[];
  customSubject?: string;
  customBody?: string;
}) {
  const defaultSubject = defaultShiftUpdateCentreEmailSubject(params.centreName);
  const defaultBody = buildShiftUpdateCentreEmailDefaultBody(params);
  const subject = params.customSubject ?? defaultSubject;
  const body = params.customBody ?? defaultBody;
  const customized = subject !== defaultSubject || body !== defaultBody;

  if (customized) {
    const rendered = renderCentreEmailFromEditableBody({
      body,
      documentLinks: new Map(),
    });
    return {
      subject,
      html: rendered.html,
      text: rendered.text,
      defaultSubject,
      defaultBody,
    };
  }

  const formatted = params.includedChanges.map((change) => formatChangeForUpdateEmail(change));
  const changeHtml = formatted.map((item) => item.htmlBlock).join('');
  const assignedHtml = params.carerLegalName
    ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Assigned staff:</strong> ${escapeShiftAssignmentEmailHtml(params.carerLegalName)}</td></tr>`
    : '';

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift update</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">An upcoming Intra Shift has been updated.</td></tr>
        ${assignedHtml}
        ${changeHtml}`);

  const text = appendIntraEmailSignOffText(
    [
      'An upcoming Intra Shift has been updated.',
      '',
      params.carerLegalName ? `Assigned staff: ${params.carerLegalName}` : undefined,
      ...formatted.map((item) => item.textLine),
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return { subject, html, text, defaultSubject, defaultBody };
}

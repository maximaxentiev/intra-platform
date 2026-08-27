import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import type { ShiftCommunicationChange } from './shift-update-changes.util';
import { formatShiftChangeArrow } from './shift-update-changes.util';

export function buildShiftUpdateCentreEmailContent(params: {
  centreName: string;
  carerLegalName: string | null;
  includedChanges: ShiftCommunicationChange[];
}) {
  const subject = `Shift update — ${params.centreName}`;
  const changeLines = params.includedChanges.map(
    (change) => `${change.label}\n${formatShiftChangeArrow(change)}`,
  );

  const text = [
    'An upcoming Intra Shift has been updated.',
    '',
    params.carerLegalName ? `Assigned staff: ${params.carerLegalName}` : undefined,
    ...changeLines,
    '',
    '— Intra',
  ]
    .filter(Boolean)
    .join('\n');

  const changeHtml = params.includedChanges
    .map(
      (change) =>
        `<tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>${escapeShiftAssignmentEmailHtml(change.label)}</strong><br/>${escapeShiftAssignmentEmailHtml(formatShiftChangeArrow(change))}</td></tr>`,
    )
    .join('');

  const assignedHtml = params.carerLegalName
    ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Assigned staff:</strong> ${escapeShiftAssignmentEmailHtml(params.carerLegalName)}</td></tr>`
    : '';

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift update</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">An upcoming Intra Shift has been updated.</td></tr>
        ${assignedHtml}
        ${changeHtml}`);

  return { subject, html, text };
}

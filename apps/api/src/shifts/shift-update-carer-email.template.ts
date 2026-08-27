import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import type { ShiftCommunicationChange } from './shift-update-changes.util';
import { formatShiftChangeArrow } from './shift-update-changes.util';

export function buildShiftUpdateCarerEmailContent(params: {
  centreName: string;
  includedChanges: ShiftCommunicationChange[];
}) {
  const subject = `Shift update at ${params.centreName}`;
  const changeLines = params.includedChanges.map(
    (change) => `${change.label}\n${formatShiftChangeArrow(change)}`,
  );

  const text = [
    `There has been an update to your upcoming Shift at ${params.centreName}.`,
    '',
    ...changeLines,
    '',
    '— Intra',
  ].join('\n');

  const changeHtml = params.includedChanges
    .map(
      (change) =>
        `<tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>${escapeShiftAssignmentEmailHtml(change.label)}</strong><br/>${escapeShiftAssignmentEmailHtml(formatShiftChangeArrow(change))}</td></tr>`,
    )
    .join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift update</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">There has been an update to your upcoming Shift at ${escapeShiftAssignmentEmailHtml(params.centreName)}.</td></tr>
        ${changeHtml}`);

  return { subject, html, text };
}

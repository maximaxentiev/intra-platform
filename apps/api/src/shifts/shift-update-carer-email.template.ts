import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import type { ShiftCommunicationChange } from './shift-update-changes.util';
import { formatChangeForUpdateEmail } from './shift-update-changes.util';

export function buildShiftUpdateCarerEmailContent(params: {
  centreName: string;
  includedChanges: ShiftCommunicationChange[];
}) {
  const subject = `Shift update at ${params.centreName}`;
  const formatted = params.includedChanges.map((change) => formatChangeForUpdateEmail(change));

  const text = [
    `There has been an update to your upcoming Shift at ${params.centreName}.`,
    '',
    ...formatted.map((item) => item.textLine),
    '',
    '— Intra',
  ].join('\n');

  const changeHtml = formatted.map((item) => item.htmlBlock).join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift update</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">There has been an update to your upcoming Shift at ${escapeShiftAssignmentEmailHtml(params.centreName)}.</td></tr>
        ${changeHtml}`);

  return { subject, html, text };
}

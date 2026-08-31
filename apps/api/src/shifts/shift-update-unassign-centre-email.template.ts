import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import type { ShiftCommunicationChange } from './shift-update-changes.util';
import { formatChangeForUpdateEmail } from './shift-update-changes.util';

const CENTRE_UNASSIGN_MESSAGE =
  'The previously assigned educator is no longer assigned following the schedule change. Intra is arranging a replacement for the revised Shift.';

export function buildShiftUpdateUnassignCentreEmailContent(params: {
  centreName: string;
  includedChanges: ShiftCommunicationChange[];
}) {
  const subject = `Shift update — ${params.centreName}`;
  const intro = 'The schedule for your upcoming Intra Shift has been updated.';
  const formatted = params.includedChanges.map((change) => formatChangeForUpdateEmail(change));

  const text = [intro, '', ...formatted.map((item) => item.textLine), '', CENTRE_UNASSIGN_MESSAGE, '', '— Intra']
    .filter(Boolean)
    .join('\n');

  const changeHtml = formatted.map((item) => item.htmlBlock).join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift update</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">${escapeShiftAssignmentEmailHtml(intro)}</td></tr>
        ${changeHtml}
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">${escapeShiftAssignmentEmailHtml(CENTRE_UNASSIGN_MESSAGE)}</td></tr>`);

  return { subject, html, text };
}

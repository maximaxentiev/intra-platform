import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import type { ShiftCommunicationChange } from './shift-update-changes.util';
import { formatShiftChangeArrow } from './shift-update-changes.util';

const CARER_UNASSIGN_MESSAGE =
  'Because the revised Shift falls outside your current availability, you are no longer assigned to this Shift.';

export function buildShiftUpdateUnassignCarerEmailContent(params: {
  centreName: string;
  includedChanges: ShiftCommunicationChange[];
}) {
  const subject = `Update to your upcoming Intra Shift`;
  const intro = `The schedule for your upcoming Shift at ${params.centreName} has changed.`;
  const changeLines = params.includedChanges.map(
    (change) => `${change.label}\n${formatShiftChangeArrow(change)}`,
  );

  const text = [intro, '', ...changeLines, '', CARER_UNASSIGN_MESSAGE, '', '— Intra']
    .filter(Boolean)
    .join('\n');

  const changeHtml = params.includedChanges
    .map(
      (change) =>
        `<tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>${escapeShiftAssignmentEmailHtml(change.label)}</strong><br/>${escapeShiftAssignmentEmailHtml(formatShiftChangeArrow(change))}</td></tr>`,
    )
    .join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift update</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">${escapeShiftAssignmentEmailHtml(intro)}</td></tr>
        ${changeHtml}
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">${escapeShiftAssignmentEmailHtml(CARER_UNASSIGN_MESSAGE)}</td></tr>`);

  return { subject, html, text };
}

import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';
import type { ShiftCommunicationChange } from './shift-update-changes.util';
import { formatChangeForUpdateEmail } from './shift-update-changes.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from './shift-assignment-display.util';

export type ShiftUpdateCurrentDetails = {
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string | null;
  shiftConfirmationNotes: string;
  centreNotes: string;
};

function renderCurrentDetailsText(details: ShiftUpdateCurrentDetails): string[] {
  const lines = [
    `Date: ${formatShiftAssignmentDateLabel(details.shiftDate)}`,
    `Time: ${formatShiftAssignmentTimeRange(details.startTime, details.endTime)}`,
  ];
  if (details.roleNeeded) lines.push(`Role: ${details.roleNeeded}`);
  const notes = details.shiftConfirmationNotes.trim();
  if (notes) lines.push(`Shift Notes: ${notes}`);
  const centreNotes = details.centreNotes.trim();
  if (centreNotes) lines.push(`Centre Rules, Policies, and Notes: ${centreNotes}`);
  return lines;
}

function renderCurrentDetailsHtml(details: ShiftUpdateCurrentDetails): string {
  const lines = renderCurrentDetailsText(details);
  return lines
    .map((line) => {
      const [label, ...rest] = line.split(': ');
      const value = rest.join(': ');
      return `<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>${escapeShiftAssignmentEmailHtml(label ?? '')}:</strong> ${escapeShiftAssignmentEmailHtml(value)}</td></tr>`;
    })
    .join('');
}

export function buildShiftUpdateCarerEmailContent(params: {
  centreName: string;
  includedChanges: ShiftCommunicationChange[];
  currentDetails?: ShiftUpdateCurrentDetails;
}) {
  const subject = `Shift update at ${params.centreName}`;
  const formatted = params.includedChanges.map((change) => formatChangeForUpdateEmail(change));

  const changeText =
    formatted.length > 0
      ? formatted.map((item) => item.textLine)
      : ['The shift details below reflect the latest information.'];

  const detailsText = params.currentDetails
    ? ['', 'Updated shift details', ...renderCurrentDetailsText(params.currentDetails)]
    : [];

  const text = [
    `There has been an update to your upcoming Shift at ${params.centreName}.`,
    '',
    'What changed',
    ...changeText,
    ...detailsText,
  ].join('\n');

  const changeHtml =
    formatted.length > 0
      ? formatted.map((item) => item.htmlBlock).join('')
      : `<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;">The shift details below reflect the latest information.</td></tr>`;

  const detailsHtml = params.currentDetails
    ? `<tr><td style="padding-top:20px;font-size:16px;font-weight:600;color:#111;">Updated shift details</td></tr>${renderCurrentDetailsHtml(params.currentDetails)}`
    : '';

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift update</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">There has been an update to your upcoming Shift at ${escapeShiftAssignmentEmailHtml(params.centreName)}.</td></tr>
        <tr><td style="padding-top:20px;font-size:16px;font-weight:600;color:#111;">What changed</td></tr>
        ${changeHtml}
        ${detailsHtml}`);

  return { subject, html, text };
}

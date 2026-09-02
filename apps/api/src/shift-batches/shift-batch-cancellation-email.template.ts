import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from '../shifts/shift-assignment-notification.util';
import {
  formatShiftAssignmentDateLabel,
  formatShiftAssignmentTimeRange,
} from '../shifts/shift-assignment-display.util';
import { normalizeShiftRoleNeeded } from '../shifts/shift-assignment-display.util';

export type BatchCancellationShiftBlock = {
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string | null;
};

function renderShiftBlockText(block: BatchCancellationShiftBlock, index: number): string {
  const dateLabel = formatShiftAssignmentDateLabel(block.shiftDate);
  const timeLabel = formatShiftAssignmentTimeRange(block.startTime, block.endTime);
  const role = normalizeShiftRoleNeeded(block.roleNeeded);
  return [
    `Shift ${index + 1}`,
    `Date: ${dateLabel}`,
    `Time: ${timeLabel}`,
    role ? `Role: ${role}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function renderShiftBlockHtml(block: BatchCancellationShiftBlock, index: number, withSeparator: boolean) {
  const dateLabel = formatShiftAssignmentDateLabel(block.shiftDate);
  const timeLabel = formatShiftAssignmentTimeRange(block.startTime, block.endTime);
  const role = normalizeShiftRoleNeeded(block.roleNeeded);
  const separator = withSeparator
    ? `<tr><td style="padding-top:20px;border-top:1px solid #e5e7eb;"></td></tr>`
    : '';
  const roleRow = role
    ? `<tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>Role:</strong> ${escapeShiftAssignmentEmailHtml(role)}</td></tr>`
    : '';
  return `${separator}
        <tr><td style="padding-top:${withSeparator ? '20px' : '16px'};font-size:15px;font-weight:600;color:#111;">Shift ${index + 1}</td></tr>
        <tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>Date:</strong> ${escapeShiftAssignmentEmailHtml(dateLabel)}</td></tr>
        <tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>Time:</strong> ${escapeShiftAssignmentEmailHtml(timeLabel)}</td></tr>
        ${roleRow}`;
}

export function buildBatchCancellationCentreEmailContent(params: {
  centreName: string;
  shifts: BatchCancellationShiftBlock[];
  cancellationReason?: string | null;
}) {
  const subject = `Batch shift request cancelled — ${params.centreName}`;
  const reasonLine =
    params.cancellationReason?.trim() &&
    !params.cancellationReason.toLowerCase().includes('internal')
      ? params.cancellationReason.trim()
      : null;

  const textBlocks = params.shifts.map((shift, index) => renderShiftBlockText(shift, index));
  const text = [
    'Batch shift request cancelled',
    '',
    `The shift request for ${params.centreName} has been cancelled.`,
    ...(reasonLine ? ['', `Reason: ${reasonLine}`] : []),
    '',
    'Cancelled shifts:',
    '',
    ...textBlocks.flatMap((block, index) => (index === 0 ? [block] : ['', '---', '', block])),
  ].join('\n');

  const shiftHtml = params.shifts
    .map((shift, index) => renderShiftBlockHtml(shift, index, index > 0))
    .join('');
  const reasonHtml = reasonLine
    ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;"><strong>Reason:</strong> ${escapeShiftAssignmentEmailHtml(reasonLine)}</td></tr>`
    : '';

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Batch shift request cancelled</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">The shift request for ${escapeShiftAssignmentEmailHtml(params.centreName)} has been cancelled.</td></tr>
        ${reasonHtml}
        <tr><td style="padding-top:16px;font-size:15px;font-weight:600;color:#111;">Cancelled shifts</td></tr>
        ${shiftHtml}`);

  return { subject, html, text };
}

export function buildBatchCancellationCarerEmailContent(params: {
  centreName: string;
  shifts: BatchCancellationShiftBlock[];
}) {
  const subject =
    params.shifts.length === 1
      ? `Shift cancelled — ${params.centreName} — ${formatShiftAssignmentDateLabel(params.shifts[0]!.shiftDate)}`
      : `Shifts cancelled — ${params.centreName}`;

  const textBlocks = params.shifts.map((shift, index) =>
    [
      renderShiftBlockText(shift, index),
      `Centre: ${params.centreName}`,
    ].join('\n'),
  );

  const text = [
    params.shifts.length === 1 ? 'Shift cancelled' : 'Shifts cancelled',
    '',
    'The following requested shift(s) have been cancelled.',
    '',
    ...textBlocks.flatMap((block, index) => (index === 0 ? [block] : ['', '---', '', block])),
  ].join('\n');

  const shiftHtml = params.shifts
    .map((shift, index) => {
      const inner = renderShiftBlockHtml(shift, index, index > 0);
      return `${inner}
        <tr><td style="padding-top:8px;font-size:15px;line-height:1.5;color:#333;"><strong>Centre:</strong> ${escapeShiftAssignmentEmailHtml(params.centreName)}</td></tr>`;
    })
    .join('');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">${params.shifts.length === 1 ? 'Shift cancelled' : 'Shifts cancelled'}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">The following requested shift(s) have been cancelled.</td></tr>
        ${shiftHtml}`);

  return { subject, html, text };
}

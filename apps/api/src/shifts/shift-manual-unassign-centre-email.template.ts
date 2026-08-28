import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from './shift-assignment-notification.util';

export function buildShiftManualUnassignCentreEmailContent(params: { carerLegalName: string }) {
  const subject = 'Shift assignment update';
  const message = `${params.carerLegalName} has been unassigned from this Shift request. Intra is now working to assign a new Carer as soon as possible.`;
  const text = [message, '', '— Intra'].join('\n');
  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Shift assignment update</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">${escapeShiftAssignmentEmailHtml(message)}</td></tr>`);

  return { subject, html, text };
}

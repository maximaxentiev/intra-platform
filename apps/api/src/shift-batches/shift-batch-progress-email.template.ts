import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from '../shifts/shift-assignment-notification.util';

export function buildBatchProgress70EmailContent(params: {
  centreName: string;
  fulfilledCount: number;
  activeTotal: number;
}) {
  const subject = 'Update on your upcoming Intra shift request';
  const progressLine = `${params.fulfilledCount} of ${params.activeTotal} active shifts have been filled.`;

  const text = [
    'Update on your upcoming shift request',
    '',
    `Intra is close to completing ${params.centreName}'s upcoming shift request.`,
    '',
    progressLine,
    '',
    'Our team is continuing to fill the remaining shifts.',
    '',
    'Once the full request is ready, Intra will send a final confirmation with shift assignments and Carer document links.',
  ].join('\n');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Update on your upcoming shift request</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">Intra is close to completing ${escapeShiftAssignmentEmailHtml(params.centreName)}&rsquo;s upcoming shift request.</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;"><strong>Progress:</strong> ${escapeShiftAssignmentEmailHtml(progressLine)}</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">Our team is continuing to fill the remaining shifts.</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">Once the full request is ready, Intra will send a final confirmation with shift assignments and Carer document links.</td></tr>`);

  return { subject, html, text };
}

export function batchProgress70EmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}\n${content.html}`.toLowerCase();
  const forbidden = [
    'internal comment',
    'confirmationnotes',
    'shift notes',
    '/documents/',
    'secure document',
    'legacy notes',
    'staffpoint',
  ];
  return forbidden.every((term) => !blob.includes(term));
}

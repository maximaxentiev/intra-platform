import { buildCarerDocumentsLink } from '../config/platform-email-links';
import type { PlatformUrlEnv } from '../config/platform-url';
import {
  escapeShiftAssignmentEmailHtml,
  wrapShiftAssignmentEmailHtml,
} from '../shifts/shift-assignment-notification.util';
import type { StaffDocumentType } from './staff-document.constants';
import type { DocumentExpiryReminderOffsetDays } from './document-expiry-reminder.types';

const DOCUMENT_DISPLAY_NAMES: Record<'vulnerable_sector_check' | 'first_aid_cpr', string> = {
  vulnerable_sector_check: 'Vulnerable Sector Check',
  first_aid_cpr: 'First Aid & CPR certification',
};

function formatExpiryDateLabel(expiryDate: string): string {
  const [y, m, d] = expiryDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function subjectForOffset(
  documentType: 'vulnerable_sector_check' | 'first_aid_cpr',
  offsetDays: DocumentExpiryReminderOffsetDays,
): string {
  const name =
    documentType === 'vulnerable_sector_check'
      ? 'Vulnerable Sector Check'
      : 'First Aid & CPR certification';

  switch (offsetDays) {
    case 30:
      return `Your ${name} expires in 30 days`;
    case 14:
      return documentType === 'first_aid_cpr'
        ? 'Your First Aid & CPR certification expires in 2 weeks'
        : 'Your Vulnerable Sector Check expires in 2 weeks';
    case 7:
      return `Your ${name} expires in 1 week`;
    case 3:
      return documentType === 'first_aid_cpr'
        ? 'Your First Aid & CPR certification expires in 3 days'
        : 'Your Vulnerable Sector Check expires in 3 days';
    case 1:
      return `Your ${name} expires tomorrow`;
  }
}

function timeRemainingLabel(offsetDays: DocumentExpiryReminderOffsetDays): string {
  switch (offsetDays) {
    case 30:
      return '30 days';
    case 14:
      return '2 weeks';
    case 7:
      return '1 week';
    case 3:
      return '3 days';
    case 1:
      return '1 day';
  }
}

export function buildDocumentExpiryCarerEmailContent(params: {
  carerName: string;
  documentType: 'vulnerable_sector_check' | 'first_aid_cpr';
  expiryDate: string;
  offsetDays: DocumentExpiryReminderOffsetDays;
  platformEnv: PlatformUrlEnv;
}) {
  const documentName = DOCUMENT_DISPLAY_NAMES[params.documentType];
  const expiryLabel = formatExpiryDateLabel(params.expiryDate);
  const subject = subjectForOffset(params.documentType, params.offsetDays);
  const remaining = timeRemainingLabel(params.offsetDays);
  const documentsUrl = buildCarerDocumentsLink(params.platformEnv);

  const text = [
    'Document expiry reminder',
    '',
    `Hi ${params.carerName},`,
    '',
    `Your ${documentName} expires on ${expiryLabel} (${remaining} from now).`,
    '',
    'Please upload an updated document before it expires to avoid affecting your eligibility for future shifts.',
    '',
    'Update my documents:',
    documentsUrl,
  ].join('\n');

  const html = wrapShiftAssignmentEmailHtml(`
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Document expiry reminder</td></tr>
        <tr><td style="padding-top:16px;font-size:15px;line-height:1.5;color:#333;">Hi ${escapeShiftAssignmentEmailHtml(params.carerName)},</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">Your <strong>${escapeShiftAssignmentEmailHtml(documentName)}</strong> expires on <strong>${escapeShiftAssignmentEmailHtml(expiryLabel)}</strong> (${escapeShiftAssignmentEmailHtml(remaining)} from now).</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">Please upload an updated document before it expires to avoid affecting your eligibility for future shifts.</td></tr>
        <tr><td style="padding-top:24px;" align="center">
          <a href="${escapeShiftAssignmentEmailHtml(documentsUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">Update my documents</a>
        </td></tr>`);

  return { subject, html, text };
}

export function documentExpiryEmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}`.toLowerCase();
  const forbidden = ['storage', 'share token', '/documents/files/'];
  return forbidden.every((term) => !blob.includes(term));
}

export function resolveDocumentDisplayName(documentType: StaffDocumentType): string | null {
  if (documentType === 'vulnerable_sector_check' || documentType === 'first_aid_cpr') {
    return DOCUMENT_DISPLAY_NAMES[documentType];
  }
  return null;
}

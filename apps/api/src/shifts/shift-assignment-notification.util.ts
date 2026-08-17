import { EmailDeliveryError } from '../email/email.service';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SHIFT_ASSIGNMENT_SKIP_REASON = {
  noCentrePrimaryContact: 'no_centre_primary_contact',
  noCentreEmail: 'no_centre_email',
  invalidCentreEmail: 'invalid_centre_email',
  noCarerEmail: 'no_carer_email',
  invalidCarerEmail: 'invalid_carer_email',
  documentShareUnavailable: 'document_share_unavailable',
  emailNotConfigured: 'email_not_configured',
} as const;

export type ShiftAssignmentSkipReason =
  (typeof SHIFT_ASSIGNMENT_SKIP_REASON)[keyof typeof SHIFT_ASSIGNMENT_SKIP_REASON];

export function isValidNotificationEmail(email: string): boolean {
  const normalized = email.trim();
  if (!normalized || normalized.length > 320) return false;
  return EMAIL_RE.test(normalized);
}

export function normalizeNotificationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeNotificationFailure(err: unknown): { code: string; reason: string } {
  if (err instanceof EmailDeliveryError) {
    const reason = err.message.replace(/token|secret|password|api[_-]?key/gi, '[redacted]').slice(0, 200);
    return { code: 'delivery_failed', reason };
  }
  return { code: 'send_failed', reason: 'Confirmation email could not be sent.' };
}

export function escapeShiftAssignmentEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wrapShiftAssignmentEmailHtml(bodyRows: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f6f6f8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f8;padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:28px 24px;">
        ${bodyRows}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

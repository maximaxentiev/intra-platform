import { EmailDeliveryError } from '../email/email.service';
import { wrapIntraEmailHtml } from '../email/platform-email-branding.util';
import { buildIntraEmailLogoUrl } from '../config/platform-email-links';
import type { PlatformUrlEnv } from '../config/platform-url';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SHIFT_ASSIGNMENT_SKIP_REASON = {
  noCentrePrimaryContact: 'no_centre_primary_contact',
  noCentreEmail: 'no_centre_email',
  invalidCentreEmail: 'invalid_centre_email',
  noCarerEmail: 'no_carer_email',
  invalidCarerEmail: 'invalid_carer_email',
  documentShareUnavailable: 'document_share_unavailable',
  emailNotConfigured: 'email_not_configured',
  deferredBatchConfirmation: 'deferred_batch_confirmation',
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

export function wrapShiftAssignmentEmailHtml(
  bodyRows: string,
  logoUrl?: string,
  env: PlatformUrlEnv = process.env as PlatformUrlEnv,
): string {
  const resolvedLogoUrl = logoUrl ?? buildIntraEmailLogoUrl(env);
  return wrapIntraEmailHtml(bodyRows, resolvedLogoUrl);
}

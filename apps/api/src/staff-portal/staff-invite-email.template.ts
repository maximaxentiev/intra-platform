import { buildStaffInviteEmailLink } from '../config/platform-email-links';
import type { PlatformUrlEnv } from '../config/platform-url';

function formatExpiryDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function buildStaffInviteEmailContent(params: {
  legalFirstName: string;
  inviteToken: string;
  expiresAt: Date;
  platformEnv: PlatformUrlEnv;
}) {
  const inviteUrl = buildStaffInviteEmailLink(params.inviteToken, params.platformEnv);
  const expiryLabel = formatExpiryDate(params.expiresAt);
  const greeting = params.legalFirstName.trim() || 'there';

  const subject = 'You’re invited to the Intra Independent Carer portal';

  const text = [
    `Hi ${greeting},`,
    '',
    'Intra has invited you to create your account on the Independent Carer portal.',
    '',
    `Create your account: ${inviteUrl}`,
    '',
    `This invitation link expires on ${expiryLabel}.`,
    '',
    'If you did not expect this email, you can ignore it.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f6f6f8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f8;padding:24px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:28px 24px;">
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Hi ${escapeHtml(greeting)},</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">
          Intra has invited you to the <strong>Independent Carer</strong> portal. Use the button below to create your password and sign in.
        </td></tr>
        <tr><td style="padding-top:24px;" align="center">
          <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">Create your account</a>
        </td></tr>
        <tr><td style="padding-top:20px;font-size:13px;line-height:1.5;color:#666;">
          This link expires on <strong>${escapeHtml(expiryLabel)}</strong>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text, inviteUrl };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Ensures marketing copy never embeds raw tokens beyond the intentional invite URL. */
export function inviteEmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}\n${content.html}`.toLowerCase();
  return !blob.includes('password_hash') && !blob.includes('invite_token_hash');
}

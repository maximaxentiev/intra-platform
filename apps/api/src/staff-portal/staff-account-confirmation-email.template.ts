import { buildGenericPlatformEmailLink } from '../config/platform-email-links';
import type { PlatformUrlEnv } from '../config/platform-url';

export function buildStaffAccountConfirmationEmailContent(params: {
  legalFirstName: string;
  platformEnv: PlatformUrlEnv;
}) {
  const loginUrl = buildGenericPlatformEmailLink('/carer/login', params.platformEnv);
  const greeting = params.legalFirstName.trim() || 'there';

  const subject = 'Your Intra Carer Portal account is ready';

  const text = [
    `Hi ${greeting},`,
    '',
    'Your Independent Carer Portal account has been created successfully.',
    '',
    `Sign in to the Carer Portal: ${loginUrl}`,
    '',
    'Use this link whenever you need to sign in to your carer account.',
    '',
    'Once the Carer Portal is publicly launched, you’ll also be able to access it from intra.ca by selecting Login in the main navigation and then choosing Carer Portal.',
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
          Your <strong>Independent Carer Portal</strong> account has been created successfully.
        </td></tr>
        <tr><td style="padding-top:24px;" align="center">
          <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">Sign in to Carer Portal</a>
        </td></tr>
        <tr><td style="padding-top:20px;font-size:13px;line-height:1.5;color:#666;">
          Bookmark this sign-in page for future access: <a href="${escapeHtml(loginUrl)}" style="color:#111;">${escapeHtml(loginUrl)}</a>
        </td></tr>
        <tr><td style="padding-top:16px;font-size:13px;line-height:1.5;color:#666;">
          Once the Carer Portal is publicly launched, you’ll also be able to access it from intra.ca by selecting Login in the main navigation and then choosing Carer Portal.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text, loginUrl };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Ensures confirmation email never embeds secrets or invite tokens. */
export function accountConfirmationEmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}\n${content.html}`.toLowerCase();
  return (
    !blob.includes('password') &&
    !blob.includes('invite') &&
    !blob.includes('token') &&
    !blob.includes('password_hash')
  );
}

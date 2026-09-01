import { buildStaffPasswordResetEmailLink, buildIntraEmailLogoUrl } from '../config/platform-email-links';
import { wrapIntraEmailHtml } from '../email/platform-email-branding.util';
import type { PlatformUrlEnv } from '../config/platform-url';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildStaffPasswordResetEmailContent(params: {
  resetToken: string;
  platformEnv: PlatformUrlEnv;
}) {
  const resetUrl = buildStaffPasswordResetEmailLink(params.resetToken, params.platformEnv);
  const logoUrl = buildIntraEmailLogoUrl(params.platformEnv);

  const subject = 'Reset your Intra password';

  const text = [
    'Hi,',
    '',
    'We received a request to reset the password for your Intra Independent Carer portal account.',
    '',
    `Reset password: ${resetUrl}`,
    '',
    'This link expires in 60 minutes.',
    '',
    'If you did not request a password reset, you can ignore this email.',
  ].join('\n');

  const bodyRows = `
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Reset your password</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">
          We received a request to reset the password for your Intra Independent Carer portal account.
        </td></tr>
        <tr><td style="padding-top:24px;" align="center">
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">Reset password</a>
        </td></tr>
        <tr><td style="padding-top:20px;font-size:13px;line-height:1.5;color:#666;">
          This link expires in <strong>60 minutes</strong>. If you did not request a password reset, you can ignore this email.
        </td></tr>`;

  const html = wrapIntraEmailHtml(bodyRows, logoUrl);

  return { subject, html, text, resetUrl };
}

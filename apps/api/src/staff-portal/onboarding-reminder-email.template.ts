import { buildGenericPlatformEmailLink } from '../config/platform-email-links';
import { buildIntraEmailLogoUrl } from '../config/platform-email-links';
import { wrapIntraEmailHtml } from '../email/platform-email-branding.util';
import type { PlatformUrlEnv } from '../config/platform-url';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOnboardingReminderEmailContent(params: {
  legalFirstName: string;
  platformEnv: PlatformUrlEnv;
}) {
  const greeting = params.legalFirstName.trim() || 'there';
  const portalUrl = buildGenericPlatformEmailLink('/carer/login', params.platformEnv);
  const logoUrl = buildIntraEmailLogoUrl(params.platformEnv);
  const subject = 'Complete your Intra onboarding';

  const text = [
    `Hi ${greeting},`,
    '',
    'Your Intra onboarding is not complete yet. Until onboarding is finished, you will not be able to receive Shift opportunities through Intra.',
    '',
    'It usually takes about 5–10 minutes to finish.',
    '',
    'Complete onboarding:',
    portalUrl,
  ].join('\n');

  const bodyRows = `
        <tr><td style="font-size:18px;font-weight:600;color:#111;">Hi ${escapeHtml(greeting)},</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">
          Your Intra onboarding is not complete yet. Until onboarding is finished, you won&apos;t be able to receive Shift opportunities through Intra.
        </td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#333;">
          It usually takes about 5–10 minutes to finish.
        </td></tr>
        <tr><td style="padding-top:24px;" align="center">
          <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:8px;">Complete onboarding</a>
        </td></tr>`;

  const html = wrapIntraEmailHtml(bodyRows, logoUrl);

  return { subject, html, text, portalUrl };
}

export function onboardingReminderEmailContainsNoSensitiveInternals(content: {
  html: string;
  text: string;
  subject: string;
}) {
  const blob = `${content.subject}\n${content.text}\n${content.html}`.toLowerCase();
  const forbidden = ['internal_ops', 'centre', 'shift date', 'batch'];
  return forbidden.every((term) => !blob.includes(term));
}

import { escapeShiftAssignmentEmailHtml } from '../shifts/shift-assignment-notification.util';

export const INTRA_EMAIL_SIGN_OFF_PLAIN = 'Very best,\nThe Intra team';
export const INTRA_EMAIL_LOGO_ALT = 'Intra';
export const INTRA_EMAIL_BRANDING_ATTR = 'data-intra-email-branding="1"';

export function buildIntraEmailSignOffHtmlRows(): string {
  return `<tr><td style="padding-top:28px;font-size:15px;line-height:1.5;color:#333;">Very best,<br/>The Intra team</td></tr>`;
}

export function buildIntraEmailLogoHeaderHtmlRows(logoUrl: string): string {
  const safeUrl = escapeShiftAssignmentEmailHtml(logoUrl);
  return `<tr><td align="center" style="padding-bottom:24px;background:#ffffff;">
    <img src="${safeUrl}" alt="${INTRA_EMAIL_LOGO_ALT}" width="120" style="display:block;max-width:120px;width:120px;height:auto;border:0;outline:none;text-decoration:none;" />
  </td></tr>`;
}

/** Append canonical sign-off to plain-text bodies (idempotent). */
export function appendIntraEmailSignOffText(text: string): string {
  const trimmed = text.trimEnd();
  if (trimmed.includes('Very best,') && trimmed.includes('The Intra team')) {
    return text;
  }
  return `${trimmed}\n\n${INTRA_EMAIL_SIGN_OFF_PLAIN}`;
}

export function wrapIntraEmailHtml(bodyRows: string, logoUrl: string): string {
  if (bodyRows.trimStart().startsWith('<!DOCTYPE')) {
    return bodyRows;
  }

  const logoRows = buildIntraEmailLogoHeaderHtmlRows(logoUrl);
  const signOffRows = buildIntraEmailSignOffHtmlRows();

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f6f6f8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f8;padding:24px 16px;" ${INTRA_EMAIL_BRANDING_ATTR}>
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:28px 24px;">
        ${logoRows}
        ${bodyRows}
        ${signOffRows}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function htmlAlreadyHasIntraBranding(html: string): boolean {
  return html.includes(INTRA_EMAIL_BRANDING_ATTR) || html.includes(`alt="${INTRA_EMAIL_LOGO_ALT}"`);
}

export function countIntraEmailBranding(html: string): { logos: number; signOffs: number } {
  const logos = (html.match(new RegExp(`alt="${INTRA_EMAIL_LOGO_ALT}"`, 'g')) ?? []).length;
  const signOffs = (html.match(/Very best,/g) ?? []).length;
  return { logos, signOffs };
}

export function emailHtmlHasSingleIntraBranding(html: string): boolean {
  const { logos, signOffs } = countIntraEmailBranding(html);
  return logos === 1 && signOffs === 1;
}

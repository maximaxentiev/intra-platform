import { describe, expect, it } from 'vitest';
import {
  appendIntraEmailSignOffText,
  emailHtmlHasSingleIntraBranding,
  wrapIntraEmailHtml,
} from './platform-email-branding.util';
import { wrapShiftAssignmentEmailHtml } from '../shifts/shift-assignment-notification.util';

const LOGO_URL = 'https://platform.intra.ca/intra-logo-purple.png';

describe('platform email branding', () => {
  it('wraps HTML with exactly one logo and sign-off', () => {
    const html = wrapIntraEmailHtml(
      `<tr><td style="font-size:15px;color:#333;">Hello</td></tr>`,
      LOGO_URL,
    );
    expect(emailHtmlHasSingleIntraBranding(html)).toBe(true);
    expect(html).toContain('alt="Intra"');
    expect(html).toContain('Very best,');
    expect(html).toContain('The Intra team');
  });

  it('does not double-wrap full HTML documents', () => {
    const wrapped = wrapIntraEmailHtml(`<tr><td>Body</td></tr>`, LOGO_URL);
    const again = wrapIntraEmailHtml(wrapped, LOGO_URL);
    expect(again).toBe(wrapped);
  });

  it('shift assignment wrapper includes branding', () => {
    const html = wrapShiftAssignmentEmailHtml(
      `<tr><td style="font-size:15px;color:#333;">Assignment</td></tr>`,
      LOGO_URL,
    );
    expect(emailHtmlHasSingleIntraBranding(html)).toBe(true);
  });

  it('appendIntraEmailSignOffText is idempotent', () => {
    const once = appendIntraEmailSignOffText('Hello');
    const twice = appendIntraEmailSignOffText(once);
    expect(twice).toBe(once);
    expect(once).toContain('Very best,');
    expect(once).toContain('The Intra team');
  });
});

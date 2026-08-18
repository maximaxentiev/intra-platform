import { describe, expect, it } from 'vitest';
import {
  buildDocumentExpiryCarerEmailContent,
  documentExpiryEmailContainsNoSensitiveInternals,
} from './document-expiry-carer-email.template';

describe('document expiry carer email template', () => {
  it('includes document name, expiry date, interval wording, and documents CTA', () => {
    const content = buildDocumentExpiryCarerEmailContent({
      carerName: 'Alex Carer',
      documentType: 'vulnerable_sector_check',
      expiryDate: '2026-12-01',
      offsetDays: 30,
      platformEnv: { APP_PUBLIC_URL: 'https://app.example.test', NODE_ENV: 'test' },
    });

    expect(content.subject).toContain('30 days');
    expect(content.text).toContain('Vulnerable Sector Check');
    expect(content.text).toContain('December 1, 2026');
    expect(content.text).toContain('Update my documents');
    expect(content.html).toContain('https://app.example.test/carer/documents');
    expect(content.text).toContain('eligibility for future shifts');
    expect(documentExpiryEmailContainsNoSensitiveInternals(content)).toBe(true);
  });

  it('uses tomorrow wording for 1-day reminder', () => {
    const content = buildDocumentExpiryCarerEmailContent({
      carerName: 'Alex Carer',
      documentType: 'first_aid_cpr',
      expiryDate: '2026-12-01',
      offsetDays: 1,
      platformEnv: { APP_PUBLIC_URL: 'https://app.example.test', NODE_ENV: 'test' },
    });
    expect(content.subject).toContain('tomorrow');
  });
});

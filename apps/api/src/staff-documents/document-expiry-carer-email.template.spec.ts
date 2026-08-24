import { describe, expect, it } from 'vitest';
import {
  buildDocumentExpiryCarerEmailContent,
  documentExpiryEmailContainsNoSensitiveInternals,
} from './document-expiry-carer-email.template';

describe('document expiry carer email template', () => {
  it('includes document name, expiry date, interval wording, and documents CTA for VSC', () => {
    const content = buildDocumentExpiryCarerEmailContent({
      carerName: 'Alex Carer',
      documentType: 'vulnerable_sector_check',
      expiryDate: '2026-12-01',
      timing: { unit: 'days', offsetDays: 30 },
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

  it('uses tomorrow wording for VSC 1-day reminder', () => {
    const content = buildDocumentExpiryCarerEmailContent({
      carerName: 'Alex Carer',
      documentType: 'vulnerable_sector_check',
      expiryDate: '2026-12-01',
      timing: { unit: 'days', offsetDays: 1 },
      platformEnv: { APP_PUBLIC_URL: 'https://app.example.test', NODE_ENV: 'test' },
    });
    expect(content.subject).toContain('tomorrow');
  });

  it('uses month wording for First Aid monthly reminders', () => {
    const threeMonth = buildDocumentExpiryCarerEmailContent({
      carerName: 'Alex Carer',
      documentType: 'first_aid_cpr',
      expiryDate: '2027-11-30',
      timing: { unit: 'months', offsetMonths: 3 },
      platformEnv: { APP_PUBLIC_URL: 'https://app.example.test', NODE_ENV: 'test' },
    });
    expect(threeMonth.subject).toContain('3 months');
    expect(threeMonth.text).toContain('3 months from now');

    const oneMonth = buildDocumentExpiryCarerEmailContent({
      carerName: 'Alex Carer',
      documentType: 'first_aid_cpr',
      expiryDate: '2027-11-30',
      timing: { unit: 'months', offsetMonths: 1 },
      platformEnv: { APP_PUBLIC_URL: 'https://app.example.test', NODE_ENV: 'test' },
    });
    expect(oneMonth.subject).toContain('1 month');
    expect(oneMonth.text).toContain('1 month from now');
  });
});

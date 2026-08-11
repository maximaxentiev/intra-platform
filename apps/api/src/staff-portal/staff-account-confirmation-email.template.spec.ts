import { describe, expect, it } from 'vitest';
import {
  accountConfirmationEmailContainsNoSensitiveInternals,
  buildStaffAccountConfirmationEmailContent,
} from './staff-account-confirmation-email.template';

const platformEnv = {
  APP_PUBLIC_URL: 'https://platform.intra.ca',
  LEGACY_APP_HOST: 'ops-test.intra.ca',
  NODE_ENV: 'production',
};

describe('staff account confirmation email', () => {
  it('uses APP_PUBLIC_URL carer login path', () => {
    const content = buildStaffAccountConfirmationEmailContent({
      legalFirstName: 'Sam',
      platformEnv,
    });
    expect(content.loginUrl).toBe('https://platform.intra.ca/carer/login');
    expect(content.html).toContain('https://platform.intra.ca/carer/login');
    expect(content.text).toContain('https://platform.intra.ca/carer/login');
  });

  it('greets by legal first name', () => {
    const content = buildStaffAccountConfirmationEmailContent({
      legalFirstName: 'Jordan',
      platformEnv,
    });
    expect(content.text).toMatch(/Hi Jordan,/);
    expect(content.subject).toBe('Your Intra Carer Portal account is ready');
  });

  it('contains no token or password references', () => {
    const content = buildStaffAccountConfirmationEmailContent({
      legalFirstName: 'A',
      platformEnv,
    });
    expect(accountConfirmationEmailContainsNoSensitiveInternals(content)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { buildStaffPasswordResetEmailContent } from './staff-password-reset-email.template';

const platformEnv = {
  APP_PUBLIC_URL: 'https://platform.intra.ca',
  LEGACY_APP_HOST: 'ops-test.intra.ca',
  NODE_ENV: 'production',
};

describe('staff password reset email', () => {
  it('uses platform.intra.ca reset path', () => {
    const content = buildStaffPasswordResetEmailContent({
      resetToken: 'test-reset-token',
      platformEnv,
    });
    expect(content.resetUrl).toBe(
      'https://platform.intra.ca/carer/reset-password/test-reset-token',
    );
    expect(content.html).toContain('platform.intra.ca/carer/reset-password/');
    expect(content.text).toContain('platform.intra.ca/carer/reset-password/');
  });

  it('states 60-minute expiry and reset subject', () => {
    const content = buildStaffPasswordResetEmailContent({
      resetToken: 'tok',
      platformEnv,
    });
    expect(content.subject).toBe('Reset your Intra password');
    expect(content.text).toContain('60 minutes');
    expect(content.html).toContain('60 minutes');
  });

  it('does not embed internal field names', () => {
    const content = buildStaffPasswordResetEmailContent({
      resetToken: 'visible-only-in-url',
      platformEnv,
    });
    const blob = `${content.subject}\n${content.text}\n${content.html}`.toLowerCase();
    expect(blob).not.toContain('password_reset_token_hash');
    expect(blob).not.toContain('password_hash');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildStaffInviteEmailContent,
  inviteEmailContainsNoSensitiveInternals,
} from './staff-invite-email.template';

const platformEnv = {
  APP_PUBLIC_URL: 'https://platform.intra.ca',
  LEGACY_APP_HOST: 'ops-test.intra.ca',
  NODE_ENV: 'production',
};

describe('staff invite email', () => {
  it('uses platform.intra.ca invite path', () => {
    const content = buildStaffInviteEmailContent({
      legalFirstName: 'Sam',
      inviteToken: 'test-invite-token',
      expiresAt: new Date('2030-01-15T00:00:00Z'),
      platformEnv,
    });
    expect(content.inviteUrl).toBe('https://platform.intra.ca/carer/invite/test-invite-token');
    expect(content.html).toContain('platform.intra.ca/carer/invite/');
    expect(content.text).toContain('platform.intra.ca/carer/invite/');
  });

  it('addresses carer by legal first name', () => {
    const content = buildStaffInviteEmailContent({
      legalFirstName: 'Jordan',
      inviteToken: 'tok',
      expiresAt: new Date('2030-06-01T00:00:00Z'),
      platformEnv,
    });
    expect(content.text).toMatch(/Hi Jordan,/);
    expect(content.html).toContain('Hi Jordan');
  });

  it('contains no raw internal field names', () => {
    const content = buildStaffInviteEmailContent({
      legalFirstName: 'A',
      inviteToken: 'visible-only-in-url',
      expiresAt: new Date('2030-06-01T00:00:00Z'),
      platformEnv,
    });
    expect(inviteEmailContainsNoSensitiveInternals(content)).toBe(true);
    expect(content.subject.toLowerCase()).not.toContain('password_hash');
  });
});

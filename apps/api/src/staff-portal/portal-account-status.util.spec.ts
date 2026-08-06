import { describe, expect, it } from 'vitest';
import { resolvePortalAccountDisplayStatus } from './portal-account-status.util';

describe('resolvePortalAccountDisplayStatus', () => {
  it('returns no_account when missing row', () => {
    expect(resolvePortalAccountDisplayStatus(null)).toBe('no_account');
  });

  it('returns invited before password is set', () => {
    expect(
      resolvePortalAccountDisplayStatus({
        status: 'invited',
        passwordHash: null,
        onboardingCompletedAt: null,
      } as never),
    ).toBe('invited');
  });

  it('returns incomplete after password without onboarding', () => {
    expect(
      resolvePortalAccountDisplayStatus({
        status: 'incomplete',
        passwordHash: 'hash',
        onboardingCompletedAt: null,
      } as never),
    ).toBe('incomplete');
  });

  it('returns active when onboarding completed', () => {
    expect(
      resolvePortalAccountDisplayStatus({
        status: 'active',
        passwordHash: 'hash',
        onboardingCompletedAt: new Date(),
      } as never),
    ).toBe('active');
  });

  it('returns disabled regardless of password', () => {
    expect(
      resolvePortalAccountDisplayStatus({
        status: 'disabled',
        passwordHash: 'hash',
        onboardingCompletedAt: new Date(),
      } as never),
    ).toBe('disabled');
  });
});

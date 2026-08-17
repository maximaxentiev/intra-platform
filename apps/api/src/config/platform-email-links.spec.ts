import { describe, expect, it } from 'vitest';
import {
  buildCarerShiftDetailLink,
  buildEmailVerificationLink,
  buildPasswordResetEmailLink,
  buildStaffInviteEmailLink,
} from './platform-email-links';

const prodEnv = {
  APP_PUBLIC_URL: 'https://platform.intra.ca',
  LEGACY_APP_HOST: 'ops-test.intra.ca',
  NODE_ENV: 'production',
};

describe('production email links', () => {
  it('uses platform.intra.ca for verification', () => {
    expect(buildEmailVerificationLink('abc', prodEnv)).toBe(
      'https://platform.intra.ca/auth/verify-email?token=abc',
    );
  });

  it('uses platform.intra.ca for password reset', () => {
    expect(buildPasswordResetEmailLink('reset', prodEnv)).toBe(
      'https://platform.intra.ca/auth/reset-password?token=reset',
    );
  });

  it('uses platform.intra.ca for staff invite', () => {
    expect(buildStaffInviteEmailLink('inv', prodEnv)).toBe(
      'https://platform.intra.ca/carer/invite/inv',
    );
  });

  it('uses platform.intra.ca for carer shift detail', () => {
    expect(buildCarerShiftDetailLink('shift-1', prodEnv)).toBe(
      'https://platform.intra.ca/carer/shifts/shift-1',
    );
  });

  it('rejects legacy host as APP_PUBLIC_URL in production email links', () => {
    expect(() =>
      buildEmailVerificationLink('x', {
        APP_PUBLIC_URL: 'https://ops-test.intra.ca',
        LEGACY_APP_HOST: 'ops-test.intra.ca',
        NODE_ENV: 'production',
      }),
    ).toThrow(/legacy/);
  });
});

describe('development email links', () => {
  it('allows localhost paths in dev', () => {
    const url = buildEmailVerificationLink('t', { NODE_ENV: 'development' });
    expect(url).toContain('localhost');
  });
});

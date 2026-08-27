import { describe, expect, it } from 'vitest';
import { opsLoginDestination, requiresForcedPasswordChange } from './ops-auth';

describe('ops forced password change routing', () => {
  it('detects forced password change only when mustChangePassword is true', () => {
    expect(requiresForcedPasswordChange({ mustChangePassword: true })).toBe(true);
    expect(requiresForcedPasswordChange({ mustChangePassword: false })).toBe(false);
    expect(requiresForcedPasswordChange({})).toBe(false);
    expect(requiresForcedPasswordChange({ mustChangePassword: undefined })).toBe(false);
  });

  it('routes forced-change users to change-password and normal users to dashboard', () => {
    expect(opsLoginDestination({ mustChangePassword: true })).toBe('/auth/change-password');
    expect(opsLoginDestination({ mustChangePassword: false })).toBe('/dashboard');
    expect(opsLoginDestination({})).toBe('/dashboard');
  });
});

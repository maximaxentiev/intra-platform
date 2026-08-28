import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { opsLoginDestination, requiresForcedPasswordChange, resolveOpsPostLoginNavigation } from './ops-auth';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), 'utf8');
}

describe('ops auth helpers', () => {
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

  it('resolves post-login navigation for temporary password users', () => {
    expect(resolveOpsPostLoginNavigation({ mustChangePassword: true })).toEqual({
      to: '/auth/change-password',
      replace: true,
    });
    expect(resolveOpsPostLoginNavigation({ mustChangePassword: false })).toEqual({
      to: '/dashboard',
      replace: true,
    });
  });
});

describe('ops login routing structure', () => {
  it('uses an auth layout with Outlet so child routes render', () => {
    const layout = readSrc('routes/auth/route.tsx');
    expect(layout).toContain('<Outlet');
    expect(layout).not.toContain('Sign in');
  });

  it('navigates immediately after login using resolveOpsPostLoginNavigation', () => {
    const login = readSrc('routes/auth/index.tsx');
    expect(login).toContain('resolveOpsPostLoginNavigation');
    expect(login).toContain('await navigate(navigation)');
    expect(login).toContain('setQueryData(["auth", "session"], user)');
    expect(login).not.toContain('useEffect');
  });

  it('keeps forced password change as a dedicated authenticated child route', () => {
    const change = readSrc('routes/auth/change-password.tsx');
    expect(change).toContain('replacePassword');
    expect(change).toContain('requiresForcedPasswordChange');
  });
});

describe('ops admin password reset UI contracts', () => {
  it('shows Reset password for admins with confirmation and success dialogs', () => {
    const users = readSrc('routes/_authenticated/users.tsx');
    expect(users).toContain('Reset password?');
    expect(users).toContain('usersApi.resetPassword');
    expect(users).toContain('Temporary password');
    expect(users).toContain('Copy password');
    expect(users).toContain('only be shown once');
    expect(users).not.toContain('localStorage');
    expect(users).not.toContain('sessionStorage');
  });

  it('routes forced password change users away from authenticated shell', () => {
    const authRoute = readSrc('routes/_authenticated/route.tsx');
    expect(authRoute).toContain('requiresForcedPasswordChange');
    expect(authRoute).toContain('/auth/change-password');
  });
});

describe('ops admin password reset client contract', () => {
  it('exposes reset and replace password API helpers', () => {
    const db = readSrc('lib/db.ts');
    expect(db).toContain('resetPassword: (id: string)');
    expect(db).toContain('/users/${id}/reset-password');
    expect(db).toContain('replacePassword');
    expect(db).toContain('/auth/replace-password');
    expect(db).toContain('mustChangePassword');
  });
});

describe('carer auth isolation', () => {
  it('does not modify carer password reset routes', () => {
    const forgot = readSrc('routes/carer/forgot-password.tsx');
    const reset = readSrc('routes/carer/reset-password.$token.tsx');
    expect(forgot).toContain('carerAuthApi.forgotPassword');
    expect(reset).toContain('carerAuthApi.resetPassword');
    expect(forgot).not.toContain('usersApi.resetPassword');
  });
});

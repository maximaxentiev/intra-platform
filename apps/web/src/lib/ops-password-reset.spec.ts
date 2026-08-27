import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), 'utf8');
}

describe('ops admin password reset UI', () => {
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
    expect(authRoute).toContain('mustChangePassword');
    expect(authRoute).toContain('/auth/change-password');
  });

  it('provides a dedicated forced password change screen', () => {
    const change = readSrc('routes/auth.change-password.tsx');
    expect(change).toContain('Create a new password');
    expect(change).toContain('replacePassword');
    expect(change).toContain('Confirm new password');
    expect(change).not.toContain('localStorage');
  });

  it('redirects login to forced change when required', () => {
    const auth = readSrc('routes/auth.tsx');
    expect(auth).toContain('mustChangePassword');
    expect(auth).toContain('/auth/change-password');
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

import { describe, expect, it } from 'vitest';
import { toOpsUserProfile } from './ops-user-profile.util';

describe('toOpsUserProfile', () => {
  const base = {
    id: 'user-1',
    email: 'ops@example.test',
    passwordHash: 'hash',
    fullName: 'Ops User',
    role: 'ops' as const,
    isActive: true,
    mustChangePassword: true,
    temporaryPasswordExpiresAt: new Date('2026-08-28T12:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  it('always exposes mustChangePassword as a boolean', () => {
    expect(toOpsUserProfile(base).mustChangePassword).toBe(true);
    expect(toOpsUserProfile({ ...base, mustChangePassword: false }).mustChangePassword).toBe(false);
  });

  it('never includes passwordHash in the public profile', () => {
    const profile = toOpsUserProfile(base);
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile.email).toBe('ops@example.test');
    expect(profile.temporaryPasswordExpiresAt).toBe('2026-08-28T12:00:00.000Z');
  });
});

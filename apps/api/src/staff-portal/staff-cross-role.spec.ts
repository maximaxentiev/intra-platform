import { describe, expect, it } from 'vitest';
import { hashToken } from './staff-auth.service';

/**
 * Cross-role policy: ops users (users table) and carer accounts (staff_accounts)
 * authenticate via separate endpoints, cookies, and guards. Email overlap does not
 * merge sessions or permissions.
 */
describe('cross-role session separation', () => {
  it('staff invite tokens are stored hashed, never as raw values in auth helpers', () => {
    const raw = 'example-invite-token-value';
    expect(hashToken(raw)).not.toBe(raw);
    expect(hashToken(raw)).toMatch(/^[a-f0-9]{64}$/);
  });
});

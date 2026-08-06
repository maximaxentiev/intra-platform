import { describe, expect, it } from 'vitest';
import { sanitizeDetail } from './staff-portal-audit.service';

describe('sanitizeDetail', () => {
  it('drops keys and values that look like secrets', () => {
    expect(
      sanitizeDetail({
        email: 'a@example.test',
        inviteToken: 'raw-secret',
        password: 'nope',
        invite_token_hash: 'abc',
      }),
    ).toEqual({ email: 'a@example.test' });
  });

  it('allows safe operational fields', () => {
    expect(sanitizeDetail({ resend: true, reason: 'smtp_timeout' })).toEqual({
      resend: true,
      reason: 'smtp_timeout',
    });
  });
});

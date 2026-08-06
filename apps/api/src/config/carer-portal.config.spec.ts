import { describe, expect, it } from 'vitest';
import { parseCarerPortalEnabled } from './carer-portal.config';

describe('parseCarerPortalEnabled', () => {
  it('defaults to false', () => {
    expect(parseCarerPortalEnabled(undefined)).toBe(false);
    expect(parseCarerPortalEnabled('')).toBe(false);
    expect(parseCarerPortalEnabled('false')).toBe(false);
  });

  it('is true only for explicit true', () => {
    expect(parseCarerPortalEnabled('true')).toBe(true);
    expect(parseCarerPortalEnabled('TRUE')).toBe(true);
    expect(parseCarerPortalEnabled('1')).toBe(false);
  });
});

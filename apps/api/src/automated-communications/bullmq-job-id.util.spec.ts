import { describe, expect, it } from 'vitest';
import { deriveBullMqJobId, deriveProviderIdempotencyKey } from './bullmq-job-id.util';

describe('deriveBullMqJobId', () => {
  it('is deterministic and colon-free', () => {
    const key = 'shift:abc:carer:reminder:3d';
    const a = deriveBullMqJobId(key);
    const b = deriveBullMqJobId(key);
    expect(a).toBe(b);
    expect(a.startsWith('comm-')).toBe(true);
    expect(a.includes(':')).toBe(false);
    expect(/^\d+$/.test(a)).toBe(false);
  });

  it('differs for different idempotency keys', () => {
    expect(deriveBullMqJobId('a')).not.toBe(deriveBullMqJobId('b'));
  });
});

describe('deriveProviderIdempotencyKey', () => {
  it('uses communication id with prefix', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(deriveProviderIdempotencyKey(id)).toBe(`intra-comm-${id}`);
    expect(deriveProviderIdempotencyKey(id).length).toBeLessThanOrEqual(256);
  });
});

import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertManualCompletionAllowed,
  normalizeRequiredCancellationReason,
  rejectGenericPendingTransition,
} from './shifts-lifecycle.util';

describe('normalizeRequiredCancellationReason', () => {
  it('returns trimmed non-empty reasons', () => {
    expect(normalizeRequiredCancellationReason('  Centre closed  ')).toBe('Centre closed');
  });

  it('rejects empty and whitespace-only reasons', () => {
    expect(() => normalizeRequiredCancellationReason(undefined)).toThrow(BadRequestException);
    expect(() => normalizeRequiredCancellationReason('')).toThrow(BadRequestException);
    expect(() => normalizeRequiredCancellationReason('   ')).toThrow(BadRequestException);
  });
});

describe('assertManualCompletionAllowed', () => {
  it('allows filled shifts', () => {
    expect(() => assertManualCompletionAllowed('filled')).not.toThrow();
  });

  it('rejects pending, cancelled, and completed', () => {
    for (const status of ['pending', 'cancelled', 'completed']) {
      expect(() => assertManualCompletionAllowed(status)).toThrow(BadRequestException);
    }
  });
});

describe('rejectGenericPendingTransition', () => {
  it('always rejects with BadRequestException', () => {
    expect(() => rejectGenericPendingTransition()).toThrow(BadRequestException);
  });
});

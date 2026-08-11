import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { CarerPortalEnabledGuard } from '../staff-portal/carer-portal-enabled.guard';
import { parseRetainFileIds } from './staff-document-multipart.util';

function configService(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  } as ConfigService;
}

describe('Staff portal documents guards', () => {
  it('returns 404 when carer portal feature flag is off', () => {
    const guard = new CarerPortalEnabledGuard(configService({ CARER_PORTAL_ENABLED: false }));
    expect(() => guard.canActivate({} as never)).toThrow(NotFoundException);
  });
});

describe('retainFileIds parsing', () => {
  it('rejects duplicate ids', () => {
    expect(() => parseRetainFileIds(JSON.stringify(['a', 'a']))).toThrow(/duplicate/i);
  });

  it('accepts valid UUID arrays', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(parseRetainFileIds(JSON.stringify([id]))).toEqual([id]);
  });
});

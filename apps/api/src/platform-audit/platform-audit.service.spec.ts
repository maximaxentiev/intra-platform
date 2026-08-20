import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  PlatformAuditService,
  sanitizePlatformAuditMetadata,
} from './platform-audit.service';
import { PLATFORM_AUDIT_ACTIONS } from './platform-audit.constants';

describe('PlatformAuditService.record', () => {
  it('writes an ops_user event with the default database', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const service = new PlatformAuditService({ insert } as never);

    await service.record({
      action: PLATFORM_AUDIT_ACTIONS.shiftCreated,
      actorType: 'ops_user',
      actorUserId: 'ops-1',
      shiftId: 'shift-1',
      centreId: 'centre-1',
      metadata: { shiftDate: '2026-08-25' },
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'shift_created',
        actorType: 'ops_user',
        actorUserId: 'ops-1',
      }),
    );
  });

  it('writes a system event through a supplied transaction executor', async () => {
    const globalInsert = vi.fn();
    const txValues = vi.fn().mockResolvedValue(undefined);
    const txInsert = vi.fn().mockReturnValue({ values: txValues });
    const service = new PlatformAuditService({ insert: globalInsert } as never);

    await service.record(
      {
        action: PLATFORM_AUDIT_ACTIONS.shiftCompletedAuto,
        actorType: 'system',
        shiftId: 'shift-1',
      },
      { insert: txInsert },
    );

    expect(txInsert).toHaveBeenCalledTimes(1);
    expect(globalInsert).not.toHaveBeenCalled();
  });

  it('rejects unsupported actions', async () => {
    const service = new PlatformAuditService({ insert: vi.fn() } as never);
    await expect(
      service.record({
        action: 'shift_comment_added' as never,
        actorType: 'ops_user',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('sanitizePlatformAuditMetadata', () => {
  it('keeps safe structured changes', () => {
    expect(
      sanitizePlatformAuditMetadata({
        changes: {
          startTime: { from: '09:00', to: '10:00' },
        },
      }),
    ).toEqual({
      changes: {
        startTime: { from: '09:00', to: '10:00' },
      },
    });
  });

  it('rejects unsafe metadata keys', () => {
    expect(() =>
      sanitizePlatformAuditMetadata({
        resetToken: 'secret',
      }),
    ).toThrow(BadRequestException);
  });

  it('drops disallowed top-level keys', () => {
    expect(
      sanitizePlatformAuditMetadata({
        shiftDate: '2026-08-25',
        unexpectedField: 'should-drop',
      }),
    ).toEqual({ shiftDate: '2026-08-25' });
  });
});

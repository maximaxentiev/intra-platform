import { describe, expect, it, vi } from 'vitest';
import { StaffPortalAuditService, sanitizeDetail } from './staff-portal-audit.service';

describe('StaffPortalAuditService.record', () => {
  it('uses the global database by default', async () => {
    const globalInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    const service = new StaffPortalAuditService({ insert: globalInsert } as never);

    await service.record({
      staffId: 'staff-1',
      eventType: 'share_link_generated',
    });

    expect(globalInsert).toHaveBeenCalledTimes(1);
  });

  it('uses a supplied transaction executor when provided', async () => {
    const globalInsert = vi.fn();
    const txInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    const service = new StaffPortalAuditService({ insert: globalInsert } as never);

    await service.record(
      {
        staffId: 'staff-1',
        eventType: 'share_link_generated',
        detail: { action: 'share_link_generated' },
      },
      { insert: txInsert },
    );

    expect(txInsert).toHaveBeenCalledTimes(1);
    expect(globalInsert).not.toHaveBeenCalled();
  });
});

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

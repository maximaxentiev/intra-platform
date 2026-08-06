import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { staff, staffAccounts, staffPortalAuditEvents } from '../db/schema';
import { STAFF_PORTAL_AUDIT_EVENTS } from '../staff-portal/staff-portal-audit.service';
import { StaffService } from './staff.service';

describe('StaffService.remove', () => {
  let service: StaffService;
  let accountRows: { staffId: string }[];
  let auditRows: { staffId: string; eventType: string }[];
  let deleteCalled: boolean;

  beforeEach(() => {
    accountRows = [];
    auditRows = [];
    deleteCalled = false;

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: unknown) => ({
          where: vi.fn().mockImplementation(async () => {
            if (table === staffAccounts) return [...accountRows];
            if (table === staffPortalAuditEvents) return [...auditRows];
            return [];
          }),
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => {
          deleteCalled = true;
        }),
      }),
    } as never;

    service = new StaffService(db, { record: vi.fn() } as never);
  });

  it('blocks delete when a portal account exists', async () => {
    accountRows.push({ staffId: 'staff-1' });
    await expect(service.remove('staff-1')).rejects.toBeInstanceOf(ConflictException);
    expect(deleteCalled).toBe(false);
  });

  it('blocks delete when portal lifecycle audit events exist', async () => {
    auditRows.push({
      staffId: 'staff-1',
      eventType: STAFF_PORTAL_AUDIT_EVENTS.invitationCreated,
    });
    await expect(service.remove('staff-1')).rejects.toBeInstanceOf(ConflictException);
    expect(deleteCalled).toBe(false);
  });

  it('allows delete when only staff_record_created audit exists', async () => {
    auditRows.push({
      staffId: 'staff-1',
      eventType: STAFF_PORTAL_AUDIT_EVENTS.staffCreated,
    });
    await expect(service.remove('staff-1')).resolves.toEqual({ ok: true });
    expect(deleteCalled).toBe(true);
  });
});

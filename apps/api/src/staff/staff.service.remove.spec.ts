import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { staff, staffAccounts, staffPortalAuditEvents } from '../db/schema';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  staffPortalAuditBlocksDeletion,
} from '../staff-portal/staff-portal-audit.service';
import { StaffService } from './staff.service';

describe('staffPortalAuditBlocksDeletion', () => {
  it('does not treat staff creation or bulk import batch as portal history', () => {
    expect(staffPortalAuditBlocksDeletion(STAFF_PORTAL_AUDIT_EVENTS.staffCreated)).toBe(false);
    expect(staffPortalAuditBlocksDeletion(STAFF_PORTAL_AUDIT_EVENTS.staffBulkImportCompleted)).toBe(
      false,
    );
  });

  it('treats portal invitation and access events as blocking', () => {
    expect(staffPortalAuditBlocksDeletion(STAFF_PORTAL_AUDIT_EVENTS.invitationCreated)).toBe(true);
    expect(staffPortalAuditBlocksDeletion(STAFF_PORTAL_AUDIT_EVENTS.invitationEmailSent)).toBe(true);
    expect(staffPortalAuditBlocksDeletion(STAFF_PORTAL_AUDIT_EVENTS.invitationEmailFailed)).toBe(
      true,
    );
    expect(staffPortalAuditBlocksDeletion(STAFF_PORTAL_AUDIT_EVENTS.invitationResent)).toBe(true);
    expect(staffPortalAuditBlocksDeletion(STAFF_PORTAL_AUDIT_EVENTS.invitationAccepted)).toBe(true);
    expect(staffPortalAuditBlocksDeletion(STAFF_PORTAL_AUDIT_EVENTS.portalDisabled)).toBe(true);
    expect(staffPortalAuditBlocksDeletion(STAFF_PORTAL_AUDIT_EVENTS.portalReEnabled)).toBe(true);
  });
});

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

  it('blocks delete when portal invitation history exists', async () => {
    auditRows.push({
      staffId: 'staff-1',
      eventType: STAFF_PORTAL_AUDIT_EVENTS.invitationCreated,
    });
    await expect(service.remove('staff-1')).rejects.toBeInstanceOf(ConflictException);
    expect(deleteCalled).toBe(false);
  });

  it('blocks delete when invitation was accepted', async () => {
    auditRows.push({
      staffId: 'staff-1',
      eventType: STAFF_PORTAL_AUDIT_EVENTS.invitationAccepted,
    });
    await expect(service.remove('staff-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks delete when portal access was disabled or re-enabled', async () => {
    auditRows.push({
      staffId: 'staff-1',
      eventType: STAFF_PORTAL_AUDIT_EVENTS.portalDisabled,
    });
    await expect(service.remove('staff-1')).rejects.toBeInstanceOf(ConflictException);
    auditRows[0]!.eventType = STAFF_PORTAL_AUDIT_EVENTS.portalReEnabled;
    await expect(service.remove('staff-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows delete when only staff_record_created audit exists', async () => {
    auditRows.push({
      staffId: 'staff-1',
      eventType: STAFF_PORTAL_AUDIT_EVENTS.staffCreated,
    });
    await expect(service.remove('staff-1')).resolves.toEqual({ ok: true });
    expect(deleteCalled).toBe(true);
  });

  it('allows delete for first CSV-imported staff with batch completed audit', async () => {
    auditRows.push(
      {
        staffId: 'staff-1',
        eventType: STAFF_PORTAL_AUDIT_EVENTS.staffCreated,
      },
      {
        staffId: 'staff-1',
        eventType: STAFF_PORTAL_AUDIT_EVENTS.staffBulkImportCompleted,
      },
    );
    await expect(service.remove('staff-1')).resolves.toEqual({ ok: true });
    expect(deleteCalled).toBe(true);
  });

  it('allows delete for CSV-imported staff with only staff_record_created', async () => {
    auditRows.push({
      staffId: 'staff-2',
      eventType: STAFF_PORTAL_AUDIT_EVENTS.staffCreated,
    });
    await expect(service.remove('staff-2')).resolves.toEqual({ ok: true });
    expect(deleteCalled).toBe(true);
  });
});

import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { staff, staffAccounts } from '../db/schema';
import { STAFF_PORTAL_AUDIT_EVENTS } from '../staff-portal/staff-portal-audit.service';
import { StaffService } from './staff.service';

describe('StaffService.createManual', () => {
  let staffRows: { id: string; email: string }[];
  let accountRows: { email: string; staffId: string }[];
  let auditEvents: unknown[];
  let lastInsertRole: string | undefined;
  let service: StaffService;

  beforeEach(() => {
    staffRows = [];
    accountRows = [];
    auditEvents = [];
    lastInsertRole = undefined;

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: unknown) => ({
          where: vi.fn().mockImplementation(async () => {
            if (table === staffAccounts) return [...accountRows];
            if (table === staff) return [...staffRows];
            return [];
          }),
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((row: { email: string; role: string }) => {
          lastInsertRole = row.role;
          return {
            returning: vi.fn().mockImplementation(async () => {
              const created = {
                id: 'staff-new',
                legalName: 'Alex Carer',
                legalFirstName: 'Alex',
                legalLastName: 'Carer',
                displayName: 'Alex C',
                useDisplayName: true,
                phone: '555',
                email: row.email,
                address: '1 Main',
                city: 'Toronto',
                role: row.role,
                status: 'active',
                notes: '',
                documentsUrl: '',
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              staffRows.push({ id: created.id, email: created.email });
              return [created];
            }),
          };
        }),
      }),
    } as never;

    const audit = {
      record: vi.fn().mockImplementation(async (e: unknown) => {
        auditEvents.push(e);
      }),
    };

    service = new StaffService(db, audit as never);
  });

  const baseDto = {
    displayName: 'Alex C',
    legalFirstName: 'Alex',
    legalLastName: 'Carer',
    email: '  Carer@Example.TEST ',
    phone: '555',
    address: '1 Main',
    city: 'Toronto',
  };

  it('creates staff with normalized email and audit event', async () => {
    const created = await service.createManual({ ...baseDto, role: 'ECA' }, 'ops-1');
    expect(created.email).toBe('carer@example.test');
    expect(created.role).toBe('ECA');
    expect(created.portalAccountStatus).toBe('no_account');
    expect(auditEvents[0]).toMatchObject({
      eventType: STAFF_PORTAL_AUDIT_EVENTS.staffCreated,
    });
  });

  it.each(['ECA', 'ECE', 'Nanny'] as const)('stores canonical role %s', async (role) => {
    const created = await service.createManual(
      { ...baseDto, email: `${role.toLowerCase()}@example.test`, role },
      'ops-1',
    );
    expect(created.role).toBe(role);
    expect(lastInsertRole).toBe(role);
  });

  it('returns legacy staff with blank role from get', async () => {
    const legacyRow = {
      id: 'legacy-1',
      legalName: 'Legacy',
      legalFirstName: 'Legacy',
      legalLastName: 'Staff',
      displayName: '',
      useDisplayName: false,
      phone: '',
      email: 'legacy@example.test',
      address: '',
      city: '',
      role: '',
      status: 'active' as const,
      notes: '',
      documentsUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: unknown) => ({
          where: vi.fn().mockImplementation(async () => {
            if (table === staffAccounts) return [];
            if (table === staff) return [legacyRow];
            return [];
          }),
        })),
      }),
    } as never;
    const legacyService = new StaffService(db, { record: vi.fn() } as never);
    const loaded = await legacyService.get('legacy-1');
    expect(loaded.role).toBe('');
  });

  it('rejects duplicate staff email', async () => {
    staffRows.push({ id: 'existing', email: 'carer@example.test' });
    await expect(
      service.createManual(
        {
          displayName: 'X',
          legalFirstName: 'X',
          legalLastName: 'Y',
          email: 'carer@example.test',
          phone: '1',
          address: 'a',
          city: 'Toronto',
          role: 'ECA',
        },
        'ops-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

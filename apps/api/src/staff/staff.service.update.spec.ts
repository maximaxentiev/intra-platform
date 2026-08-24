import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffService } from './staff.service';

describe('StaffService.update documentsUrl', () => {
  let service: StaffService;
  let staffRow: {
    id: string;
    legalName: string;
    legalFirstName: string;
    legalLastName: string;
    displayName: string;
    useDisplayName: boolean;
    phone: string;
    email: string;
    address: string;
    city: string;
    role: string;
    status: 'active';
    notes: string;
    documentsUrl: string;
    createdAt: Date;
    updatedAt: Date;
  };
  let lastUpdateSet: Record<string, unknown> | undefined;

  beforeEach(() => {
    staffRow = {
      id: 'staff-1',
      legalName: 'Alex Carer',
      legalFirstName: 'Alex',
      legalLastName: 'Carer',
      displayName: 'Alex C',
      useDisplayName: true,
      phone: '555',
      email: 'alex@example.test',
      address: '1 Main St',
      city: 'Toronto',
      role: 'ECA',
      status: 'active',
      notes: 'Legacy note',
      documentsUrl: 'https://legacy.example/docs',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    lastUpdateSet = undefined;

    const tx = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
          lastUpdateSet = values;
          Object.assign(staffRow, values);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...staffRow }]),
            }),
          };
        }),
      }),
    };

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async () => [{ ...staffRow }]),
        }),
      }),
      transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    } as never;

    service = new StaffService(
      db,
      { record: vi.fn() } as never,
      { getDocumentStatusMapForStaffIds: vi.fn().mockResolvedValue(new Map()) } as never,
      { record: vi.fn().mockResolvedValue(undefined) } as never,
    );
  });

  it('preserves legacy documentsUrl when PATCH omits documentsUrl', async () => {
    await service.update(
      'staff-1',
      {
        legalName: 'Alex Carer',
        phone: '999',
        city: 'Toronto',
      },
      'ops-1',
    );

    expect(lastUpdateSet?.documentsUrl).toBe('https://legacy.example/docs');
    expect(staffRow.documentsUrl).toBe('https://legacy.example/docs');
  });

  it('does not clear documentsUrl on unrelated staff edits', async () => {
    await service.update(
      'staff-1',
      {
        legalName: 'Alex Updated',
        notes: 'Updated note',
        city: 'Toronto',
      },
      'ops-1',
    );

    expect(lastUpdateSet?.documentsUrl).toBe('https://legacy.example/docs');
    expect(lastUpdateSet?.legalName).toBe('Alex Updated');
    expect(lastUpdateSet?.notes).toBe('Updated note');
  });

  it('sanitizes documentsUrl when explicitly supplied', async () => {
    await service.update(
      'staff-1',
      {
        legalName: 'Alex Carer',
        city: 'Toronto',
        documentsUrl: 'https://new.example/docs',
      },
      'ops-1',
    );

    expect(lastUpdateSet?.documentsUrl).toBe('https://new.example/docs');
  });

  it('allows explicit documentsUrl clearing via empty string', async () => {
    await service.update(
      'staff-1',
      {
        legalName: 'Alex Carer',
        city: 'Toronto',
        documentsUrl: '',
      },
      'ops-1',
    );

    expect(lastUpdateSet?.documentsUrl).toBe('');
  });

  it('throws when staff is missing', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never;
    const missingService = new StaffService(
      db,
      { record: vi.fn() } as never,
      { getDocumentStatusMapForStaffIds: vi.fn() } as never,
      { record: vi.fn() } as never,
    );

    await expect(
      missingService.update('missing', { legalName: 'X', city: 'Toronto' }, 'ops-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

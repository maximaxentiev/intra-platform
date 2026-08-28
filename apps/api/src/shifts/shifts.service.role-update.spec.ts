import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { createMockShiftCancellationService } from './shift-cancellation-test.util';
import { createMockShiftReminderService } from './shift-reminder-test.util';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { createMockShiftUpdateCommunicationService } from './shift-update-communication-test.util';
import { createMockShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication-test.util';
import { ShiftsService } from './shifts.service';

function mockPlatformAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as PlatformAuditService;
}

function createService(existingRoleNeeded: string) {
  const returning = vi.fn().mockResolvedValue([
    {
      id: 'shift-1',
      centreId: 'centre-1',
      shiftDate: '2026-09-15',
      startTime: '08:00:00',
      endTime: '16:00:00',
      roleNeeded: existingRoleNeeded,
      notes: '',
      addedToStaffpoint: false,
      status: 'pending',
      assignedStaffId: null,
    },
  ]);

  const tx = {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning }),
      }),
    }),
  };

  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            shiftDate: '2026-09-15',
            startTime: '08:00:00',
            endTime: '16:00:00',
            centreId: 'centre-1',
            roleNeeded: existingRoleNeeded,
            notes: '',
            addedToStaffpoint: false,
            status: 'pending',
            assignedStaffId: null,
          },
        ]),
      }),
    }),
    transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };

  const service = new ShiftsService(
    db as never,
    {} as ShiftAssignmentConfirmationService,
    {} as ShiftMatchingService,
    createMockShiftReminderService(),
    createMockShiftCancellationService(),
    mockPlatformAudit(),
    createMockShiftUpdateCommunicationService(),
    createMockShiftManualUnassignCommunicationService(),
  );

  return { service, returning };
}

describe('ShiftsService legacy Nanny role guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['ECA', 'ECE', 'RECE'] as const)(
    'rejects changing an active %s shift to Nanny',
    async (existingRoleNeeded) => {
      const { service } = createService(existingRoleNeeded);

      await expect(
        service.update('shift-1', { roleNeeded: 'Nanny' }, 'ops-user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('allows a historical Nanny shift to remain Nanny', async () => {
    const { service, returning } = createService('Nanny');

    await expect(
      service.update('shift-1', { roleNeeded: 'Nanny', notes: 'unchanged role' }, 'ops-user-1'),
    ).resolves.toBeDefined();

    expect(returning).toHaveBeenCalled();
  });

  it.each(['ECA', 'ECE', 'RECE'] as const)(
    'allows upgrading a historical Nanny shift to %s',
    async (nextRole) => {
      const { service, returning } = createService('Nanny');

      await expect(
        service.update('shift-1', { roleNeeded: nextRole }, 'ops-user-1'),
      ).resolves.toBeDefined();

      expect(returning).toHaveBeenCalled();
    },
  );

  it('rejects creating a Nanny shift at the service layer', async () => {
    const { service } = createService('ECA');

    await expect(
      service.create(
        {
          centreId: 'centre-1',
          shiftDate: '2026-09-15',
          startTime: '08:00:00',
          endTime: '16:00:00',
          roleNeeded: 'Nanny',
        },
        'ops-user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { createMockShiftReminderService } from './shift-reminder-test.util';
import { createMockShiftCancellationService } from './shift-cancellation-test.util';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { createMockShiftUpdateCommunicationService } from './shift-update-communication-test.util';
import { createMockShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication-test.util';
import { ShiftsService } from './shifts.service';

function mockPlatformAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as PlatformAuditService;
}

describe('ShiftsService.unassign', () => {
  let service: ShiftsService;
  let shiftReminders: ReturnType<typeof createMockShiftReminderService>;
  let manualUnassignCommunications: ReturnType<typeof createMockShiftManualUnassignCommunicationService>;
  let tx: {
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    shiftReminders = createMockShiftReminderService();
    manualUnassignCommunications = createMockShiftManualUnassignCommunicationService();

    tx = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'shift-1',
                centreId: 'centre-1',
                assignedStaffId: null,
                status: 'pending',
              },
            ]),
          }),
        }),
      }),
    };

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { assignedStaffId: 'staff-1', centreId: 'centre-1' },
          ]),
        }),
      }),
      transaction: vi.fn(async (fn: (executor: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    service = new ShiftsService(
      db as never,
      {} as ShiftAssignmentConfirmationService,
      {} as ShiftMatchingService,
      shiftReminders,
      createMockShiftCancellationService(),
      mockPlatformAudit(),
      createMockShiftUpdateCommunicationService(),
      manualUnassignCommunications,
    );
  });

  it('clears assignee, sets pending, and cancels reminders inside the transaction', async () => {
    const result = await service.unassign('shift-1', 'ops-1');

    expect(result.shift.status).toBe('pending');
    expect(result.shift.assignedStaffId).toBeNull();
    expect(shiftReminders.cancelPendingForShift).toHaveBeenCalledWith('shift-1', tx);
    expect(shiftReminders.cancelPendingForShift).toHaveBeenCalledTimes(1);
    expect(manualUnassignCommunications.sendCommunications).not.toHaveBeenCalled();
  });

  it('does not cancel reminders when the transaction fails', async () => {
    vi.mocked(shiftReminders.cancelPendingForShift).mockRejectedValueOnce(new Error('tx failed'));

    await expect(service.unassign('shift-1', 'ops-1')).rejects.toThrow('tx failed');
    expect(manualUnassignCommunications.sendCommunications).not.toHaveBeenCalled();
  });

  it('sends communications after successful unassignment without rolling back state', async () => {
    vi.mocked(manualUnassignCommunications.sendCommunications).mockResolvedValue({
      centre: { attempted: true, sent: false },
      carer: { attempted: true, sent: true },
    });

    const result = await service.unassign('shift-1', 'ops-1', {
      communications: { centre: true, carer: true },
    });

    expect(result.shift.status).toBe('pending');
    expect(manualUnassignCommunications.sendCommunications).toHaveBeenCalledWith({
      shiftId: 'shift-1',
      centreId: 'centre-1',
      previousStaffId: 'staff-1',
      actorUserId: 'ops-1',
      recipients: { centre: true, carer: true },
    });
    expect(result.notifications?.carer.sent).toBe(true);
    expect(result.notifications?.centre.sent).toBe(false);
  });

  it('rejects unassign when no assignee exists', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ assignedStaffId: null, centreId: 'centre-1' }]),
        }),
      }),
      transaction: vi.fn(),
    };
    const rejected = new ShiftsService(
      db as never,
      {} as ShiftAssignmentConfirmationService,
      {} as ShiftMatchingService,
      shiftReminders,
      createMockShiftCancellationService(),
      mockPlatformAudit(),
      createMockShiftUpdateCommunicationService(),
      manualUnassignCommunications,
    );

    await expect(rejected.unassign('shift-1', 'ops-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(shiftReminders.cancelPendingForShift).not.toHaveBeenCalled();
  });

  it('rejects unassign when shift is missing', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      transaction: vi.fn(),
    };
    const rejected = new ShiftsService(
      db as never,
      {} as ShiftAssignmentConfirmationService,
      {} as ShiftMatchingService,
      shiftReminders,
      createMockShiftCancellationService(),
      mockPlatformAudit(),
      createMockShiftUpdateCommunicationService(),
      manualUnassignCommunications,
    );

    await expect(rejected.unassign('shift-1', 'ops-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(shiftReminders.cancelPendingForShift).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { createMockShiftCancellationService } from './shift-cancellation-test.util';
import { createMockShiftReminderService } from './shift-reminder-test.util';
import { createMockShiftUpdateCommunicationService } from './shift-update-communication-test.util';
import { createMockShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication-test.util';
import { createMockShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-test.util';
import { ShiftsService } from './shifts.service';

function mockPlatformAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as PlatformAuditService;
}

function createService(db: unknown) {
  return new ShiftsService(
    db as never,
    {} as ShiftAssignmentConfirmationService,
    {
      evaluateStaffForShift: vi.fn().mockResolvedValue({ eligible: true, reasons: [] }),
    } as unknown as ShiftMatchingService,
    createMockShiftReminderService(),
    createMockShiftCancellationService(),
    mockPlatformAudit(),
    createMockShiftUpdateCommunicationService(),
    createMockShiftManualUnassignCommunicationService(),
      
    createMockShiftBatchProgressCommunicationService(),
  );
}

describe('ShiftsService confirmationNotes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists confirmationNotes separately from legacy notes on create', async () => {
    const insertValues = vi.fn();
    const returning = vi.fn().mockResolvedValue([
      {
        id: 'shift-1',
        centreId: 'centre-1',
        shiftDate: '2026-09-01',
        startTime: '08:00:00',
        endTime: '16:00:00',
      },
    ]);
    insertValues.mockReturnValue({ returning });
    const tx = {
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    };
    const db = {
      transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const service = createService(db);
    await service.create(
      {
        centreId: 'centre-1',
        shiftDate: '2026-09-01',
        startTime: '08:00:00',
        endTime: '16:00:00',
        roleNeeded: 'ECA',
        notes: 'internal legacy',
        confirmationNotes: '  External note  ',
      },
      'ops-1',
    );

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'internal legacy',
        shiftConfirmationNotes: 'External note',
        batchId: null,
      }),
    );
  });

  it('normalizes blank confirmationNotes to null on update', async () => {
    const before = {
      shiftDate: '2026-09-01',
      startTime: '08:00:00',
      endTime: '16:00:00',
      centreId: 'centre-1',
      batchId: null,
      roleNeeded: 'ECA',
      notes: 'internal',
      shiftConfirmationNotes: 'Keep',
      addedToStaffpoint: false,
      status: 'pending',
      assignedStaffId: null,
    };

    const returning = vi.fn().mockResolvedValue([
      {
        ...before,
        shiftConfirmationNotes: null,
        id: 'shift-1',
        centreId: 'centre-1',
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
          where: vi.fn().mockResolvedValue([before]),
        }),
      }),
      transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const service = createService(db);
    await service.update('shift-1', { confirmationNotes: '   ' }, 'ops-1');

    const setCall = tx.update.mock.results[0]?.value.set.mock.calls[0]?.[0];
    expect(setCall?.shiftConfirmationNotes).toBeNull();
  });
});

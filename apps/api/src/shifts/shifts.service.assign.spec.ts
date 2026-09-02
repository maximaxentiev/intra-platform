import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { createMockShiftReminderService } from './shift-reminder-test.util';
import { createMockShiftCancellationService } from './shift-cancellation-test.util';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { createMockShiftUpdateCommunicationService } from './shift-update-communication-test.util';
import { createMockShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication-test.util';
import { createMockShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-test.util';
import { ShiftsService } from './shifts.service';

function mockPlatformAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as PlatformAuditService;
}

function mockBatchStaleness() {
  return { recordMaterialChange: vi.fn().mockResolvedValue(undefined) };
}

function createAssignTransactionMock(
  lockedRow: {
    assignedStaffId: string | null;
    centreId: string;
    batchId?: string | null;
  },
  options?: { contacted?: boolean; batchCancelled?: boolean },
) {
  let selectCall = 0;
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockImplementation(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue([lockedRow]),
            }),
          }),
        };
      }
      if (selectCall === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(
                options?.contacted === false ? [] : [{ shiftId: 'shift-1' }],
              ),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { cancelledAt: options?.batchCancelled ? new Date() : null },
            ]),
          }),
        }),
      };
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn(),
      }),
    }),
  };
}

function buildService(
  db: unknown,
  confirmation: ShiftAssignmentConfirmationService,
  shiftMatching: ShiftMatchingService,
  manualUnassignCommunications: ReturnType<typeof createMockShiftManualUnassignCommunicationService>,
) {
  return new ShiftsService(
    db as never,
    confirmation,
    shiftMatching,
    createMockShiftReminderService(),
    createMockShiftCancellationService(),
    mockPlatformAudit(),
    createMockShiftUpdateCommunicationService(),
    manualUnassignCommunications,
    createMockShiftBatchProgressCommunicationService(),
    mockBatchStaleness() as never,
  );
}

describe('ShiftsService.assign idempotency', () => {
  let service: ShiftsService;
  let confirmation: ShiftAssignmentConfirmationService;
  let shiftMatching: ShiftMatchingService;
  let manualUnassignCommunications: ReturnType<typeof createMockShiftManualUnassignCommunicationService>;
  let txUpdateWhere: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    manualUnassignCommunications = createMockShiftManualUnassignCommunicationService();
    txUpdateWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });

    const tx = createAssignTransactionMock(
      { assignedStaffId: null, centreId: 'centre-1', batchId: null },
    );
    tx.update = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: txUpdateWhere,
      }),
    });

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ assignedStaffId: null, shiftDate: '2026-09-01' }]),
        }),
      }),
      transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    };

    confirmation = {
      sendAssignmentConfirmations: vi.fn().mockResolvedValue({
        centre: { attempted: true, sent: true },
        carer: { attempted: true, sent: true },
      }),
    } as unknown as ShiftAssignmentConfirmationService;

    shiftMatching = {
      evaluateStaffForShift: vi.fn().mockResolvedValue({ eligible: true, reasons: [] }),
    } as unknown as ShiftMatchingService;

    service = buildService(db, confirmation, shiftMatching, manualUnassignCommunications);
    vi.spyOn(service, 'get').mockResolvedValue({
      id: 'shift-1',
      assignedStaffId: 'staff-1',
      centreId: 'centre-1',
    } as never);
  });

  it('sends confirmations when assignment changes', async () => {
    txUpdateWhere.mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        { id: 'shift-1', shiftDate: '2026-09-01', startTime: '09:00:00', centreId: 'centre-1' },
      ]),
    });

    const result = await service.assign('shift-1', 'staff-1', 'ops-1');

    expect(result.assignment).toEqual({ changed: true, alreadyAssigned: false });
    expect(shiftMatching.evaluateStaffForShift).toHaveBeenCalled();
    expect(confirmation.sendAssignmentConfirmations).toHaveBeenCalledWith({
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      trigger: 'assign',
    });
  });

  it('sends previous-carer unassignment email on reassignment when requested', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { assignedStaffId: 'staff-a', shiftDate: '2026-09-01', centreId: 'centre-1' },
          ]),
        }),
      }),
      transaction: vi.fn(async (fn: (client: unknown) => Promise<void>) => {
        const tx = createAssignTransactionMock({
          assignedStaffId: 'staff-a',
          centreId: 'centre-1',
          batchId: null,
        });
        tx.update = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'shift-1',
                  shiftDate: '2026-09-01',
                  startTime: '09:00:00',
                  centreId: 'centre-1',
                },
              ]),
            }),
          }),
        });
        return fn(tx);
      }),
    };

    vi.mocked(manualUnassignCommunications.sendCommunications).mockResolvedValue({
      centre: null,
      carer: { attempted: true, sent: true },
    });

    service = buildService(db, confirmation, shiftMatching, manualUnassignCommunications);
    vi.spyOn(service, 'get').mockResolvedValue({
      id: 'shift-1',
      assignedStaffId: 'staff-b',
      centreId: 'centre-1',
    } as never);

    const result = await service.assign('shift-1', 'staff-b', 'ops-1', {
      notifyPreviousCarer: true,
    });

    expect(result.previousCarerNotification).toEqual({ attempted: true, sent: true });
    expect(manualUnassignCommunications.sendCommunications).toHaveBeenCalledWith({
      shiftId: 'shift-1',
      centreId: 'centre-1',
      previousStaffId: 'staff-a',
      actorUserId: 'ops-1',
      recipients: { centre: false, carer: true },
    });
  });

  it('uses locked-row assignee as previous carer when pre-read is stale', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { assignedStaffId: 'staff-a', shiftDate: '2026-09-01', centreId: 'centre-1' },
          ]),
        }),
      }),
      transaction: vi.fn(async (fn: (client: unknown) => Promise<void>) => {
        const tx = createAssignTransactionMock({
          assignedStaffId: 'staff-c',
          centreId: 'centre-1',
          batchId: null,
        });
        tx.update = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'shift-1',
                  shiftDate: '2026-09-01',
                  startTime: '09:00:00',
                  centreId: 'centre-1',
                },
              ]),
            }),
          }),
        });
        return fn(tx);
      }),
    };

    vi.mocked(manualUnassignCommunications.sendCommunications).mockResolvedValue({
      centre: null,
      carer: { attempted: true, sent: true },
    });

    service = buildService(db, confirmation, shiftMatching, manualUnassignCommunications);
    vi.spyOn(service, 'get').mockResolvedValue({
      id: 'shift-1',
      assignedStaffId: 'staff-b',
      centreId: 'centre-1',
    } as never);

    await service.assign('shift-1', 'staff-b', 'ops-1', { notifyPreviousCarer: true });

    expect(manualUnassignCommunications.sendCommunications).toHaveBeenCalledWith(
      expect.objectContaining({ previousStaffId: 'staff-c' }),
    );
  });

  it('skips previous-carer email when reassignment notification not requested', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { assignedStaffId: 'staff-a', shiftDate: '2026-09-01', centreId: 'centre-1' },
          ]),
        }),
      }),
      transaction: vi.fn(async (fn: (client: unknown) => Promise<void>) => {
        const tx = createAssignTransactionMock({
          assignedStaffId: 'staff-a',
          centreId: 'centre-1',
          batchId: null,
        });
        tx.update = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'shift-1',
                  shiftDate: '2026-09-01',
                  startTime: '09:00:00',
                  centreId: 'centre-1',
                },
              ]),
            }),
          }),
        });
        return fn(tx);
      }),
    };

    service = buildService(db, confirmation, shiftMatching, manualUnassignCommunications);
    vi.spyOn(service, 'get').mockResolvedValue({
      id: 'shift-1',
      assignedStaffId: 'staff-b',
      centreId: 'centre-1',
    } as never);

    await service.assign('shift-1', 'staff-b', 'ops-1', { notifyPreviousCarer: false });

    expect(manualUnassignCommunications.sendCommunications).not.toHaveBeenCalled();
  });

  it('returns no-op without sending confirmations for same staff', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ assignedStaffId: 'staff-1', shiftDate: '2026-09-01' }]),
        }),
      }),
      transaction: vi.fn(),
    };
    service = buildService(db, confirmation, shiftMatching, manualUnassignCommunications);
    vi.spyOn(service, 'get').mockResolvedValue({
      id: 'shift-1',
      assignedStaffId: 'staff-1',
    } as never);

    const result = await service.assign('shift-1', 'staff-1', 'ops-1');

    expect(result.assignment).toEqual({ changed: false, alreadyAssigned: true });
    expect(result.notifications).toBeNull();
    expect(confirmation.sendAssignmentConfirmations).not.toHaveBeenCalled();
    expect(shiftMatching.evaluateStaffForShift).not.toHaveBeenCalled();
  });

  it('throws when shift does not exist', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      transaction: vi.fn(),
    };
    service = buildService(db, confirmation, shiftMatching, manualUnassignCommunications);

    await expect(service.assign('missing', 'staff-1', 'ops-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects ineligible staff without sending confirmations', async () => {
    shiftMatching.evaluateStaffForShift = vi
      .fn()
      .mockResolvedValue({ eligible: false, reasons: ['not_available'] });

    await expect(service.assign('shift-1', 'staff-1', 'ops-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(confirmation.sendAssignmentConfirmations).not.toHaveBeenCalled();
  });

  it('rejects assignment when carer is not marked contacted', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { assignedStaffId: null, shiftDate: '2026-09-01', centreId: 'centre-1' },
          ]),
        }),
      }),
      transaction: vi.fn(async (fn: (client: unknown) => Promise<void>) => {
        const tx = createAssignTransactionMock(
          { assignedStaffId: null, centreId: 'centre-1', batchId: null },
          { contacted: false },
        );
        return fn(tx);
      }),
    };
    service = buildService(db, confirmation, shiftMatching, manualUnassignCommunications);

    await expect(service.assign('shift-1', 'staff-1', 'ops-1')).rejects.toMatchObject({
      response: { code: 'carer_not_contacted' },
    });
  });
});

describe('ShiftsService.sendAssignmentConfirmation', () => {
  it('requires assigned filled shift', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ assignedStaffId: null, status: 'pending' }]),
        }),
      }),
    };
    const confirmation = {
      sendAssignmentConfirmations: vi.fn(),
    } as unknown as ShiftAssignmentConfirmationService;
    const service = buildService(
      db,
      confirmation,
      {} as ShiftMatchingService,
      createMockShiftManualUnassignCommunicationService(),
    );

    await expect(
      service.sendAssignmentConfirmation('shift-1', 'ops-1', { recipients: { centre: true } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ShiftsService.availableStaff', () => {
  it('delegates to ShiftMatchingService', async () => {
    const shiftMatching = {
      findEligibleStaffForShift: vi.fn().mockResolvedValue([
        { id: 'staff-1', legalName: 'A', isTop: true, contacted: false },
      ]),
    } as unknown as ShiftMatchingService;
    const service = buildService(
      {} as never,
      {} as never,
      shiftMatching,
      createMockShiftManualUnassignCommunicationService(),
    );

    const rows = await service.availableStaff('shift-1');
    expect(rows).toHaveLength(1);
    expect(shiftMatching.findEligibleStaffForShift).toHaveBeenCalledWith('shift-1');
  });
});

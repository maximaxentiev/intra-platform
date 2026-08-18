import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { ShiftsService } from './shifts.service';

describe('ShiftsService.assign idempotency', () => {
  let service: ShiftsService;
  let confirmation: ShiftAssignmentConfirmationService;
  let shiftMatching: ShiftMatchingService;
  let txUpdateWhere: ReturnType<typeof vi.fn>;
  let txSelectWhere: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    txUpdateWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    txSelectWhere = vi.fn().mockResolvedValue([{ assignedStaffId: null }]);

    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockResolvedValue([{ assignedStaffId: null }]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: txUpdateWhere,
        }),
      }),
    };

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

    service = new ShiftsService(db as never, confirmation, shiftMatching);
    vi.spyOn(service, 'get').mockResolvedValue({
      id: 'shift-1',
      assignedStaffId: 'staff-1',
    } as never);
  });

  it('sends confirmations when assignment changes', async () => {
    txUpdateWhere.mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'shift-1' }]),
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

  it('returns no-op without sending confirmations for same staff', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ assignedStaffId: 'staff-1', shiftDate: '2026-09-01' }]),
        }),
      }),
      transaction: vi.fn(),
    };
    service = new ShiftsService(db as never, confirmation, shiftMatching);
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
    service = new ShiftsService(db as never, confirmation, shiftMatching);

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
    const service = new ShiftsService(
      db as never,
      confirmation,
      {} as ShiftMatchingService,
    );

    await expect(service.sendAssignmentConfirmation('shift-1', 'ops-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ShiftsService.availableStaff', () => {
  it('delegates to ShiftMatchingService', async () => {
    const shiftMatching = {
      findEligibleStaffForShift: vi.fn().mockResolvedValue([
        { id: 'staff-1', legalName: 'A', isTop: true, contacted: false },
      ]),
    } as unknown as ShiftMatchingService;
    const service = new ShiftsService({} as never, {} as never, shiftMatching);

    const rows = await service.availableStaff('shift-1');
    expect(rows).toHaveLength(1);
    expect(shiftMatching.findEligibleStaffForShift).toHaveBeenCalledWith('shift-1');
  });
});

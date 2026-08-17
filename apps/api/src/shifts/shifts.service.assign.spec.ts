import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftsService } from './shifts.service';

describe('ShiftsService.assign idempotency', () => {
  let service: ShiftsService;
  let confirmation: ShiftAssignmentConfirmationService;
  let updateWhere: ReturnType<typeof vi.fn>;
  let selectWhere: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateWhere = vi.fn().mockReturnValue({
      returning: vi.fn(),
    });
    selectWhere = vi.fn();

    const db = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: updateWhere,
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: selectWhere,
        }),
      }),
    };

    confirmation = {
      sendAssignmentConfirmations: vi.fn().mockResolvedValue({
        centre: { attempted: true, sent: true },
        carer: { attempted: true, sent: true },
      }),
    } as unknown as ShiftAssignmentConfirmationService;

    const cancellationRequests = {
      resolvePendingForShift: vi.fn().mockResolvedValue(null),
    };

    service = new ShiftsService(db as never, confirmation, cancellationRequests as never);
    vi.spyOn(service, 'get').mockResolvedValue({
      id: 'shift-1',
      assignedStaffId: 'staff-1',
    } as never);
  });

  it('sends confirmations when assignment changes', async () => {
    selectWhere.mockResolvedValueOnce([{ assignedStaffId: null }]);
    updateWhere.mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'shift-1' }]),
    });

    const result = await service.assign('shift-1', 'staff-1', 'ops-1');

    expect(result.assignment).toEqual({ changed: true, alreadyAssigned: false });
    expect(confirmation.sendAssignmentConfirmations).toHaveBeenCalledWith({
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      actorUserId: 'ops-1',
      trigger: 'assign',
    });
  });

  it('returns no-op without sending confirmations for same staff', async () => {
    selectWhere.mockResolvedValueOnce([{ assignedStaffId: 'staff-1' }]);
    updateWhere.mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    });
    selectWhere.mockResolvedValueOnce([{ assignedStaffId: 'staff-1' }]);

    const result = await service.assign('shift-1', 'staff-1', 'ops-1');

    expect(result.assignment).toEqual({ changed: false, alreadyAssigned: true });
    expect(result.notifications).toBeNull();
    expect(confirmation.sendAssignmentConfirmations).not.toHaveBeenCalled();
  });

  it('throws when shift does not exist', async () => {
    selectWhere.mockResolvedValueOnce([{ assignedStaffId: null }]);
    updateWhere.mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    });
    selectWhere.mockResolvedValueOnce([]);

    await expect(service.assign('missing', 'staff-1', 'ops-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
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
    const cancellationRequests = {
      resolvePendingForShift: vi.fn(),
    };
    const service = new ShiftsService(db as never, confirmation, cancellationRequests as never);

    await expect(service.sendAssignmentConfirmation('shift-1', 'ops-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

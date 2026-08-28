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
import type { ShiftUpdateCommunicationService } from './shift-update-communication.service';

function mockPlatformAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as PlatformAuditService;
}

function createUpdateService(input: {
  before: Record<string, unknown>;
  shiftMatching?: ShiftMatchingService;
  shiftUpdateCommunications?: ShiftUpdateCommunicationService;
}) {
  const returning = vi.fn().mockResolvedValue([
    {
      id: 'shift-1',
      centreId: 'centre-1',
      shiftDate: input.before.shiftDate ?? '2026-08-28',
      startTime: input.before.startTime ?? '08:00:00',
      endTime: input.before.endTime ?? '16:00:00',
      roleNeeded: input.before.roleNeeded ?? 'ECE',
      notes: '',
      addedToStaffpoint: false,
      status: input.before.status ?? 'filled',
      assignedStaffId: input.before.assignedStaffId ?? 'staff-1',
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
        where: vi.fn().mockResolvedValue([input.before]),
      }),
    }),
    transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };

  const shiftMatching =
    input.shiftMatching ??
    ({
      evaluateStaffForShift: vi.fn().mockResolvedValue({ eligible: true, reasons: [] }),
    } as unknown as ShiftMatchingService);

  const shiftUpdateCommunications =
    input.shiftUpdateCommunications ?? createMockShiftUpdateCommunicationService();

  const service = new ShiftsService(
    db as never,
    {} as ShiftAssignmentConfirmationService,
    shiftMatching,
    createMockShiftReminderService(),
    createMockShiftCancellationService(),
    mockPlatformAudit(),
    shiftUpdateCommunications,
    createMockShiftManualUnassignCommunicationService(),
  );

  return { service, returning, shiftUpdateCommunications, shiftMatching };
}

describe('ShiftsService update communications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks ECE to RECE when assigned staff lacks RECE proof', async () => {
    const shiftMatching = {
      evaluateStaffForShift: vi.fn().mockResolvedValue({
        eligible: false,
        reasons: ['rece_required'],
      }),
    } as unknown as ShiftMatchingService;

    const { service } = createUpdateService({
      before: {
        shiftDate: '2026-08-28',
        startTime: '08:00:00',
        endTime: '16:00:00',
        centreId: 'centre-1',
        roleNeeded: 'ECE',
        notes: '',
        addedToStaffpoint: false,
        status: 'filled',
        assignedStaffId: 'staff-1',
      },
      shiftMatching,
    });

    await expect(
      service.update('shift-1', { roleNeeded: 'RECE' }, 'ops-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'assignee_impact_required' }),
    });
  });

  it('allows unassigned shift role change', async () => {
    const { service, returning } = createUpdateService({
      before: {
        shiftDate: '2026-08-28',
        startTime: '08:00:00',
        endTime: '16:00:00',
        centreId: 'centre-1',
        roleNeeded: 'ECE',
        notes: '',
        addedToStaffpoint: false,
        status: 'pending',
        assignedStaffId: null,
      },
    });

    await service.update('shift-1', { roleNeeded: 'RECE' }, 'ops-1');
    expect(returning).toHaveBeenCalled();
  });

  it('persists update then sends communications', async () => {
    const comms = createMockShiftUpdateCommunicationService();
    vi.mocked(comms.sendCommunications).mockResolvedValue({
      centre: { attempted: true, sent: true },
      carer: { attempted: true, sent: false },
    });

    const { service, returning } = createUpdateService({
      before: {
        shiftDate: '2026-08-28',
        startTime: '08:00:00',
        endTime: '16:00:00',
        centreId: 'centre-1',
        roleNeeded: 'ECE',
        notes: '',
        addedToStaffpoint: false,
        status: 'filled',
        assignedStaffId: 'staff-1',
      },
      shiftUpdateCommunications: comms,
    });

    const result = await service.update(
      'shift-1',
      {
        shiftDate: '2026-08-29',
        communications: {
          centre: { send: true, include: { date: true } },
          carer: { send: true, include: { date: true } },
        },
      },
      'ops-1',
    );

    expect(returning).toHaveBeenCalled();
    expect(comms.sendCommunications).toHaveBeenCalled();
    expect(result.communications?.centre?.sent).toBe(true);
    expect(result.communications?.carer?.sent).toBe(false);
  });

  it('rejects communication for unchanged field', async () => {
    const { service } = createUpdateService({
      before: {
        shiftDate: '2026-08-28',
        startTime: '08:00:00',
        endTime: '16:00:00',
        centreId: 'centre-1',
        roleNeeded: 'ECE',
        notes: '',
        addedToStaffpoint: false,
        status: 'filled',
        assignedStaffId: 'staff-1',
      },
    });

    await expect(
      service.update(
        'shift-1',
        {
          shiftDate: '2026-08-29',
          communications: {
            centre: { send: true, include: { date: true, role: true } },
          },
        },
        'ops-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns null communications when none requested', async () => {
    const comms = createMockShiftUpdateCommunicationService();
    const { service } = createUpdateService({
      before: {
        shiftDate: '2026-08-28',
        startTime: '08:00:00',
        endTime: '16:00:00',
        centreId: 'centre-1',
        roleNeeded: 'ECE',
        notes: '',
        addedToStaffpoint: false,
        status: 'pending',
        assignedStaffId: null,
      },
      shiftUpdateCommunications: comms,
    });

    const result = await service.update('shift-1', { notes: 'internal only' }, 'ops-1');
    expect(result.communications).toBeNull();
    expect(comms.sendCommunications).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftMatchingService } from './shift-matching.service';
import { createMockShiftCancellationService } from './shift-cancellation-test.util';
import { createMockShiftReminderService } from './shift-reminder-test.util';
import { createMockShiftUpdateCommunicationService } from './shift-update-communication-test.util';
import { ShiftsService } from './shifts.service';
import type { ShiftUpdateCommunicationService } from './shift-update-communication.service';
import type { ShiftReminderService } from './shift-reminder.service';

function mockPlatformAudit() {
  return { record: vi.fn().mockResolvedValue(undefined) } as unknown as PlatformAuditService;
}

function createUpdateService(input: {
  before: Record<string, unknown>;
  shiftMatching?: ShiftMatchingService;
  shiftUpdateCommunications?: ShiftUpdateCommunicationService;
  shiftReminders?: ShiftReminderService;
  platformAudit?: PlatformAuditService;
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

  const shiftReminders = input.shiftReminders ?? createMockShiftReminderService();
  const platformAudit = input.platformAudit ?? mockPlatformAudit();

  const service = new ShiftsService(
    db as never,
    {} as ShiftAssignmentConfirmationService,
    shiftMatching,
    shiftReminders,
    createMockShiftCancellationService(),
    platformAudit,
    shiftUpdateCommunications,
  );

  return { service, returning, shiftUpdateCommunications, shiftMatching, shiftReminders, platformAudit, tx };
}

describe('ShiftsService update assignee impact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const filledBefore = {
    shiftDate: '2026-08-28',
    startTime: '08:00:00',
    endTime: '16:00:00',
    centreId: 'centre-1',
    roleNeeded: 'ECE',
    notes: '',
    addedToStaffpoint: false,
    status: 'filled',
    assignedStaffId: 'staff-1',
  };

  it('keeps assignee when still eligible after schedule change', async () => {
    const { service, returning, shiftReminders } = createUpdateService({ before: filledBefore });
    const result = await service.update('shift-1', { shiftDate: '2026-08-29' }, 'ops-1');
    expect(returning).toHaveBeenCalled();
    expect(result.assignmentImpact.action).toBe('unchanged');
    expect(shiftReminders.cancelPendingForShift).not.toHaveBeenCalled();
    expect(shiftReminders.rescheduleFilledShift).toHaveBeenCalled();
  });

  it('rejects update when assignee unavailable without resolution', async () => {
    const shiftMatching = {
      evaluateStaffForShift: vi.fn().mockResolvedValue({
        eligible: false,
        reasons: ['not_available'],
      }),
    } as unknown as ShiftMatchingService;
    const { service } = createUpdateService({ before: filledBefore, shiftMatching });
    await expect(
      service.update('shift-1', { shiftDate: '2026-08-29' }, 'ops-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'assignee_impact_required' }),
    });
  });

  it('unassigns staff and cancels reminders when resolution is unassign', async () => {
    const shiftMatching = {
      evaluateStaffForShift: vi.fn().mockResolvedValue({
        eligible: false,
        reasons: ['not_available'],
      }),
    } as unknown as ShiftMatchingService;
    const shiftReminders = createMockShiftReminderService();
    const platformAudit = mockPlatformAudit();
    const { service, tx, shiftUpdateCommunications } = createUpdateService({
      before: filledBefore,
      shiftMatching,
      shiftReminders,
      platformAudit,
    });

    const result = await service.update(
      'shift-1',
      { shiftDate: '2026-08-29', assignmentResolution: 'unassign' },
      'ops-1',
    );

    expect(shiftReminders.cancelPendingForShift).toHaveBeenCalledWith('shift-1');
    expect(tx.update).toHaveBeenCalled();
    expect(result.assignmentImpact).toEqual({
      action: 'unassigned',
      previousStaffId: 'staff-1',
    });
    expect(platformAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PLATFORM_AUDIT_ACTIONS.shiftStaffUnassignedScheduleChange,
        staffId: 'staff-1',
      }),
      expect.anything(),
    );
    expect(shiftUpdateCommunications.sendCommunications).not.toHaveBeenCalled();
  });

  it('records availability override and reschedules reminders', async () => {
    const shiftMatching = {
      evaluateStaffForShift: vi.fn().mockResolvedValue({
        eligible: false,
        reasons: ['not_available'],
      }),
    } as unknown as ShiftMatchingService;
    const shiftReminders = createMockShiftReminderService();
    const platformAudit = mockPlatformAudit();
    const { service } = createUpdateService({
      before: filledBefore,
      shiftMatching,
      shiftReminders,
      platformAudit,
    });

    const result = await service.update(
      'shift-1',
      { shiftDate: '2026-08-29', assignmentResolution: 'availability_override' },
      'ops-1',
    );

    expect(result.assignmentImpact.action).toBe('availability_override');
    expect(shiftReminders.cancelPendingForShift).not.toHaveBeenCalled();
    expect(shiftReminders.rescheduleFilledShift).toHaveBeenCalled();
    expect(platformAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: PLATFORM_AUDIT_ACTIONS.shiftAvailabilityOverrideConfirmed,
        staffId: 'staff-1',
      }),
      expect.anything(),
    );
  });

  it('rejects stale availability override when overlap appears on final save', async () => {
    const shiftMatching = {
      evaluateStaffForShift: vi.fn().mockResolvedValue({
        eligible: false,
        reasons: ['shift_overlap'],
      }),
    } as unknown as ShiftMatchingService;
    const { service } = createUpdateService({ before: filledBefore, shiftMatching });
    await expect(
      service.update(
        'shift-1',
        { shiftDate: '2026-08-29', assignmentResolution: 'availability_override' },
        'ops-1',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'assignee_override_not_allowed' }),
    });
  });

  it('allows unassign communications with empty field selections', async () => {
    const shiftMatching = {
      evaluateStaffForShift: vi.fn().mockResolvedValue({
        eligible: false,
        reasons: ['not_available'],
      }),
    } as unknown as ShiftMatchingService;
    const comms = createMockShiftUpdateCommunicationService();
    const { service } = createUpdateService({
      before: filledBefore,
      shiftMatching,
      shiftUpdateCommunications: comms,
    });

    await service.update(
      'shift-1',
      {
        shiftDate: '2026-08-29',
        assignmentResolution: 'unassign',
        communications: {
          centre: { send: true, include: {} },
          carer: { send: true, include: { date: true } },
        },
      },
      'ops-1',
    );

    expect(comms.sendCommunications).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentUnassigned: true,
        previousAssignedStaffId: 'staff-1',
      }),
    );
  });

  it('previewUpdate reports requiresAssignmentResolution for unavailable assignee', async () => {
    const shiftMatching = {
      evaluateStaffForShift: vi.fn().mockResolvedValue({
        eligible: false,
        reasons: ['not_available'],
      }),
    } as unknown as ShiftMatchingService;

    const staffSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { legalName: 'Jaspreet Kaur', legalFirstName: 'Jaspreet', legalLastName: 'Kaur' },
        ]),
      }),
    });

    const shiftSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([filledBefore]),
      }),
    });

    const db = {
      select: vi.fn((fields: Record<string, unknown>) => {
        if ('legalName' in fields) return staffSelect();
        return shiftSelect();
      }),
    };

    const service = new ShiftsService(
      db as never,
      {} as ShiftAssignmentConfirmationService,
      shiftMatching,
      createMockShiftReminderService(),
      createMockShiftCancellationService(),
      mockPlatformAudit(),
      createMockShiftUpdateCommunicationService(),
    );

    const preview = await service.previewUpdate('shift-1', { shiftDate: '2026-08-29' });
    expect(preview.requiresAssignmentResolution).toBe(true);
    expect(preview.assigneeImpact?.status).toBe('availability_override_available');
    expect(preview.assigneeImpact?.staffName).toBe('Jaspreet Kaur');
  });
});

import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  assertAssignmentResolutionForUpdate,
  classifyAssigneeImpact,
  hasScheduleChange,
  hasRoleChange,
  requiresAssigneeRevalidation,
  isAvailabilityOnlyFailure,
  reasonMessages,
} from './shift-update-assignee-impact.util';
import type { ShiftMatchingService } from './shift-matching.service';
import { normalizeShiftCommunicationSnapshot } from './shift-update-changes.util';

const BASE = {
  shiftDate: '2026-08-28',
  startTime: '08:00:00',
  endTime: '16:00:00',
  roleNeeded: 'ECE',
};

function snap(overrides: Partial<typeof BASE> = {}) {
  return normalizeShiftCommunicationSnapshot({ ...BASE, ...overrides });
}

function mockMatching(result: { eligible: boolean; reasons: string[] }) {
  return {
    evaluateStaffForShift: vi.fn().mockResolvedValue(result),
  } as unknown as ShiftMatchingService;
}

describe('shift-update-assignee-impact.util', () => {
  it('detects schedule changes across date or time', () => {
    const before = snap();
    expect(hasScheduleChange(before, snap({ shiftDate: '2026-08-29' }))).toBe(true);
    expect(hasScheduleChange(before, snap({ startTime: '09:00:00' }))).toBe(true);
    expect(hasScheduleChange(before, snap({ roleNeeded: 'RECE' }))).toBe(false);
  });

  it('requires revalidation when role changes', () => {
    const before = snap({ roleNeeded: 'ECA' });
    const after = snap({ roleNeeded: 'ECE' });
    expect(hasRoleChange(before, after)).toBe(true);
    expect(requiresAssigneeRevalidation(before, after)).toBe(true);
    expect(requiresAssigneeRevalidation(before, before)).toBe(false);
  });

  it('classifies availability-only failure', () => {
    expect(isAvailabilityOnlyFailure(['not_available'])).toBe(true);
    expect(isAvailabilityOnlyFailure(['not_available', 'shift_overlap'])).toBe(false);
    expect(
      classifyAssigneeImpact({ eligible: false, reasons: ['not_available'] }),
    ).toBe('availability_override_available');
    expect(
      classifyAssigneeImpact({ eligible: false, reasons: ['shift_overlap'] }),
    ).toBe('must_unassign');
    expect(classifyAssigneeImpact({ eligible: true, reasons: [] })).toBe('eligible');
  });

  it('maps reason messages for Ops display', () => {
    expect(reasonMessages(['not_available', 'prior_shift_buffer'])).toEqual([
      'Submitted availability does not cover the revised schedule.',
      'The revised schedule violates the required 2-hour buffer.',
    ]);
  });

  it('allows eligible update without assignment resolution', async () => {
    const shiftMatching = mockMatching({ eligible: true, reasons: [] });
    const result = await assertAssignmentResolutionForUpdate({
      shiftMatching,
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      status: 'filled',
      before: snap(),
      after: snap({ shiftDate: '2026-08-29' }),
    });
    expect(result.shouldUnassign).toBe(false);
    expect(result.availabilityOverride).toBe(false);
  });

  it('requires resolution for availability-only failure', async () => {
    const shiftMatching = mockMatching({ eligible: false, reasons: ['not_available'] });
    await expect(
      assertAssignmentResolutionForUpdate({
        shiftMatching,
        shiftId: 'shift-1',
        assignedStaffId: 'staff-1',
        status: 'filled',
        before: snap(),
        after: snap({ shiftDate: '2026-08-29' }),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'assignee_impact_required' }),
    });
  });

  it('accepts availability override when sole failure is availability', async () => {
    const shiftMatching = mockMatching({ eligible: false, reasons: ['not_available'] });
    const result = await assertAssignmentResolutionForUpdate({
      shiftMatching,
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      status: 'filled',
      before: snap(),
      after: snap({ shiftDate: '2026-08-29' }),
      assignmentResolution: 'availability_override',
    });
    expect(result.availabilityOverride).toBe(true);
    expect(result.shouldUnassign).toBe(false);
  });

  it('rejects availability override for overlap failures', async () => {
    const shiftMatching = mockMatching({ eligible: false, reasons: ['shift_overlap'] });
    await expect(
      assertAssignmentResolutionForUpdate({
        shiftMatching,
        shiftId: 'shift-1',
        assignedStaffId: 'staff-1',
        status: 'filled',
        before: snap(),
        after: snap({ shiftDate: '2026-08-29' }),
        assignmentResolution: 'availability_override',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'assignee_override_not_allowed' }),
    });
  });

  it('rejects availability override for mixed failures', async () => {
    const shiftMatching = mockMatching({
      eligible: false,
      reasons: ['not_available', 'shift_overlap'],
    });
    await expect(
      assertAssignmentResolutionForUpdate({
        shiftMatching,
        shiftId: 'shift-1',
        assignedStaffId: 'staff-1',
        status: 'filled',
        before: snap(),
        after: snap({ shiftDate: '2026-08-29' }),
        assignmentResolution: 'availability_override',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'assignee_override_not_allowed' }),
    });
  });

  it('allows unassign for hard eligibility failures', async () => {
    const shiftMatching = mockMatching({ eligible: false, reasons: ['prior_shift_buffer'] });
    const result = await assertAssignmentResolutionForUpdate({
      shiftMatching,
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      status: 'filled',
      before: snap(),
      after: snap({ shiftDate: '2026-08-29' }),
      assignmentResolution: 'unassign',
    });
    expect(result.shouldUnassign).toBe(true);
  });

  it('requires resolution for role-only incompatibility', async () => {
    const shiftMatching = mockMatching({ eligible: false, reasons: ['role_mismatch'] });
    await expect(
      assertAssignmentResolutionForUpdate({
        shiftMatching,
        shiftId: 'shift-1',
        assignedStaffId: 'staff-1',
        status: 'filled',
        before: snap({ roleNeeded: 'ECA' }),
        after: snap({ roleNeeded: 'ECE' }),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'assignee_impact_required' }),
    });
  });

  it('allows role-only unassign when assignee is incompatible', async () => {
    const shiftMatching = mockMatching({ eligible: false, reasons: ['role_mismatch'] });
    const result = await assertAssignmentResolutionForUpdate({
      shiftMatching,
      shiftId: 'shift-1',
      assignedStaffId: 'staff-1',
      status: 'filled',
      before: snap({ roleNeeded: 'ECA' }),
      after: snap({ roleNeeded: 'ECE' }),
      assignmentResolution: 'unassign',
    });
    expect(result.shouldUnassign).toBe(true);
  });

  it('ignores assignment resolution when shift is pending', async () => {
    const shiftMatching = mockMatching({ eligible: false, reasons: ['not_available'] });
    await expect(
      assertAssignmentResolutionForUpdate({
        shiftMatching,
        shiftId: 'shift-1',
        assignedStaffId: '',
        status: 'pending',
        before: snap(),
        after: snap({ shiftDate: '2026-08-29' }),
        assignmentResolution: 'unassign',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

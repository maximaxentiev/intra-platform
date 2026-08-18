import type { CommunicationType } from '../automated-communications/automated-communications.types';
import { deriveShiftScheduleVersion } from './shift-toronto.util';

export type ShiftReminderInterval = '3d' | '1d' | '2h';

export const SHIFT_REMINDER_INTERVALS: readonly ShiftReminderInterval[] = ['3d', '1d', '2h'];

export const SHIFT_REMINDER_OFFSET_MS: Record<ShiftReminderInterval, number> = {
  '3d': 72 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
};

export const SHIFT_REMINDER_COMMUNICATION_TYPE: Record<ShiftReminderInterval, CommunicationType> = {
  '3d': 'shift_reminder_3d',
  '1d': 'shift_reminder_1d',
  '2h': 'shift_reminder_2h',
};

export function buildShiftReminderIdempotencyKey(params: {
  shiftId: string;
  assignedStaffId: string;
  shiftDate: string;
  startTime: string;
  interval: ShiftReminderInterval;
}): string {
  const scheduleVersion = deriveShiftScheduleVersion(params.shiftDate, params.startTime);
  return `shift:${params.shiftId}:assignment:${params.assignedStaffId}:start:${scheduleVersion}:reminder:${params.interval}`;
}

export function parseShiftReminderIdempotencyKey(key: string): {
  shiftId: string;
  assignedStaffId: string;
  scheduleVersion: string;
  interval: ShiftReminderInterval;
} | null {
  const match =
    /^shift:([^:]+):assignment:([^:]+):start:([^:]+):reminder:(3d|1d|2h)$/.exec(key);
  if (!match) return null;
  return {
    shiftId: match[1]!,
    assignedStaffId: match[2]!,
    scheduleVersion: match[3]!,
    interval: match[4] as ShiftReminderInterval,
  };
}

export function scheduleVersionFromShift(shiftDate: string, startTime: string): string {
  return deriveShiftScheduleVersion(shiftDate, startTime);
}

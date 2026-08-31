import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  applyShiftUpdatePatch,
  detectShiftCommunicationChanges,
  normalizeShiftCommunicationSnapshot,
  validateShiftUpdateCommunicationsInput,
} from './shift-update-changes.util';

const BASE = {
  shiftDate: '2026-08-28',
  startTime: '08:00:00',
  endTime: '16:00:00',
  roleNeeded: 'ECE',
  shiftConfirmationNotes: '',
};

function snap(overrides: Partial<typeof BASE> = {}) {
  return normalizeShiftCommunicationSnapshot({ ...BASE, ...overrides });
}

describe('detectShiftCommunicationChanges', () => {
  it('returns no changes when values match', () => {
    const before = snap();
    expect(detectShiftCommunicationChanges(before, before)).toEqual([]);
  });

  it('detects date only', () => {
    const after = applyShiftUpdatePatch(snap(), { shiftDate: '2026-08-29' });
    const changes = detectShiftCommunicationChanges(snap(), after);
    expect(changes.map((c) => c.field)).toEqual(['date']);
    expect(changes[0]?.label).toBe('Date');
  });

  it('detects start time only as Time', () => {
    const after = applyShiftUpdatePatch(snap(), { startTime: '09:00:00' });
    expect(detectShiftCommunicationChanges(snap(), after).map((c) => c.field)).toEqual(['time']);
  });

  it('detects end time only as Time', () => {
    const after = applyShiftUpdatePatch(snap(), { endTime: '17:00:00' });
    expect(detectShiftCommunicationChanges(snap(), after).map((c) => c.field)).toEqual(['time']);
  });

  it('detects both start and end as one Time item', () => {
    const after = applyShiftUpdatePatch(snap(), {
      startTime: '09:00:00',
      endTime: '17:00:00',
    });
    expect(detectShiftCommunicationChanges(snap(), after).map((c) => c.field)).toEqual(['time']);
  });

  it('detects role only', () => {
    const after = applyShiftUpdatePatch(snap(), { roleNeeded: 'RECE' });
    const changes = detectShiftCommunicationChanges(snap(), after);
    expect(changes.map((c) => c.field)).toEqual(['role']);
    expect(changes[0]?.label).toBe('Role required');
  });

  it('detects date + time + role', () => {
    const after = applyShiftUpdatePatch(snap(), {
      shiftDate: '2026-08-29',
      startTime: '09:00:00',
      roleNeeded: 'RECE',
    });
    expect(detectShiftCommunicationChanges(snap(), after).map((c) => c.field)).toEqual([
      'date',
      'time',
      'role',
    ]);
  });

  it('returns no changes when patch reverts to original', () => {
    const before = snap({ shiftDate: '2026-08-28' });
    const after = applyShiftUpdatePatch(before, { shiftDate: '2026-08-28' });
    expect(detectShiftCommunicationChanges(before, after)).toEqual([]);
  });

  it('detects shift notes only', () => {
    const after = applyShiftUpdatePatch(snap(), { confirmationNotes: 'Bring indoor shoes.' });
    const changes = detectShiftCommunicationChanges(snap(), after);
    expect(changes.map((c) => c.field)).toEqual(['shiftNotes']);
    expect(changes[0]?.label).toBe('Shift Notes');
  });

  it('detects blank to text and text to blank shift notes', () => {
    const withNotes = snap({ shiftConfirmationNotes: 'Existing note' });
    const cleared = applyShiftUpdatePatch(withNotes, { confirmationNotes: '' });
    expect(detectShiftCommunicationChanges(withNotes, cleared)[0]?.field).toBe('shiftNotes');

    const added = applyShiftUpdatePatch(snap(), { confirmationNotes: 'New note' });
    expect(detectShiftCommunicationChanges(snap(), added)[0]?.afterValue).toBe('New note');
  });

  it('does not detect shift notes when unchanged', () => {
    const before = snap({ shiftConfirmationNotes: 'Same note' });
    const after = applyShiftUpdatePatch(before, { confirmationNotes: 'Same note' });
    expect(detectShiftCommunicationChanges(before, after)).toEqual([]);
  });

  it('formats Toronto-style date and time labels', () => {
    const after = applyShiftUpdatePatch(snap(), {
      shiftDate: '2026-08-29',
      startTime: '09:00:00',
      endTime: '17:00:00',
    });
    const changes = detectShiftCommunicationChanges(snap(), after);
    const dateChange = changes.find((c) => c.field === 'date');
    const timeChange = changes.find((c) => c.field === 'time');
    expect(dateChange?.afterDisplay).toMatch(/August 29, 2026/);
    expect(timeChange?.afterDisplay).toMatch(/9:00 AM.*5:00 PM/);
  });
});

describe('validateShiftUpdateCommunicationsInput', () => {
  const changes = detectShiftCommunicationChanges(
    snap(),
    applyShiftUpdatePatch(snap(), { shiftDate: '2026-08-29', startTime: '09:00:00' }),
  );

  it('returns null when communications omitted', () => {
    expect(validateShiftUpdateCommunicationsInput({ changes })).toBeNull();
  });

  it('accepts centre and carer selections', () => {
    const result = validateShiftUpdateCommunicationsInput({
      changes,
      communications: {
        centre: { send: true, include: { date: true, time: true } },
        carer: { send: true, include: { date: true } },
      },
    });
    expect(result?.centre?.include).toEqual(['date', 'time']);
    expect(result?.carer?.include).toEqual(['date']);
  });

  it('rejects include for unchanged field', () => {
    expect(() =>
      validateShiftUpdateCommunicationsInput({
        changes,
        communications: {
          centre: { send: true, include: { date: true, role: true } },
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('allows empty include selections when assignment is being removed', () => {
    const result = validateShiftUpdateCommunicationsInput({
      changes,
      communications: {
        centre: { send: true, include: {} },
      },
      assignmentUnassigned: true,
    });
    expect(result?.centre?.include).toEqual([]);
  });
});

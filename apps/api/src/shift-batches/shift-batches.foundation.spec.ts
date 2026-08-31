import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(apiRoot, rel), 'utf8');

describe('Batch Shift Requests Phase A regressions', () => {
  it('does not alter assignment confirmation services for batch suppression yet', () => {
    const assignment = read('shifts/shift-assignment-confirmation.service.ts');
    expect(assignment).not.toContain('batchId');
    expect(assignment).not.toContain('shift_batches');
  });

  it('keeps report shift metrics on shifts table only', () => {
    const reports = read('reports/reports-shift.service.ts');
    expect(reports).not.toContain('shift_batches');
    expect(reports).toContain('.from(shifts)');
  });

  it('does not expose legacy shifts.notes as confirmationNotes in create', () => {
    const shiftsService = read('shifts/shifts.service.ts');
    expect(shiftsService).toContain('shiftConfirmationNotes: confirmationNotes');
    expect(shiftsService).not.toMatch(/shiftConfirmationNotes:\s*dto\.notes/);
  });

  it('documents no persisted batch child deletion in Phase A', () => {
    const batches = read('shift-batches/shift-batches.service.ts');
    expect(batches).not.toMatch(/delete\(shifts\)/);
  });
});

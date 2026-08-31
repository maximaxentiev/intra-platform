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

  it('models composite batch centre invariant in Drizzle schema', () => {
    const schema = read('db/schema.ts');
    expect(schema).toContain("unique('shift_batches_id_centre_unique')");
    expect(schema).toContain("name: 'shifts_batch_centre_fk'");
    expect(schema).toContain('foreignColumns: [shiftBatches.id, shiftBatches.centreId]');
  });

  it('retains service-level batch centre guards for defense in depth', () => {
    const shiftsService = read('shifts/shifts.service.ts');
    expect(shiftsService).toContain('lockOpenShiftBatch');
    expect(shiftsService).toContain('assertShiftCentreMatchesBatch');
    expect(shiftsService).toContain('Cannot change centre for a shift that belongs to a batch');
  });

  it('documents batch centre immutability helper for future update endpoints', () => {
    const util = read('shift-batches/shift-batch-centre.util.ts');
    expect(util).toContain('assertBatchCentreImmutable');
    expect(util).toContain('Batch centre cannot be changed once child shifts exist');
  });
});

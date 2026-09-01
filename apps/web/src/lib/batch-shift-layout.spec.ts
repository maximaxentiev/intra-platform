import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const webRoot = resolve(__dirname, '..');

function read(relativePath: string) {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

describe('BatchDraftShiftRow layout', () => {
  it('keeps Duplicate/Remove in card header separate from field grid', () => {
    const row = read('components/shifts/BatchDraftShiftRow.tsx');
    expect(row).toContain('Shift {index + 1}');
    expect(row).toContain('Duplicate');
    expect(row).toContain('Remove');
    expect(row).toMatch(/mb-3 flex items-center justify-between[\s\S]*grid grid-cols-1/);
  });

  it('uses consistent draft field surfaces for notes and internal comment', () => {
    const row = read('components/shifts/BatchDraftShiftRow.tsx');
    expect(row).toContain('inputClassName={draftFieldClass}');
    expect(row).toContain('draftFieldClass');
    expect(row).toContain('bg-white');
  });

  it('uses responsive field grid breakpoints', () => {
    const row = read('components/shifts/BatchDraftShiftRow.tsx');
    expect(row).toContain('sm:grid-cols-2');
    expect(row).toContain('2xl:grid-cols-6');
  });
});

describe('Send Updates dialog presentation', () => {
  it('shows shift context and label separately', () => {
    const dialog = read('components/shifts/BatchSendUpdatesConfirmationAction.tsx');
    expect(dialog).toContain('change.shiftLabel');
    expect(dialog).toContain('change.label');
  });
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('centre form staff-facing notes label', () => {
  it('labels notes as Rules, Policies, and Other Notes without helper copy', () => {
    const form = readFileSync(join(webRoot, 'components/CentreForm.tsx'), 'utf8');
    expect(form).toContain('Rules, Policies, and Other Notes');
    expect(form).not.toContain('shared with carers when they are assigned to shifts');
  });
});

describe('ops shift assignment confirmation UI', () => {
  it('uses structured assign response and resend endpoint', () => {
    const db = readFileSync(join(webRoot, 'lib/db.ts'), 'utf8');
    const page = readFileSync(join(webRoot, 'routes/_authenticated/shifts.$id.tsx'), 'utf8');
    const staffList = readFileSync(join(webRoot, 'components/shifts/ShiftAvailableStaffList.tsx'), 'utf8');
    expect(db).toContain('ShiftAssignResponse');
    expect(db).toContain('send-assignment-confirmation');
    expect(page).toContain('shiftAssignmentFeedbackMessage');
    expect(staffList).toContain('Resend confirmation');
    expect(page).toContain('assigningStaffId');
  });
});

describe('ops shift smart matching UI', () => {
  it('does not client-filter available staff by role', () => {
    const page = readFileSync(join(webRoot, 'routes/_authenticated/shifts.$id.tsx'), 'utf8');
    expect(page).not.toContain('.filter((s) => s.role === shift.roleNeeded)');
    expect(page).toContain('availableQ.data ?? []');
  });

  it("uses a desktop grid for available staff rows", () => {
    const page = readFileSync(join(webRoot, 'routes/_authenticated/shifts.$id.tsx'), 'utf8');
    const list = readFileSync(join(webRoot, 'components/shifts/ShiftAvailableStaffList.tsx'), 'utf8');
    expect(page).toContain('ShiftAvailableStaffList');
    expect(list).toContain('md:grid-cols-[minmax(8rem,1.05fr)_minmax(0,2.5fr)_5rem_auto_auto]');
    expect(list).toContain('formatAvailableStaffPriorityLine');
    expect(page).not.toContain('Eligible based on availability, conflicts, centre restrictions and compliance.');
  });

  it('invalidates available staff query after assign eligibility conflict', () => {
    const page = readFileSync(join(webRoot, 'routes/_authenticated/shifts.$id.tsx'), 'utf8');
    expect(page).toContain('err.status === 409');
    expect(page).toContain('["shift-available", id]');
  });
});

describe('centre hourly rate UI', () => {
  it('does not expose hourly rate in the active centre edit form', () => {
    const form = readFileSync(join(webRoot, 'components/CentreForm.tsx'), 'utf8');
    expect(form).not.toContain('Hourly Rate');
    expect(form).not.toContain('id="hourlyRate"');
  });
});

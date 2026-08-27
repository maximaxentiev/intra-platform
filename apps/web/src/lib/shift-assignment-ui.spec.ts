import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('centre form staff-facing notes label', () => {
  it('labels notes as Rules, Policies, and Other Notes with helper copy', () => {
    const form = readFileSync(join(webRoot, 'components/CentreForm.tsx'), 'utf8');
    expect(form).toContain('Rules, Policies, and Other Notes');
    expect(form).toContain('shared with carers when they are assigned to shifts');
  });
});

describe('ops shift assignment confirmation UI', () => {
  it('uses structured assign response and resend endpoint', () => {
    const db = readFileSync(join(webRoot, 'lib/db.ts'), 'utf8');
    const page = readFileSync(join(webRoot, 'routes/_authenticated/shifts.$id.tsx'), 'utf8');
    expect(db).toContain('ShiftAssignResponse');
    expect(db).toContain('send-assignment-confirmation');
    expect(page).toContain('shiftAssignmentFeedbackMessage');
    expect(page).toContain('Resend confirmations');
    expect(page).toContain('assigningStaffId');
  });
});

describe('ops shift smart matching UI', () => {
  it('does not client-filter available staff by role', () => {
    const page = readFileSync(join(webRoot, 'routes/_authenticated/shifts.$id.tsx'), 'utf8');
    expect(page).not.toContain('.filter((s) => s.role === shift.roleNeeded)');
    expect(page).toContain('availableQ.data ?? []');
  });

  it('shows smart matching helper and empty state copy', () => {
    const page = readFileSync(join(webRoot, 'routes/_authenticated/shifts.$id.tsx'), 'utf8');
    expect(page).toContain('Eligible staff are filtered automatically');
    expect(page).toContain('No eligible staff found for this shift.');
    expect(page).toContain('document compliance are considered automatically');
    expect(page).toContain('formatAvailableStaffPriorityLine');
  });

  it('invalidates available staff query after assign eligibility conflict', () => {
    const page = readFileSync(join(webRoot, 'routes/_authenticated/shifts.$id.tsx'), 'utf8');
    expect(page).toContain('err.status === 409');
    expect(page).toContain('["shift-available", id]');
  });
});

describe('centre hourly rate UI', () => {
  it('includes Hourly Rate field with neutral helper copy', () => {
    const form = readFileSync(join(webRoot, 'components/CentreForm.tsx'), 'utf8');
    expect(form).toContain('Hourly Rate');
    expect(form).toContain('Stores the agreed hourly rate for this centre.');
    expect(form).not.toContain('future invoicing and reporting');
    expect(form).toContain('hourlyRate');
  });
});

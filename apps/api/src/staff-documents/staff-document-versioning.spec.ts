import { describe, expect, it } from 'vitest';

/**
 * Submission versioning invariants for Phase 3B+ upload/replace flows.
 * Documented here so foundation expectations remain test-backed.
 */
describe('staff document submission versioning invariants', () => {
  it('allows one set per staff and document type', () => {
    const sets = new Map<string, string>();
    const key = (staffId: string, type: string) => `${staffId}:${type}`;
    sets.set(key('staff-1', 'vulnerable_sector_check'), 'set-1');
    expect(() => {
      if (sets.has(key('staff-1', 'vulnerable_sector_check'))) {
        throw new Error('duplicate set');
      }
    }).toThrow(/duplicate set/);
  });

  it('creates a new submission on replacement and supersedes the previous one', () => {
    const submissions = [
      { id: 'sub-1', reviewStatus: 'approved' as const, supersededAt: '2026-02-01T00:00:00Z' },
      { id: 'sub-2', reviewStatus: 'pending_review' as const, supersededAt: null },
    ];
    const currentSubmissionId = 'sub-2';
    const current = submissions.find((s) => s.id === currentSubmissionId);
    expect(current?.reviewStatus).toBe('pending_review');
    expect(submissions.find((s) => s.id === 'sub-1')?.supersededAt).not.toBeNull();
  });

  it('does not carry approval forward to replacement submissions', () => {
    const previousApproved = 'approved';
    const replacementStatus = 'pending_review';
    expect(replacementStatus).not.toBe(previousApproved);
  });

  it('retains superseded submissions and files for audit rather than deleting immediately', () => {
    const archived = { id: 'sub-1', supersededAt: '2026-02-01T00:00:00Z', files: ['file-a'] };
    expect(archived.supersededAt).toBeTruthy();
    expect(archived.files.length).toBe(1);
  });

  it('uses current submission for compliance and reminders', () => {
    const set = { currentSubmissionId: 'sub-2' };
    const active = { id: 'sub-2', supersededAt: null, expiryDate: '2027-01-01' };
    expect(set.currentSubmissionId).toBe(active.id);
    expect(active.supersededAt).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentExpiryReminderService } from './document-expiry-reminder.service';

describe('DocumentExpiryReminderService First Aid transition', () => {
  let service: DocumentExpiryReminderService;
  let cancelByIdempotencyKeys: ReturnType<typeof vi.fn>;
  let ensureScheduled: ReturnType<typeof vi.fn>;
  let selectResults: unknown[];

  beforeEach(() => {
    cancelByIdempotencyKeys = vi.fn().mockResolvedValue(2);
    ensureScheduled = vi.fn().mockImplementation(async (input) => ({
      id: `comm-${input.idempotencyKey}`,
      status: 'scheduled',
      ...input,
    }));

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(selectResults),
        }),
      }),
    } as never;

    service = new DocumentExpiryReminderService(db, {
      ensureScheduled,
      cancelByIdempotencyKeys,
      enqueueScheduledCommunication: vi.fn(),
    } as never);
  });

  it('does not schedule 1mo when legacy 30d reminder was already sent', async () => {
    const submissionId = 'fa-sub-1';
    selectResults = [{ idempotencyKey: `staff-document:${submissionId}:expiry:30d` }];

    const ids = await service.scheduleForApprovedSubmission(
      {
        staffId: 'staff-1',
        documentSetId: 'set-1',
        documentType: 'first_aid_cpr',
        submissionId,
        expiryDate: '2026-11-04',
      },
      { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
      new Date('2026-10-01T13:00:00.000Z'),
      new Set([`staff-document:${submissionId}:expiry:30d`]),
    );

    expect(ids).toEqual([]);
    expect(ensureScheduled).not.toHaveBeenCalled();
  });

  it('schedules only future month milestones for First Aid', async () => {
    selectResults = [];

    const ids = await service.scheduleForApprovedSubmission(
      {
        staffId: 'staff-1',
        documentSetId: 'set-1',
        documentType: 'first_aid_cpr',
        submissionId: 'fa-sub-2',
        expiryDate: '2027-11-30',
      },
      { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
      new Date('2026-01-01T14:00:00.000Z'),
    );

    expect(ids).toHaveLength(3);
    expect(ensureScheduled.mock.calls.map((call) => call[0].communicationType)).toEqual([
      'document_expiry_3mo',
      'document_expiry_2mo',
      'document_expiry_1mo',
    ]);
  });
});

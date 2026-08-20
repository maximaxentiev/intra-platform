import { describe, expect, it } from 'vitest';
import { buildReminderSummariesForSubmissions } from './report-document-reminder.util';

describe('report-document-reminder.util', () => {
  const submissionId = '11111111-1111-4111-8111-111111111111';
  const scheduledId = '22222222-2222-4222-8222-222222222222';
  const now = new Date('2026-08-20T12:00:00.000Z');

  it('returns null reminder fields when no reminders exist', () => {
    const result = buildReminderSummariesForSubmissions([submissionId], [], [], now);
    expect(result.get(submissionId)).toEqual({
      latestReminderStatus: null,
      latestReminderSentAt: null,
      nextReminderAt: null,
    });
  });

  it('reports latest sent reminder and next scheduled reminder', () => {
    const sentAt = new Date('2026-08-05T13:01:00.000Z');
    const nextAt = new Date('2026-09-01T09:00:00.000Z');

    const result = buildReminderSummariesForSubmissions(
      [submissionId],
      [
        {
          id: scheduledId,
          entityId: submissionId,
          scheduledFor: sentAt,
          status: 'sent',
          communicationType: 'document_expiry_30d',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          entityId: submissionId,
          scheduledFor: nextAt,
          status: 'scheduled',
          communicationType: 'document_expiry_14d',
        },
      ],
      [
        {
          scheduledCommunicationId: scheduledId,
          status: 'sent',
          sentAt,
          attemptedAt: sentAt,
        },
      ],
      now,
    );

    expect(result.get(submissionId)).toEqual({
      latestReminderStatus: 'sent',
      latestReminderSentAt: sentAt.toISOString(),
      nextReminderAt: nextAt.toISOString(),
    });
  });

  it('reports failed as latest reminder status', () => {
    const attemptedAt = new Date('2026-08-05T13:01:00.000Z');

    const result = buildReminderSummariesForSubmissions(
      [submissionId],
      [
        {
          id: scheduledId,
          entityId: submissionId,
          scheduledFor: attemptedAt,
          status: 'failed',
          communicationType: 'document_expiry_7d',
        },
      ],
      [
        {
          scheduledCommunicationId: scheduledId,
          status: 'failed',
          sentAt: null,
          attemptedAt,
        },
      ],
      now,
    );

    expect(result.get(submissionId)?.latestReminderStatus).toBe('failed');
    expect(result.get(submissionId)?.latestReminderSentAt).toBeNull();
  });

  it('ignores non-expiry communication types', () => {
    const result = buildReminderSummariesForSubmissions(
      [submissionId],
      [
        {
          id: scheduledId,
          entityId: submissionId,
          scheduledFor: new Date('2026-09-01T09:00:00.000Z'),
          status: 'scheduled',
          communicationType: 'shift_reminder',
        },
      ],
      [],
      now,
    );

    expect(result.get(submissionId)).toEqual({
      latestReminderStatus: null,
      latestReminderSentAt: null,
      nextReminderAt: null,
    });
  });
});

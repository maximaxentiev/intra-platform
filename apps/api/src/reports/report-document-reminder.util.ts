import { DOCUMENT_EXPIRY_COMMUNICATION_TYPES } from '../staff-documents/document-expiry-reminder.types';
import type { DocumentReportReminderStatus } from './report-document-status.util';

export interface ReminderScheduledRow {
  id: string;
  entityId: string;
  scheduledFor: Date;
  status: string;
  communicationType: string;
}

export interface ReminderDeliveryRow {
  scheduledCommunicationId: string;
  status: string;
  sentAt: Date | null;
  attemptedAt: Date;
}

export interface DocumentReminderSummary {
  latestReminderStatus: DocumentReportReminderStatus | null;
  latestReminderSentAt: string | null;
  nextReminderAt: string | null;
}

const EXPIRY_TYPES = new Set<string>(DOCUMENT_EXPIRY_COMMUNICATION_TYPES);

function isExpiryReminder(row: ReminderScheduledRow): boolean {
  return EXPIRY_TYPES.has(row.communicationType);
}

function mapDeliveryStatus(status: string): DocumentReportReminderStatus | null {
  if (status === 'sent') return 'sent';
  if (status === 'failed') return 'failed';
  return null;
}

/** Summarize reminder state for current submissions only (batch-friendly). */
export function buildReminderSummariesForSubmissions(
  submissionIds: readonly string[],
  scheduledRows: readonly ReminderScheduledRow[],
  deliveryRows: readonly ReminderDeliveryRow[],
  now: Date = new Date(),
): Map<string, DocumentReminderSummary> {
  const result = new Map<string, DocumentReminderSummary>();
  if (submissionIds.length === 0) {
    return result;
  }

  const scheduledBySubmission = new Map<string, ReminderScheduledRow[]>();
  for (const row of scheduledRows) {
    if (!isExpiryReminder(row)) continue;
    const list = scheduledBySubmission.get(row.entityId) ?? [];
    list.push(row);
    scheduledBySubmission.set(row.entityId, list);
  }

  const deliveriesByScheduledId = new Map<string, ReminderDeliveryRow[]>();
  for (const row of deliveryRows) {
    const list = deliveriesByScheduledId.get(row.scheduledCommunicationId) ?? [];
    list.push(row);
    deliveriesByScheduledId.set(row.scheduledCommunicationId, list);
  }

  for (const submissionId of submissionIds) {
    const comms = scheduledBySubmission.get(submissionId) ?? [];
    const deliveries: ReminderDeliveryRow[] = [];
    for (const comm of comms) {
      deliveries.push(...(deliveriesByScheduledId.get(comm.id) ?? []));
    }

    let latestReminderSentAt: string | null = null;
    let latestReminderStatus: DocumentReportReminderStatus | null = null;
    let latestActivityMs = -1;

    for (const delivery of deliveries) {
      const activityAt = delivery.sentAt ?? delivery.attemptedAt;
      const activityMs = activityAt.getTime();
      if (activityMs > latestActivityMs) {
        latestActivityMs = activityMs;
        latestReminderStatus = mapDeliveryStatus(delivery.status);
        latestReminderSentAt =
          delivery.status === 'sent' && delivery.sentAt
            ? delivery.sentAt.toISOString()
            : null;
      }
    }

    const futureScheduled = comms
      .filter((row) => row.status === 'scheduled' && row.scheduledFor.getTime() > now.getTime())
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

    const nextReminderAt =
      futureScheduled.length > 0 ? futureScheduled[0]!.scheduledFor.toISOString() : null;

    if (!latestReminderStatus && futureScheduled.length > 0) {
      latestReminderStatus = 'scheduled';
    }

    result.set(submissionId, {
      latestReminderStatus,
      latestReminderSentAt,
      nextReminderAt,
    });
  }

  return result;
}

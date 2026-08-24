/** Known communication types — validated in TS, stored as text in PostgreSQL. */
export type CommunicationType =
  | 'shift_reminder_3d'
  | 'shift_reminder_1d'
  | 'shift_reminder_2h'
  | 'shift_cancellation_centre'
  | 'shift_cancellation_carer'
  | 'document_expiry_30d'
  | 'document_expiry_14d'
  | 'document_expiry_7d'
  | 'document_expiry_3d'
  | 'document_expiry_1d'
  | 'document_expiry_3mo'
  | 'document_expiry_2mo'
  | 'document_expiry_1mo'
  | 'test_ping';

export type ScheduledCommunicationStatus =
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled';

export type CommunicationDeliveryStatus = 'sent' | 'failed' | 'skipped';

export type CommunicationEntityType = 'shift' | 'staff_document' | 'test';

export type CommunicationRecipientType = 'centre' | 'carer' | 'staff' | 'test';

export type ScheduleCommunicationInput = {
  idempotencyKey: string;
  communicationType: CommunicationType;
  entityType: CommunicationEntityType;
  entityId: string;
  recipientType: CommunicationRecipientType;
  recipientEntityId?: string | null;
  scheduledFor: Date;
};

export type CommunicationProcessorOutcome =
  | { kind: 'valid'; recipientEmail: string; subject: string; html: string; text: string }
  | { kind: 'stale' }
  | { kind: 'skipped'; code: string; reason: string }
  | { kind: 'permanent_failure'; code: string; reason: string };

export type CommunicationJobPayload = {
  scheduledCommunicationId: string;
};

export const COMMUNICATION_TYPE_VALUES: readonly CommunicationType[] = [
  'shift_reminder_3d',
  'shift_reminder_1d',
  'shift_reminder_2h',
  'shift_cancellation_centre',
  'shift_cancellation_carer',
  'document_expiry_30d',
  'document_expiry_14d',
  'document_expiry_7d',
  'document_expiry_3d',
  'document_expiry_1d',
  'document_expiry_3mo',
  'document_expiry_2mo',
  'document_expiry_1mo',
  'test_ping',
] as const;

export function isCommunicationType(value: string): value is CommunicationType {
  return (COMMUNICATION_TYPE_VALUES as readonly string[]).includes(value);
}

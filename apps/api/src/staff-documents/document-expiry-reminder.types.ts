import type { CommunicationType } from '../automated-communications/automated-communications.types';
import { STAFF_DOCUMENT_REMINDER_OFFSETS_DAYS } from './staff-document.constants';

export type DocumentExpiryReminderOffsetDays = (typeof STAFF_DOCUMENT_REMINDER_OFFSETS_DAYS)[number];

export const DOCUMENT_EXPIRY_REMINDER_OFFSETS: readonly DocumentExpiryReminderOffsetDays[] =
  STAFF_DOCUMENT_REMINDER_OFFSETS_DAYS;

export const DOCUMENT_EXPIRY_COMMUNICATION_TYPE: Record<
  DocumentExpiryReminderOffsetDays,
  CommunicationType
> = {
  30: 'document_expiry_30d',
  14: 'document_expiry_14d',
  7: 'document_expiry_7d',
  3: 'document_expiry_3d',
  1: 'document_expiry_1d',
};

export const DOCUMENT_EXPIRY_COMMUNICATION_TYPES = Object.values(
  DOCUMENT_EXPIRY_COMMUNICATION_TYPE,
) as CommunicationType[];

export function buildDocumentExpiryIdempotencyKey(params: {
  submissionId: string;
  offsetDays: DocumentExpiryReminderOffsetDays;
}): string {
  return `staff-document:${params.submissionId}:expiry:${params.offsetDays}d`;
}

export function parseDocumentExpiryIdempotencyKey(key: string): {
  submissionId: string;
  offsetDays: DocumentExpiryReminderOffsetDays;
} | null {
  const match = /^staff-document:([^:]+):expiry:(30|14|7|3|1)d$/.exec(key);
  if (!match) return null;
  return {
    submissionId: match[1]!,
    offsetDays: Number(match[2]) as DocumentExpiryReminderOffsetDays,
  };
}

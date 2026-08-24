import type { CommunicationType } from '../automated-communications/automated-communications.types';
import {
  FIRST_AID_REMINDER_OFFSETS_MONTHS,
  VSC_REMINDER_OFFSETS_DAYS,
} from './staff-document.constants';

export type DocumentExpiryReminderOffsetDays = (typeof VSC_REMINDER_OFFSETS_DAYS)[number];

export type DocumentExpiryReminderOffsetMonths = (typeof FIRST_AID_REMINDER_OFFSETS_MONTHS)[number];

export const VSC_DOCUMENT_EXPIRY_REMINDER_OFFSETS_DAYS: readonly DocumentExpiryReminderOffsetDays[] =
  VSC_REMINDER_OFFSETS_DAYS;

export const FIRST_AID_DOCUMENT_EXPIRY_REMINDER_OFFSETS_MONTHS: readonly DocumentExpiryReminderOffsetMonths[] =
  FIRST_AID_REMINDER_OFFSETS_MONTHS;

/** @deprecated Use VSC_DOCUMENT_EXPIRY_REMINDER_OFFSETS_DAYS */
export const DOCUMENT_EXPIRY_REMINDER_OFFSETS: readonly DocumentExpiryReminderOffsetDays[] =
  VSC_DOCUMENT_EXPIRY_REMINDER_OFFSETS_DAYS;

export const DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE: Record<
  DocumentExpiryReminderOffsetDays,
  CommunicationType
> = {
  30: 'document_expiry_30d',
  14: 'document_expiry_14d',
  7: 'document_expiry_7d',
  3: 'document_expiry_3d',
  1: 'document_expiry_1d',
};

export const DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE: Record<
  DocumentExpiryReminderOffsetMonths,
  CommunicationType
> = {
  3: 'document_expiry_3mo',
  2: 'document_expiry_2mo',
  1: 'document_expiry_1mo',
};

/** @deprecated Use DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE */
export const DOCUMENT_EXPIRY_COMMUNICATION_TYPE = DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE;

export const DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPES = Object.values(
  DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE,
) as CommunicationType[];

export const DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPES = Object.values(
  DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE,
) as CommunicationType[];

export const ALL_DOCUMENT_EXPIRY_COMMUNICATION_TYPES = [
  ...DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPES,
  ...DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPES,
] as const satisfies readonly CommunicationType[];

/** @deprecated Use ALL_DOCUMENT_EXPIRY_COMMUNICATION_TYPES */
export const DOCUMENT_EXPIRY_COMMUNICATION_TYPES = ALL_DOCUMENT_EXPIRY_COMMUNICATION_TYPES;

export const LEGACY_FIRST_AID_DAY_COMMUNICATION_TYPES = DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPES;

export function buildDocumentExpiryIdempotencyKeyDays(params: {
  submissionId: string;
  offsetDays: DocumentExpiryReminderOffsetDays;
}): string {
  return `staff-document:${params.submissionId}:expiry:${params.offsetDays}d`;
}

export function buildDocumentExpiryIdempotencyKeyMonths(params: {
  submissionId: string;
  offsetMonths: DocumentExpiryReminderOffsetMonths;
}): string {
  return `staff-document:${params.submissionId}:expiry:${params.offsetMonths}mo`;
}

/** @deprecated Use buildDocumentExpiryIdempotencyKeyDays */
export function buildDocumentExpiryIdempotencyKey(params: {
  submissionId: string;
  offsetDays: DocumentExpiryReminderOffsetDays;
}): string {
  return buildDocumentExpiryIdempotencyKeyDays(params);
}

export function buildLegacyFirstAidDayIdempotencyKeys(submissionId: string): string[] {
  return VSC_DOCUMENT_EXPIRY_REMINDER_OFFSETS_DAYS.map((offsetDays) =>
    buildDocumentExpiryIdempotencyKeyDays({ submissionId, offsetDays }),
  );
}

export type ParsedDocumentExpiryIdempotencyKey =
  | {
      unit: 'days';
      submissionId: string;
      offsetDays: DocumentExpiryReminderOffsetDays;
    }
  | {
      unit: 'months';
      submissionId: string;
      offsetMonths: DocumentExpiryReminderOffsetMonths;
    };

export function parseDocumentExpiryIdempotencyKey(key: string): ParsedDocumentExpiryIdempotencyKey | null {
  const dayMatch = /^staff-document:([^:]+):expiry:(30|14|7|3|1)d$/.exec(key);
  if (dayMatch) {
    return {
      unit: 'days',
      submissionId: dayMatch[1]!,
      offsetDays: Number(dayMatch[2]) as DocumentExpiryReminderOffsetDays,
    };
  }

  const monthMatch = /^staff-document:([^:]+):expiry:(3|2|1)mo$/.exec(key);
  if (monthMatch) {
    return {
      unit: 'months',
      submissionId: monthMatch[1]!,
      offsetMonths: Number(monthMatch[2]) as DocumentExpiryReminderOffsetMonths,
    };
  }

  return null;
}

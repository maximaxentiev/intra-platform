import type { CommunicationType } from '../automated-communications/automated-communications.types';

export const CENTRE_SHIFT_HISTORY_COMMUNICATION_TYPE =
  'centre_shift_history' as const satisfies CommunicationType;

export const CENTRE_SHIFT_HISTORY_IDEMPOTENCY_PREFIX = 'centre_shift_history:v1:';

const IDEMPOTENCY_RE =
  /^centre_shift_history:v1:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2}):([0-9a-f-]{36})$/i;

export function buildCentreShiftHistoryIdempotencyKey(input: {
  centreId: string;
  dateFrom: string;
  dateTo: string;
  requestId: string;
}): string {
  return `${CENTRE_SHIFT_HISTORY_IDEMPOTENCY_PREFIX}${input.centreId}:${input.dateFrom}:${input.dateTo}:${input.requestId}`;
}

export function parseCentreShiftHistoryIdempotencyKey(key: string): {
  centreId: string;
  dateFrom: string;
  dateTo: string;
  requestId: string;
} | null {
  const match = IDEMPOTENCY_RE.exec(key);
  if (!match) return null;
  return {
    centreId: match[1]!,
    dateFrom: match[2]!,
    dateTo: match[3]!,
    requestId: match[4]!,
  };
}

export function sanitizeCentreFilenameSegment(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'centre';
}

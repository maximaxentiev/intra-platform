import { describe, expect, it } from 'vitest';
import {
  buildDocumentExpiryIdempotencyKeyDays,
  buildDocumentExpiryIdempotencyKeyMonths,
  buildLegacyFirstAidDayIdempotencyKeys,
  DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE,
  DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE,
  parseDocumentExpiryIdempotencyKey,
} from './document-expiry-reminder.types';

describe('document expiry reminder idempotency keys', () => {
  const submissionId = '11111111-1111-4111-8111-111111111111';

  it('builds VSC day-scoped keys for each offset', () => {
    expect(buildDocumentExpiryIdempotencyKeyDays({ submissionId, offsetDays: 30 })).toBe(
      `staff-document:${submissionId}:expiry:30d`,
    );
    expect(buildDocumentExpiryIdempotencyKeyDays({ submissionId, offsetDays: 1 })).toBe(
      `staff-document:${submissionId}:expiry:1d`,
    );
  });

  it('builds First Aid month-scoped keys for each offset', () => {
    expect(buildDocumentExpiryIdempotencyKeyMonths({ submissionId, offsetMonths: 3 })).toBe(
      `staff-document:${submissionId}:expiry:3mo`,
    );
    expect(buildDocumentExpiryIdempotencyKeyMonths({ submissionId, offsetMonths: 2 })).toBe(
      `staff-document:${submissionId}:expiry:2mo`,
    );
    expect(buildDocumentExpiryIdempotencyKeyMonths({ submissionId, offsetMonths: 1 })).toBe(
      `staff-document:${submissionId}:expiry:1mo`,
    );
  });

  it('parses day and month keys and rejects malformed keys', () => {
    const dayKey = buildDocumentExpiryIdempotencyKeyDays({ submissionId, offsetDays: 7 });
    expect(parseDocumentExpiryIdempotencyKey(dayKey)).toEqual({
      unit: 'days',
      submissionId,
      offsetDays: 7,
    });

    const monthKey = buildDocumentExpiryIdempotencyKeyMonths({ submissionId, offsetMonths: 2 });
    expect(parseDocumentExpiryIdempotencyKey(monthKey)).toEqual({
      unit: 'months',
      submissionId,
      offsetMonths: 2,
    });

    expect(parseDocumentExpiryIdempotencyKey('shift:123:expiry:7d')).toBeNull();
    expect(parseDocumentExpiryIdempotencyKey(`staff-document:${submissionId}:expiry:2d`)).toBeNull();
    expect(parseDocumentExpiryIdempotencyKey(`staff-document:${submissionId}:expiry:4mo`)).toBeNull();
  });

  it('maps VSC day offsets to production communication types', () => {
    expect(DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE[30]).toBe('document_expiry_30d');
    expect(DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE[14]).toBe('document_expiry_14d');
    expect(DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE[7]).toBe('document_expiry_7d');
    expect(DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE[3]).toBe('document_expiry_3d');
    expect(DOCUMENT_EXPIRY_DAY_COMMUNICATION_TYPE[1]).toBe('document_expiry_1d');
  });

  it('maps First Aid month offsets to production communication types', () => {
    expect(DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE[3]).toBe('document_expiry_3mo');
    expect(DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE[2]).toBe('document_expiry_2mo');
    expect(DOCUMENT_EXPIRY_MONTH_COMMUNICATION_TYPE[1]).toBe('document_expiry_1mo');
  });

  it('lists all legacy First Aid day keys for transition cleanup', () => {
    expect(buildLegacyFirstAidDayIdempotencyKeys(submissionId)).toEqual([
      `staff-document:${submissionId}:expiry:30d`,
      `staff-document:${submissionId}:expiry:14d`,
      `staff-document:${submissionId}:expiry:7d`,
      `staff-document:${submissionId}:expiry:3d`,
      `staff-document:${submissionId}:expiry:1d`,
    ]);
  });
});

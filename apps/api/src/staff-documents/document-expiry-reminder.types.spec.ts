import { describe, expect, it } from 'vitest';
import {
  buildDocumentExpiryIdempotencyKey,
  DOCUMENT_EXPIRY_COMMUNICATION_TYPE,
  parseDocumentExpiryIdempotencyKey,
} from './document-expiry-reminder.types';

describe('document expiry reminder idempotency keys', () => {
  it('builds submission-scoped keys for each offset', () => {
    const submissionId = '11111111-1111-4111-8111-111111111111';
    expect(buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: 30 })).toBe(
      `staff-document:${submissionId}:expiry:30d`,
    );
    expect(buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: 1 })).toBe(
      `staff-document:${submissionId}:expiry:1d`,
    );
  });

  it('parses valid keys and rejects malformed keys', () => {
    const submissionId = '22222222-2222-4222-8222-222222222222';
    const key = buildDocumentExpiryIdempotencyKey({ submissionId, offsetDays: 7 });
    expect(parseDocumentExpiryIdempotencyKey(key)).toEqual({ submissionId, offsetDays: 7 });
    expect(parseDocumentExpiryIdempotencyKey('shift:123:expiry:7d')).toBeNull();
    expect(parseDocumentExpiryIdempotencyKey(`staff-document:${submissionId}:expiry:2d`)).toBeNull();
  });

  it('maps offsets to production communication types', () => {
    expect(DOCUMENT_EXPIRY_COMMUNICATION_TYPE[30]).toBe('document_expiry_30d');
    expect(DOCUMENT_EXPIRY_COMMUNICATION_TYPE[14]).toBe('document_expiry_14d');
    expect(DOCUMENT_EXPIRY_COMMUNICATION_TYPE[7]).toBe('document_expiry_7d');
    expect(DOCUMENT_EXPIRY_COMMUNICATION_TYPE[3]).toBe('document_expiry_3d');
    expect(DOCUMENT_EXPIRY_COMMUNICATION_TYPE[1]).toBe('document_expiry_1d');
  });
});

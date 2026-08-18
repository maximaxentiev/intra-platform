import { describe, expect, it } from 'vitest';
import { EmailDeliveryError } from '../email/email.transport';
import {
  classifyEmailDeliveryError,
  communicationRetryBackoffMs,
  sanitizeCommunicationFailureReason,
} from './communication-retry.util';

describe('classifyEmailDeliveryError', () => {
  it('retries 429 and 5xx', () => {
    expect(classifyEmailDeliveryError(new EmailDeliveryError('Email delivery failed (429)'))).toBe(
      'retryable',
    );
    expect(classifyEmailDeliveryError(new EmailDeliveryError('Email delivery failed (503)'))).toBe(
      'retryable',
    );
  });

  it('treats most 4xx as permanent', () => {
    expect(classifyEmailDeliveryError(new EmailDeliveryError('Email delivery failed (422)'))).toBe(
      'permanent',
    );
  });
});

describe('communicationRetryBackoffMs', () => {
  it('returns increasing delays', () => {
    expect(communicationRetryBackoffMs(1)).toBe(60_000);
    expect(communicationRetryBackoffMs(2)).toBe(5 * 60_000);
    expect(communicationRetryBackoffMs(5)).toBe(4 * 60 * 60_000);
  });
});

describe('sanitizeCommunicationFailureReason', () => {
  it('redacts secrets', () => {
    expect(sanitizeCommunicationFailureReason('token=abc123 secret=xyz')).toContain('[redacted]');
  });
});

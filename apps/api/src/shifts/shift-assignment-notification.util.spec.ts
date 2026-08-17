import { describe, expect, it } from 'vitest';
import { EmailDeliveryError } from '../email/email.service';
import {
  isValidNotificationEmail,
  sanitizeNotificationFailure,
} from './shift-assignment-notification.util';

describe('shift assignment notification utils', () => {
  it('validates notification emails', () => {
    expect(isValidNotificationEmail('centre@example.com')).toBe(true);
    expect(isValidNotificationEmail('')).toBe(false);
    expect(isValidNotificationEmail('not-an-email')).toBe(false);
  });

  it('sanitizes delivery failures without secrets', () => {
    const failure = sanitizeNotificationFailure(
      new EmailDeliveryError('Email delivery failed (401): invalid api_key secret'),
    );
    expect(failure.code).toBe('delivery_failed');
    expect(failure.reason.toLowerCase()).not.toContain('secret');
  });
});

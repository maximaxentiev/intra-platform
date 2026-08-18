import { describe, expect, it } from 'vitest';
import {
  buildShiftCancellationCarerEmailContent,
  carerCancellationEmailContainsNoSensitiveInternals,
} from './shift-cancellation-carer-email.template';

const PLATFORM_ENV = {
  APP_PUBLIC_URL: 'https://app.example.test',
  APP_HOST: 'app.example.test',
  NODE_ENV: 'test',
} as const;

describe('buildShiftCancellationCarerEmailContent', () => {
  const base = {
    centreName: 'Sunrise Child Care',
    centreAddress: '123 Main St',
    centreCity: 'Toronto',
    roleNeeded: 'RECE',
    shiftDate: '2026-09-10',
    startTime: '09:00:00',
    endTime: '17:00:00',
    shiftId: 'shift-123',
    includePortalLink: true,
    platformEnv: PLATFORM_ENV,
  };

  it('includes centre, schedule, address, and portal CTA', () => {
    const content = buildShiftCancellationCarerEmailContent(base);
    expect(content.subject).toContain('Shift cancelled');
    expect(content.text).toContain('Your scheduled shift has been cancelled.');
    expect(content.text).toContain('123 Main St');
    expect(content.text).toContain('Toronto');
    expect(content.text).toContain('/carer/shifts/shift-123');
  });

  it('excludes cancellation reason and hourly rate', () => {
    const content = buildShiftCancellationCarerEmailContent({
      ...base,
    });
    expect(content.text).not.toContain('Family emergency');
    expect(carerCancellationEmailContainsNoSensitiveInternals(content)).toBe(true);
  });
});

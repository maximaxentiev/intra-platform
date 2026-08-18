import { describe, expect, it } from 'vitest';
import {
  buildShiftReminderCarerEmailContent,
  shiftReminderEmailContainsNoSensitiveInternals,
} from './shift-reminder-carer-email.template';

const PLATFORM_ENV = {
  APP_PUBLIC_URL: 'https://app.example.test',
  APP_HOST: 'app.example.test',
  NODE_ENV: 'test',
} as const;

describe('buildShiftReminderCarerEmailContent', () => {
  const base = {
    centreName: 'Sunrise Child Care',
    centreAddress: '123 Main St',
    centreCity: 'Toronto',
    centreNotes: 'No peanuts.\nSign in at front desk.',
    roleNeeded: 'RECE',
    shiftDate: '2026-09-10',
    startTime: '09:00:00',
    endTime: '17:00:00',
    shiftId: 'shift-123',
    includePortalLink: true,
    platformEnv: PLATFORM_ENV,
  };

  it('uses interval-specific subjects', () => {
    expect(buildShiftReminderCarerEmailContent({ ...base, interval: '3d' }).subject).toContain(
      '3 days',
    );
    expect(buildShiftReminderCarerEmailContent({ ...base, interval: '1d' }).subject).toContain(
      'tomorrow',
    );
    expect(buildShiftReminderCarerEmailContent({ ...base, interval: '2h' }).subject).toContain(
      '2 hours',
    );
  });

  it('includes centre, schedule, address, full notes, and portal CTA', () => {
    const content = buildShiftReminderCarerEmailContent({ ...base, interval: '1d' });
    expect(content.text).toContain('Upcoming shift reminder');
    expect(content.text).toContain('Sunrise Child Care');
    expect(content.text).toContain('No peanuts.');
    expect(content.text).toContain('Sign in at front desk.');
    expect(content.text).toContain('Role: RECE');
    expect(content.text).toContain('/carer/shifts/shift-123');
    expect(content.html).toContain('View shift details');
  });

  it('escapes HTML in dynamic values', () => {
    const content = buildShiftReminderCarerEmailContent({
      ...base,
      interval: '1d',
      centreName: 'Care <script>',
      centreNotes: 'Notes & rules',
    });
    expect(content.html).toContain('Care &lt;script&gt;');
    expect(content.html).toContain('Notes &amp; rules');
    expect(content.html).not.toContain('<script>');
  });

  it('excludes hourly rate and internal fields', () => {
    const content = buildShiftReminderCarerEmailContent({ ...base, interval: '3d' });
    expect(shiftReminderEmailContainsNoSensitiveInternals(content)).toBe(true);
  });
});

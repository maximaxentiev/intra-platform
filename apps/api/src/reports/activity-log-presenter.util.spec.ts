import { describe, expect, it } from 'vitest';
import { presentActivityLogItem } from './activity-log-presenter.util';
import type { ActivityLogRawRow } from './types/activity-log.types';

const emptyNames = {
  staff: new Map(),
  centres: new Map(),
  users: new Map(),
  shifts: new Map(),
};

function assignmentRow(
  overrides: Partial<ActivityLogRawRow> & { recipientType: 'centre' | 'carer' },
): ActivityLogRawRow {
  return {
    source_key: 'assign_notify:1',
    occurred_at: new Date('2026-08-20T12:00:00.000Z'),
    category: 'communications',
    action: 'assignment_confirmation_sent',
    actor_type: 'ops_user',
    actor_user_id: 'ops-1',
    staff_id: 'staff-1',
    centre_id: 'centre-1',
    shift_id: 'shift-1',
    target_user_id: null,
    metadata: { recipientType: overrides.recipientType, trigger: 'assign' },
    ...overrides,
  };
}

describe('presentActivityLogItem assignment confirmations', () => {
  const names = {
    ...emptyNames,
    staff: new Map([
      [
        'staff-1',
        {
          legalName: 'Jaspreet Singh',
          displayName: 'Jaz',
          useDisplayName: true,
        },
      ],
    ]),
    centres: new Map([['centre-1', 'ABC Child Care']]),
    shifts: new Map([['shift-1', '2026-08-25']]),
    users: new Map([['ops-1', 'Ops User']]),
  };

  it('distinguishes centre and carer assignment confirmation entries', () => {
    const centreItem = presentActivityLogItem(assignmentRow({ recipientType: 'centre' }), names);
    const carerItem = presentActivityLogItem(assignmentRow({ recipientType: 'carer' }), names);

    expect(centreItem.title).toBe('Assignment confirmation sent');
    expect(centreItem.description).toBe('Centre confirmation sent to ABC Child Care');
    expect(carerItem.title).toBe('Assignment confirmation sent');
    expect(carerItem.description).toBe('Carer confirmation sent to Jaz');
  });

  it('labels failed assignment confirmations per recipient', () => {
    const failed = presentActivityLogItem(
      assignmentRow({ recipientType: 'carer', action: 'assignment_confirmation_failed' }),
      names,
    );
    expect(failed.title).toBe('Assignment confirmation failed');
    expect(failed.description).toBe('Carer confirmation failed to Jaz');
  });
});

describe('presentActivityLogItem cancellation confirmations', () => {
  const names = {
    ...emptyNames,
    staff: new Map([
      [
        'staff-1',
        {
          legalName: 'Jaspreet Singh',
          displayName: 'Jaz',
          useDisplayName: true,
        },
      ],
    ]),
    centres: new Map([['centre-1', 'ABC Child Care']]),
  };

  it('uses cancellation confirmation title for shift cancellation communications', () => {
    const centreItem = presentActivityLogItem(
      {
        source_key: 'comm:1',
        occurred_at: new Date(),
        category: 'communications',
        action: 'communication_sent',
        actor_type: 'system',
        actor_user_id: null,
        staff_id: 'staff-1',
        centre_id: 'centre-1',
        shift_id: 'shift-1',
        target_user_id: null,
        metadata: { communicationType: 'shift_cancellation_centre' },
      },
      names,
    );

    expect(centreItem.title).toBe('Cancellation confirmation sent');
    expect(centreItem.description).toBe('Centre confirmation sent to ABC Child Care');
  });

  it('keeps shift reminders labelled as reminders', () => {
    const reminder = presentActivityLogItem(
      {
        source_key: 'comm:2',
        occurred_at: new Date(),
        category: 'communications',
        action: 'communication_sent',
        actor_type: 'system',
        actor_user_id: null,
        staff_id: 'staff-1',
        centre_id: 'centre-1',
        shift_id: 'shift-1',
        target_user_id: null,
        metadata: { communicationType: 'shift_reminder_1d' },
      },
      names,
    );

    expect(reminder.title).toBe('Reminder sent');
    expect(reminder.description).toContain('1-day shift reminder');
  });
});

describe('presentActivityLogItem password reset events', () => {
  it('describes admin reset without exposing credentials', () => {
    const reset = presentActivityLogItem(
      {
        source_key: 'platform:reset',
        occurred_at: new Date('2026-08-20T12:00:00.000Z'),
        category: 'users',
        action: 'user_password_reset',
        actor_type: 'ops_user',
        actor_user_id: 'admin-1',
        staff_id: null,
        centre_id: null,
        shift_id: null,
        target_user_id: 'user-1',
        metadata: { name: 'Jane Smith', email: 'jane@example.test' },
      },
      { ...emptyNames, users: new Map([['admin-1', 'Admin User']]) },
    );

    expect(reset.title).toBe('Password reset');
    expect(reset.description).toBe('Temporary password generated for Jane Smith');
    expect(JSON.stringify(reset)).not.toContain('temporaryPassword');
  });
});

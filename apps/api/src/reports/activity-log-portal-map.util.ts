import type { ActivityLogCategory } from './types/activity-log.types';

/** Staff portal audit events excluded from Activity Log (low-value or duplicate). */
export const EXCLUDED_PORTAL_AUDIT_EVENT_TYPES = new Set([
  'share_page_viewed',
  'shared_document_viewed',
  'carer_account_confirmation_email_sent',
  'carer_account_confirmation_email_failed',
  'ops_document_reminders_changed',
  'staff_document_reminders_changed',
]);

const DOCUMENT_EVENT_PREFIXES = ['carer_document_', 'ops_document_'];
const STAFF_EVENT_PREFIXES = [
  'staff_record_created',
  'staff_bulk_import_completed',
  'portal_',
  'carer_profile_',
  'onboarding_',
  'availability_',
  'carer_availability_',
];
const SHIFT_PORTAL_EVENTS = new Set([
  'shift_cancellation_requested',
  'shift_cancellation_request_resolved',
]);

export function portalEventCategory(eventType: string): ActivityLogCategory | null {
  if (EXCLUDED_PORTAL_AUDIT_EVENT_TYPES.has(eventType)) return null;
  if (DOCUMENT_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix))) {
    return 'documents';
  }
  if (SHIFT_PORTAL_EVENTS.has(eventType)) return 'shifts';
  if (STAFF_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix))) {
    return 'staff';
  }
  return 'staff';
}

export function platformActionCategory(action: string): ActivityLogCategory {
  if (action.startsWith('shift_')) return 'shifts';
  if (action.startsWith('centre_')) return 'centres';
  if (action.startsWith('user_')) return 'users';
  if (action.startsWith('staff_')) return 'staff';
  return 'system';
}

export function communicationTypeLabel(type: string): string {
  if (type.startsWith('document_expiry_')) {
    const suffix = type.replace('document_expiry_', '');
    if (suffix.endsWith('mo')) {
      const months = suffix.replace('mo', '');
      return `${months}-month document expiry reminder`;
    }
    const days = suffix.replace('d', '');
    return `${days}-day document expiry reminder`;
  }
  if (type === 'shift_reminder_3d') return '3-day shift reminder';
  if (type === 'shift_reminder_1d') return '1-day shift reminder';
  if (type === 'shift_reminder_2h') return '2-hour shift reminder';
  if (type === 'shift_cancellation_centre') return 'Shift cancellation (centre)';
  if (type === 'shift_cancellation_carer') return 'Shift cancellation (carer)';
  return type.replace(/_/g, ' ');
}

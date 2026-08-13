import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import { staffPortalAuditEvents } from '../db/schema';

export type StaffPortalAuditRecordParams = {
  staffId: string;
  staffAccountId?: string | null;
  actorUserId?: string | null;
  eventType: StaffPortalAuditEventType;
  detail?: Record<string, unknown>;
};

export type StaffPortalAuditDbExecutor = Pick<DbExecutor, 'insert'>;

export const STAFF_PORTAL_AUDIT_EVENTS = {
  staffCreated: 'staff_record_created',
  invitationCreated: 'portal_invitation_created',
  invitationEmailSent: 'invitation_email_sent',
  invitationEmailFailed: 'invitation_email_failed',
  invitationResent: 'invitation_resent',
  invitationAccepted: 'invitation_accepted',
  portalDisabled: 'portal_access_disabled',
  portalReEnabled: 'portal_access_re_enabled',
  staffBulkImportCompleted: 'staff_bulk_import_completed',
  carerProfileUpdated: 'carer_profile_updated',
  onboardingStep1Completed: 'onboarding_step_1_completed',
  carerAccountConfirmationEmailSent: 'carer_account_confirmation_email_sent',
  carerAccountConfirmationEmailFailed: 'carer_account_confirmation_email_failed',
  carerDocumentSubmitted: 'carer_document_submitted',
  carerDocumentReplaced: 'carer_document_replaced',
  carerDocumentCleared: 'carer_document_cleared',
  opsDocumentSubmitted: 'ops_document_submitted',
  opsDocumentReplaced: 'ops_document_replaced',
  opsDocumentApproved: 'ops_document_approved',
  opsDocumentIssueFlagged: 'ops_document_issue_flagged',
  opsDocumentCleared: 'ops_document_cleared',
  opsDocumentRemindersChanged: 'ops_document_reminders_changed',
  onboardingStep2Completed: 'onboarding_step_2_completed',
  shareLinkGenerated: 'share_link_generated',
  shareLinkRotated: 'share_link_rotated',
  shareLinkRevoked: 'share_link_revoked',
  sharePageViewed: 'share_page_viewed',
  sharedDocumentViewed: 'shared_document_viewed',
} as const;

export type StaffPortalAuditEventType =
  (typeof STAFF_PORTAL_AUDIT_EVENTS)[keyof typeof STAFF_PORTAL_AUDIT_EVENTS];

/**
 * Ops/import audit events stored on a staff row but not portal invitation/access lifecycle.
 * Deletion must not be blocked by these alone (see staffPortalAuditBlocksDeletion).
 */
export const STAFF_PORTAL_NON_BLOCKING_AUDIT_EVENTS: ReadonlySet<StaffPortalAuditEventType> =
  new Set([
    STAFF_PORTAL_AUDIT_EVENTS.staffCreated,
    STAFF_PORTAL_AUDIT_EVENTS.staffBulkImportCompleted,
  ]);

/** True when an audit event is genuine portal invitation/access history that blocks staff delete. */
export function staffPortalAuditBlocksDeletion(eventType: string): boolean {
  return !STAFF_PORTAL_NON_BLOCKING_AUDIT_EVENTS.has(eventType as StaffPortalAuditEventType);
}

const FORBIDDEN_DETAIL_KEYS = /token|password|secret|hash/i;

@Injectable()
export class StaffPortalAuditService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(
    params: StaffPortalAuditRecordParams,
    executor?: StaffPortalAuditDbExecutor,
  ) {
    const detail = sanitizeDetail(params.detail ?? {});
    const db = executor ?? this.db;
    await db.insert(staffPortalAuditEvents).values({
      staffId: params.staffId,
      staffAccountId: params.staffAccountId ?? null,
      actorUserId: params.actorUserId ?? null,
      eventType: params.eventType,
      detail,
    });
  }
}

export function sanitizeDetail(detail: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (FORBIDDEN_DETAIL_KEYS.test(key)) continue;
    if (typeof value === 'string' && FORBIDDEN_DETAIL_KEYS.test(value)) continue;
    out[key] = value;
  }
  return out;
}

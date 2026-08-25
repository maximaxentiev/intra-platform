import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Enums (mirror the legacy Supabase schema)
// ---------------------------------------------------------------------------
export const staffStatus = pgEnum('staff_status', ['active', 'inactive']);
// Staff portal account lifecycle: invited (link sent) → incomplete (account
// created, onboarding unfinished) → active (onboarding complete).
export const staffAccountStatus = pgEnum('staff_account_status', [
  'invited',
  'incomplete',
  'active',
  'disabled',
]);
export const centreChannel = pgEnum('centre_channel', ['whatsapp', 'goto', 'email']);
export const centreEceQualificationRequirement = pgEnum('centre_ece_qualification_requirement', [
  'ece_or_rece',
  'rece_required',
]);
export const shiftStatus = pgEnum('shift_status', ['pending', 'filled', 'cancelled', 'completed']);
export const userRole = pgEnum('user_role', ['admin', 'ops']);
export const applicationRole = pgEnum('application_role', ['eca', 'ece_rece', 'nanny']);
export const applicationStatus = pgEnum('application_status', [
  'new',
  'contacted',
  'hired',
  'rejected',
]);
export const applicationDocumentCategory = pgEnum('application_document_category', [
  'training_proof',
  'qualification_certificate',
  'vulnerable_sector_check',
  'first_aid_cpr',
  'immunization_records',
  'covid19_vaccination',
]);

export const staffDocumentType = pgEnum('staff_document_type', [
  'vulnerable_sector_check',
  'first_aid_cpr',
  'immunizations',
  'covid19_vaccination',
  'eca_diploma',
  'ece_diploma',
  'rece_proof',
]);

export const staffDocumentReviewStatus = pgEnum('staff_document_review_status', [
  'pending_review',
  'approved',
  'issue_flagged',
]);

export const staffDocumentActorType = pgEnum('staff_document_actor_type', ['carer', 'ops_user']);

// ---------------------------------------------------------------------------
// Users — ops team accounts (replaces Supabase auth.users + profiles).
// Invite-only: rows are created by admins, never via public signup.
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull().default(''),
  role: userRole('role').notNull().default('ops'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Centres
// ---------------------------------------------------------------------------
export const centres = pgTable('centres', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  address: text('address').notNull().default(''),
  city: text('city').notNull().default(''),
  // Agreed hourly charge for the centre (used by future invoicing).
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
  primaryChannel: centreChannel('primary_channel').notNull().default('email'),
  // Labelled "Rules, Policies, and Other Notes" in the UI; included verbatim
  // in shift assignment + reminder emails to staff.
  notes: text('notes').notNull().default(''),
  requiresQualificationForMatching: boolean('requires_qualification_for_matching')
    .notNull()
    .default(false),
  eceQualificationRequirement: centreEceQualificationRequirement('ece_qualification_requirement')
    .notNull()
    .default('ece_or_rece'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const centreContacts = pgTable(
  'centre_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    centreId: uuid('centre_id')
      .notNull()
      .references(() => centres.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default(''),
    title: text('title').notNull().default(''),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('centre_contacts_centre_idx').on(t.centreId, t.sortOrder)],
);

export const centreSecondaryChannels = pgTable(
  'centre_secondary_channels',
  {
    centreId: uuid('centre_id')
      .notNull()
      .references(() => centres.id, { onDelete: 'cascade' }),
    channel: centreChannel('channel').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.centreId, t.channel] })],
);

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
export const staff = pgTable('staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Kept as the canonical full legal name (first + last) for existing code
  // and reporting; maintained in sync with the split fields below.
  legalName: text('legal_name').notNull(),
  legalFirstName: text('legal_first_name').notNull().default(''),
  legalLastName: text('legal_last_name').notNull().default(''),
  displayName: text('display_name').notNull().default(''),
  useDisplayName: boolean('use_display_name').notNull().default(false),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  address: text('address').notNull().default(''),
  city: text('city').notNull().default(''),
  role: text('role').notNull().default(''),
  status: staffStatus('status').notNull().default('active'),
  notes: text('notes').notNull().default(''),
  documentsUrl: text('documents_url').notNull().default(''),
  // Cosmetic slug for shareable documents page — NOT authorization (see share token hash).
  documentSlug: text('document_slug').unique(),
  // SHA-256 of opaque share token; raw token is never persisted.
  documentShareTokenHash: text('document_share_token_hash'),
  documentShareTokenCreatedAt: timestamp('document_share_token_created_at', { withTimezone: true }),
  documentShareTokenRevokedAt: timestamp('document_share_token_revoked_at', { withTimezone: true }),
  sourceApplicationId: uuid('source_application_id')
    .references((): AnyPgColumn => applications.id, {
      onDelete: 'set null',
    })
    .unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('staff_source_application_id_idx').on(t.sourceApplicationId)]);

// ---------------------------------------------------------------------------
// Staff portal accounts — separate credential store from ops `users`.
// Created by ops when a staff member is invited; the staff member sets their
// own password via the invite link.
// ---------------------------------------------------------------------------
export const staffAccounts = pgTable(
  'staff_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .notNull()
      .unique()
      .references(() => staff.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    status: staffAccountStatus('status').notNull().default('invited'),
    // Invitation token (stored hashed).
    inviteTokenHash: text('invite_token_hash'),
    inviteTokenExpiresAt: timestamp('invite_token_expires_at', { withTimezone: true }),
    inviteSentAt: timestamp('invite_sent_at', { withTimezone: true }),
    // Password reset token (stored hashed; independent from invitation).
    passwordResetTokenHash: text('password_reset_token_hash'),
    passwordResetTokenExpiresAt: timestamp('password_reset_token_expires_at', {
      withTimezone: true,
    }),
    passwordResetRequestedAt: timestamp('password_reset_requested_at', { withTimezone: true }),
    // Mandatory onboarding: 1 = personal info, 2 = documents, 3 = availability.
    onboardingStep: smallint('onboarding_step').notNull().default(1),
    profileCompletedAt: timestamp('profile_completed_at', { withTimezone: true }),
    // Step 2 onboarding complete (historical); not cleared when documents expire later.
    documentsCompletedAt: timestamp('documents_completed_at', { withTimezone: true }),
    /** Availability onboarding step explicitly completed (distinct from final onboarding). */
    availabilityCompletedAt: timestamp('availability_completed_at', { withTimezone: true }),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    /** Monday anchor for guided two-week availability onboarding (Toronto calendar). */
    availabilityOnboardingWeek1Start: date('availability_onboarding_week1_start'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('staff_accounts_email_idx').on(t.email)],
);

// Top / Banned link tables (shared source of truth for two-way sync in UI)
export const staffCentreTop = pgTable(
  'staff_centre_top',
  {
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    centreId: uuid('centre_id')
      .notNull()
      .references(() => centres.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.centreId] })],
);

export const staffCentreBanned = pgTable(
  'staff_centre_banned',
  {
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    centreId: uuid('centre_id')
      .notNull()
      .references(() => centres.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.centreId] })],
);

// ---------------------------------------------------------------------------
// Availability — weekly ranges per staff member
// ---------------------------------------------------------------------------
export const availability = pgTable(
  'availability',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    weekStartDate: date('week_start_date').notNull(), // Monday
    dayOfWeek: smallint('day_of_week').notNull(), // 0=Mon..6=Sun
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('availability_staff_week_idx').on(t.staffId, t.weekStartDate)],
);

/** Explicit "not available" answers during guided availability onboarding. */
export const staffAvailabilityUnavailableDays = pgTable(
  'staff_availability_unavailable_days',
  {
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    calendarDate: date('calendar_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.staffId, t.calendarDate] }),
    index('staff_availability_unavailable_days_staff_idx').on(t.staffId),
  ],
);

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------
export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    centreId: uuid('centre_id')
      .notNull()
      .references(() => centres.id, { onDelete: 'restrict' }),
    shiftDate: date('shift_date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    roleNeeded: text('role_needed').notNull().default(''),
    notes: text('notes').notNull().default(''),
    status: shiftStatus('status').notNull().default('pending'),
    assignedStaffId: uuid('assigned_staff_id').references(() => staff.id, { onDelete: 'set null' }),
    cancellationReason: text('cancellation_reason').notNull().default(''),
    addedToStaffpoint: boolean('added_to_staffpoint').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('shifts_date_idx').on(t.shiftDate),
    index('shifts_centre_idx').on(t.centreId),
    index('shifts_assigned_idx').on(t.assignedStaffId),
  ],
);

export const shiftContacted = pgTable(
  'shift_contacted',
  {
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    contactedAt: timestamp('contacted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.shiftId, t.staffId] })],
);

export const shiftAssignmentNotificationRecipientType = pgEnum(
  'shift_assignment_notification_recipient_type',
  ['centre', 'carer'],
);
export const shiftAssignmentNotificationTrigger = pgEnum('shift_assignment_notification_trigger', [
  'assign',
  'resend',
]);
export const shiftAssignmentNotificationStatus = pgEnum('shift_assignment_notification_status', [
  'sent',
  'failed',
  'skipped',
]);

export const shiftCancellationRequestStatus = pgEnum('shift_cancellation_request_status', [
  'pending',
  'resolved',
]);

/** Legacy/dormant table from superseded cancellation-request workflow (migration 0010). Not used by active product code. */
export const shiftCancellationRequests = pgTable(
  'shift_cancellation_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    status: shiftCancellationRequestStatus('status').notNull().default('pending'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolutionNote: text('resolution_note').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shift_cancellation_requests_one_pending_per_shift_staff_idx')
      .on(t.shiftId, t.staffId)
      .where(sql`${t.status} = 'pending'`),
    index('shift_cancellation_requests_shift_idx').on(t.shiftId),
    index('shift_cancellation_requests_staff_idx').on(t.staffId),
    index('shift_cancellation_requests_pending_idx')
      .on(t.status)
      .where(sql`${t.status} = 'pending'`),
  ],
);

/** Email confirmation attempts after Ops assigns Staff to a shift. */
export const shiftAssignmentNotifications = pgTable(
  'shift_assignment_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    assignedStaffId: uuid('assigned_staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    recipientType: shiftAssignmentNotificationRecipientType('recipient_type').notNull(),
    recipientEmail: text('recipient_email').notNull().default(''),
    trigger: shiftAssignmentNotificationTrigger('trigger').notNull(),
    status: shiftAssignmentNotificationStatus('status').notNull(),
    providerId: text('provider_id'),
    failureCode: text('failure_code'),
    failureReason: text('failure_reason'),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [
    index('shift_assignment_notifications_shift_idx').on(t.shiftId),
    index('shift_assignment_notifications_recipient_status_idx').on(t.recipientType, t.status),
    index('shift_assignment_notifications_created_idx').on(t.createdAt),
  ],
);

/** Durable schedule/outbox for automated communications (Phase 7C+). */
export const scheduledCommunications = pgTable(
  'scheduled_communications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    idempotencyKey: text('idempotency_key').notNull(),
    communicationType: text('communication_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    recipientType: text('recipient_type').notNull(),
    recipientEntityId: uuid('recipient_entity_id'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('scheduled'),
    attempts: integer('attempts').notNull().default(0),
    lastErrorCode: text('last_error_code'),
    lastErrorReason: text('last_error_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('scheduled_communications_idempotency_key_idx').on(t.idempotencyKey),
    index('scheduled_communications_status_scheduled_for_idx').on(t.status, t.scheduledFor),
    index('scheduled_communications_entity_idx').on(t.entityType, t.entityId),
  ],
);

/** Append-only send attempt history for scheduled communications. */
export const communicationDeliveries = pgTable(
  'communication_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduledCommunicationId: uuid('scheduled_communication_id')
      .notNull()
      .references(() => scheduledCommunications.id, { onDelete: 'restrict' }),
    idempotencyKey: text('idempotency_key').notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    recipientEmail: text('recipient_email').notNull().default(''),
    status: text('status').notNull(),
    providerId: text('provider_id'),
    failureCode: text('failure_code'),
    failureReason: text('failure_reason'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('communication_deliveries_scheduled_communication_idx').on(t.scheduledCommunicationId),
    index('communication_deliveries_idempotency_key_idx').on(t.idempotencyKey),
  ],
);

export const shiftComments = pgTable(
  'shift_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shift_comments_shift_idx').on(t.shiftId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Applications — Join the Network intake (website → ops review → hire)
// ---------------------------------------------------------------------------
export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: applicationStatus('status').notNull().default('new'),
    role: applicationRole('role').notNull(),
    firstName: text('first_name').notNull(),
    middleName: text('middle_name').notNull().default(''),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull().default(''),
    gender: text('gender').notNull().default(''),
    gtaEligible: boolean('gta_eligible'),
    statusInCanada: text('status_in_canada').notNull().default(''),
    experienceDuration: text('experience_duration').notNull().default(''),
    nannyExperienceTypes: jsonb('nanny_experience_types').$type<string[]>().notNull().default([]),
    qualificationStatus: text('qualification_status').notNull().default(''),
    nannyTrainingCompleted: boolean('nanny_training_completed'),
    nannyTrainingDescription: text('nanny_training_description').notNull().default(''),
    vscStatus: text('vsc_status').notNull().default(''),
    vscIssueOrRequestDate: date('vsc_issue_or_request_date'),
    firstAidCprStatus: text('first_aid_cpr_status').notNull().default(''),
    firstAidCprExpiry: date('first_aid_cpr_expiry'),
    immunizationStatus: text('immunization_status').notNull().default(''),
    covidVaccinationStatus: text('covid_vaccination_status').notNull().default(''),
    englishProficiency: text('english_proficiency').notNull().default(''),
    additionalLanguages: jsonb('additional_languages')
      .$type<Array<{ language: string; proficiency: string }>>()
      .notNull()
      .default([]),
    formId: text('form_id').notNull().default(''),
    externalSubmissionId: text('external_submission_id').notNull().unique(),
    sourcePage: text('source_page').notNull().default(''),
    sourceUrl: text('source_url').notNull().default(''),
    consentAccepted: boolean('consent_accepted').notNull().default(false),
    consentPolicyVersion: text('consent_policy_version').notNull().default(''),
    consentAcceptedAt: timestamp('consent_accepted_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    contactedAt: timestamp('contacted_at', { withTimezone: true }),
    contactedByUserId: uuid('contacted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    hiredAt: timestamp('hired_at', { withTimezone: true }),
    hiredByUserId: uuid('hired_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    hiredStaffId: uuid('hired_staff_id').references(() => staff.id, { onDelete: 'set null' }).unique(),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedByUserId: uuid('rejected_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    rejectionEmailSentAt: timestamp('rejection_email_sent_at', { withTimezone: true }),
    payloadSnapshot: jsonb('payload_snapshot').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('applications_status_idx').on(t.status),
    index('applications_role_idx').on(t.role),
    index('applications_submitted_at_idx').on(t.submittedAt),
    index('applications_email_idx').on(t.email),
    index('applications_name_idx').on(t.lastName, t.firstName),
    index('applications_hired_staff_id_idx').on(t.hiredStaffId),
    index('applications_external_submission_id_idx').on(t.externalSubmissionId),
  ],
);

export const applicationDocuments = pgTable(
  'application_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'restrict' }),
    category: applicationDocumentCategory('category').notNull(),
    originalFilename: text('original_filename').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    storageKey: text('storage_key').notNull(),
    checksumSha256: text('checksum_sha256').notNull().default(''),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('application_documents_application_idx').on(t.applicationId),
    index('application_documents_category_idx').on(t.applicationId, t.category),
  ],
);

export const applicationActivity = pgTable(
  'application_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: text('actor_type').notNull(),
    eventType: text('event_type').notNull(),
    fromStatus: applicationStatus('from_status'),
    toStatus: applicationStatus('to_status'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('application_activity_application_idx').on(t.applicationId, t.createdAt)],
);

/** Append-only Ops/system audit trail (Phase 9F forward-looking). */
export const platformAuditEvents = pgTable(
  'platform_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorType: text('actor_type').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'set null' }),
    shiftId: uuid('shift_id').references(() => shifts.id, { onDelete: 'set null' }),
    centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'set null' }),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index('platform_audit_occurred_at_idx').on(t.occurredAt),
    index('platform_audit_action_idx').on(t.action),
    index('platform_audit_entity_idx').on(t.entityType, t.entityId),
    index('platform_audit_staff_occurred_idx').on(t.staffId, t.occurredAt),
    index('platform_audit_centre_occurred_idx').on(t.centreId, t.occurredAt),
    index('platform_audit_shift_occurred_idx').on(t.shiftId, t.occurredAt),
    index('platform_audit_actor_occurred_idx').on(t.actorUserId, t.occurredAt),
  ],
);

export const staffPortalAuditEvents = pgTable(
  'staff_portal_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    staffAccountId: uuid('staff_account_id').references(() => staffAccounts.id, {
      onDelete: 'set null',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('staff_portal_audit_staff_idx').on(t.staffId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Staff documents — one set per staff + type; versioned submissions + files.
// ---------------------------------------------------------------------------
export const staffDocumentSets = pgTable(
  'staff_document_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id, { onDelete: 'cascade' }),
    documentType: staffDocumentType('document_type').notNull(),
    remindersEnabled: boolean('reminders_enabled').notNull().default(true),
    currentSubmissionId: uuid('current_submission_id').references(
      (): AnyPgColumn => staffDocumentSubmissions.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('staff_document_sets_staff_idx').on(t.staffId),
    uniqueIndex('staff_document_sets_staff_type_unique').on(t.staffId, t.documentType),
  ],
);

export const staffDocumentSubmissions = pgTable(
  'staff_document_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentSetId: uuid('document_set_id')
      .notNull()
      .references(() => staffDocumentSets.id, { onDelete: 'cascade' }),
    reviewStatus: staffDocumentReviewStatus('review_status').notNull(),
    processedDate: date('processed_date'),
    expiryDate: date('expiry_date'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
    submittedByActorType: staffDocumentActorType('submitted_by_actor_type').notNull(),
    submittedByStaffAccountId: uuid('submitted_by_staff_account_id').references(
      () => staffAccounts.id,
      { onDelete: 'set null' },
    ),
    submittedByUserId: uuid('submitted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    issueNote: text('issue_note').notNull().default(''),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('staff_document_submissions_set_idx').on(t.documentSetId),
    index('staff_document_submissions_review_status_idx').on(t.reviewStatus),
    index('staff_document_submissions_expiry_idx')
      .on(t.expiryDate)
      .where(sql`${t.expiryDate} is not null`),
  ],
);

export const staffDocumentFiles = pgTable(
  'staff_document_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => staffDocumentSubmissions.id, { onDelete: 'cascade' }),
    originalFilename: text('original_filename').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    storageKey: text('storage_key').notNull(),
    checksumSha256: text('checksum_sha256').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('staff_document_files_submission_idx').on(t.submissionId)],
);

// Convenience type aliases -----------------------------------------------------
export type User = typeof users.$inferSelect;
export type Centre = typeof centres.$inferSelect;
export type CentreContact = typeof centreContacts.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Availability = typeof availability.$inferSelect;
export type StaffAvailabilityUnavailableDay = typeof staffAvailabilityUnavailableDays.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type ShiftComment = typeof shiftComments.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type ApplicationDocument = typeof applicationDocuments.$inferSelect;
export type ApplicationActivity = typeof applicationActivity.$inferSelect;
export type PlatformAuditEvent = typeof platformAuditEvents.$inferSelect;
export type StaffAccount = typeof staffAccounts.$inferSelect;
export type StaffPortalAuditEvent = typeof staffPortalAuditEvents.$inferSelect;
export type StaffDocumentSet = typeof staffDocumentSets.$inferSelect;
export type StaffDocumentSubmission = typeof staffDocumentSubmissions.$inferSelect;
export type StaffDocumentFile = typeof staffDocumentFiles.$inferSelect;

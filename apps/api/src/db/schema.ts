import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums (mirror the legacy Supabase schema)
// ---------------------------------------------------------------------------
export const staffStatus = pgEnum('staff_status', ['active', 'inactive']);
export const centreChannel = pgEnum('centre_channel', ['whatsapp', 'goto', 'email']);
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
  primaryChannel: centreChannel('primary_channel').notNull().default('email'),
  notes: text('notes').notNull().default(''),
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
  legalName: text('legal_name').notNull(),
  displayName: text('display_name').notNull().default(''),
  useDisplayName: boolean('use_display_name').notNull().default(false),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  role: text('role').notNull().default(''),
  status: staffStatus('status').notNull().default('active'),
  notes: text('notes').notNull().default(''),
  documentsUrl: text('documents_url').notNull().default(''),
  sourceApplicationId: uuid('source_application_id')
    .references((): AnyPgColumn => applications.id, {
      onDelete: 'set null',
    })
    .unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('staff_source_application_id_idx').on(t.sourceApplicationId)]);

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

// Convenience type aliases -----------------------------------------------------
export type User = typeof users.$inferSelect;
export type Centre = typeof centres.$inferSelect;
export type CentreContact = typeof centreContacts.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Availability = typeof availability.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type ShiftComment = typeof shiftComments.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type ApplicationDocument = typeof applicationDocuments.$inferSelect;
export type ApplicationActivity = typeof applicationActivity.$inferSelect;

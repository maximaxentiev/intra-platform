import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums (mirror the legacy Supabase schema)
// ---------------------------------------------------------------------------
export const staffStatus = pgEnum('staff_status', ['active', 'inactive']);
export const centreChannel = pgEnum('centre_channel', ['whatsapp', 'goto', 'email']);
export const shiftStatus = pgEnum('shift_status', ['pending', 'filled', 'cancelled', 'completed']);
export const userRole = pgEnum('user_role', ['admin', 'ops']);

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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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

// Convenience type aliases -----------------------------------------------------
export type User = typeof users.$inferSelect;
export type Centre = typeof centres.$inferSelect;
export type CentreContact = typeof centreContacts.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Availability = typeof availability.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type ShiftComment = typeof shiftComments.$inferSelect;

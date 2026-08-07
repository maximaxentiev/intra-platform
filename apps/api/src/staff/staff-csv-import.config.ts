/** Maximum uploaded CSV size (512 KiB). */
export const STAFF_CSV_MAX_BYTES = 512 * 1024;

/** Maximum data rows (excluding header). */
export const STAFF_CSV_MAX_ROWS = 500;

/** Allowed MIME types for staff CSV upload. */
export const STAFF_CSV_ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
]);

/**
 * Canonical CSV header row (exact match recommended):
 * Display Name,Legal First Name,Legal Last Name,Role,Email Address,Phone Number,Home Address,City
 */
export const STAFF_CSV_CANONICAL_HEADERS = [
  'display_name',
  'legal_first_name',
  'legal_last_name',
  'role',
  'email_address',
  'phone_number',
  'home_address',
  'city',
] as const;

export type StaffCsvCanonicalField = (typeof STAFF_CSV_CANONICAL_HEADERS)[number];

export const STAFF_CSV_HEADER_LABELS: Record<StaffCsvCanonicalField, string> = {
  display_name: 'Display Name',
  legal_first_name: 'Legal First Name',
  legal_last_name: 'Legal Last Name',
  role: 'Role',
  email_address: 'Email Address',
  phone_number: 'Phone Number',
  home_address: 'Home Address',
  city: 'City',
};

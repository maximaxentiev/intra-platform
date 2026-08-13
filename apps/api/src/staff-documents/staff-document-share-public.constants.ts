export const PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE =
  'This shared document page is not available.';

/** Public share document category labels. */
export const STAFF_DOCUMENT_PUBLIC_SHARE_LABELS = {
  vulnerable_sector_check: 'Vulnerable Sector Check',
  first_aid_cpr: 'First Aid & CPR Certification',
  immunizations: 'Immunizations',
  covid19_vaccination: 'COVID-19 Vaccination',
} as const;

export const STAFF_SHARE_RATE_LIMIT_EXCHANGE_MINUTE_MAX = 10;
export const STAFF_SHARE_RATE_LIMIT_EXCHANGE_MINUTE_WINDOW_SEC = 60;

export const STAFF_SHARE_RATE_LIMIT_EXCHANGE_HOUR_MAX = 30;
export const STAFF_SHARE_RATE_LIMIT_EXCHANGE_HOUR_WINDOW_SEC = 60 * 60;

export const STAFF_SHARE_RATE_LIMIT_METADATA_HOUR_MAX = 120;
export const STAFF_SHARE_RATE_LIMIT_METADATA_HOUR_WINDOW_SEC = 60 * 60;

export const STAFF_SHARE_RATE_LIMIT_FILE_HOUR_MAX = 60;
export const STAFF_SHARE_RATE_LIMIT_FILE_HOUR_WINDOW_SEC = 60 * 60;

export const STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX = 'staff-share';

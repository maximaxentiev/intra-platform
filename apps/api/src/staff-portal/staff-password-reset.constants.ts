export const STAFF_PASSWORD_RESET_REDIS_PREFIX = 'staff-password-reset';

/** Maximum forgot-password requests per normalized email within the email window. */
export const STAFF_PASSWORD_RESET_EMAIL_MAX = 3;
export const STAFF_PASSWORD_RESET_EMAIL_WINDOW_SEC = 60 * 60;

/** Maximum forgot-password requests per client IP within the IP window. */
export const STAFF_PASSWORD_RESET_IP_MAX = 10;
export const STAFF_PASSWORD_RESET_IP_WINDOW_SEC = 15 * 60;

/** Maximum reset-password submissions per client IP within the attempt window. */
export const STAFF_PASSWORD_RESET_ATTEMPT_IP_MAX = 10;
export const STAFF_PASSWORD_RESET_ATTEMPT_IP_WINDOW_SEC = 15 * 60;

/** Maximum reset-password submissions per token within the attempt window. */
export const STAFF_PASSWORD_RESET_ATTEMPT_TOKEN_MAX = 5;
export const STAFF_PASSWORD_RESET_ATTEMPT_TOKEN_WINDOW_SEC = 15 * 60;

export const STAFF_PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

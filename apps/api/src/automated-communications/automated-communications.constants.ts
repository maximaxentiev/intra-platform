export const AUTOMATED_COMMUNICATIONS_QUEUE_NAME = 'automated-communications';

export const DEFAULT_COMMUNICATIONS_QUEUE_PREFIX = 'intra';

export const DEFAULT_COMMUNICATIONS_WORKER_CONCURRENCY = 5;

export const DEFAULT_COMMUNICATIONS_RETRY_ATTEMPTS = 5;

export const DEFAULT_COMMUNICATIONS_RECONCILE_CRON = '*/10 * * * *';

/** BullMQ completed job retention (count). PostgreSQL remains authoritative. */
export const BULLMQ_COMPLETED_JOB_RETENTION_COUNT = 1000;

/** BullMQ failed job retention (age ms). */
export const BULLMQ_FAILED_JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Retry backoff delays in milliseconds: 1m, 5m, 15m, 1h, 4h. */
export const COMMUNICATION_RETRY_BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  4 * 60 * 60_000,
] as const;

/** Stale processing threshold before recovery attempts. */
export const STALE_PROCESSING_THRESHOLD_MS = 15 * 60 * 1000;

/** Resend provider idempotency window — do not blindly resend past this. */
export const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

export const COMMUNICATION_FAILURE_CODE = {
  deliveryFailed: 'delivery_failed',
  sendFailed: 'send_failed',
  unsupportedType: 'unsupported_communication_type',
  uncertainSend: 'uncertain_previous_send',
  staleJob: 'stale_job',
  alreadySent: 'already_sent',
  cancelled: 'cancelled',
} as const;

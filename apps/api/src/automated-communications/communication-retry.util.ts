import { EmailDeliveryError } from '../email/email.transport';
import { COMMUNICATION_RETRY_BACKOFF_MS } from './automated-communications.constants';

export type CommunicationRetryClassification = 'retryable' | 'permanent';

const PERMANENT_HTTP_STATUSES = new Set([400, 401, 403, 404, 406, 410, 413, 422]);

export function classifyEmailDeliveryError(error: unknown): CommunicationRetryClassification {
  if (!(error instanceof EmailDeliveryError)) {
    return 'retryable';
  }

  const match = /Email delivery failed \((\d{3})\)/.exec(error.message);
  if (!match) {
    return 'retryable';
  }

  const status = Number(match[1]);
  if (status === 429 || status >= 500) {
    return 'retryable';
  }
  if (PERMANENT_HTTP_STATUSES.has(status)) {
    return 'permanent';
  }
  if (status >= 400 && status < 500) {
    return 'permanent';
  }
  return 'retryable';
}

export function communicationRetryBackoffMs(attemptsMade: number): number {
  const index = Math.max(0, Math.min(attemptsMade - 1, COMMUNICATION_RETRY_BACKOFF_MS.length - 1));
  return COMMUNICATION_RETRY_BACKOFF_MS[index] ?? COMMUNICATION_RETRY_BACKOFF_MS.at(-1)!;
}

export function sanitizeCommunicationFailureReason(message: string): string {
  return message
    .replace(/token[=:]\S+/gi, 'token=[redacted]')
    .replace(/secret[=:]\S+/gi, 'secret=[redacted]')
    .replace(/password[=:]\S+/gi, 'password=[redacted]')
    .replace(/api[_-]?key[=:]\S+/gi, 'api_key=[redacted]')
    .slice(0, 500);
}

import { BadRequestException } from '@nestjs/common';

/** Ops cancellation requires at least one non-whitespace character. */
export function normalizeRequiredCancellationReason(reason: string | undefined): string {
  const trimmed = reason?.trim() ?? '';
  if (!trimmed) {
    throw new BadRequestException('Cancellation reason is required.');
  }
  return trimmed;
}

/** Manual completion is an admin recovery action for staffed (filled) shifts only. */
export function assertManualCompletionAllowed(currentStatus: string): void {
  if (currentStatus !== 'filled') {
    throw new BadRequestException('Only filled shifts can be marked completed manually.');
  }
}

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

/** Generic status → pending clears assignee; Ops uses dedicated unassign instead. */
export function rejectGenericPendingTransition(): never {
  throw new BadRequestException(
    'Changing status to pending is not supported. Use unassign to remove staff from a filled shift.',
  );
}

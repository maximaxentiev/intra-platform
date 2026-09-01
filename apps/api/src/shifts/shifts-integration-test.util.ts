import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import type * as schema from '../db/schema';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';
import type { ShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-communication.service';
import { createMockShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-test.util';
import { ShiftBatchStalenessService } from '../shift-batches/shift-batch-staleness.service';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { createMockShiftCancellationService } from './shift-cancellation-test.util';
import { createMockShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication-test.util';
import { ShiftMatchingService } from './shift-matching.service';
import { createMockShiftReminderService } from './shift-reminder-test.util';
import { createMockShiftUpdateCommunicationService } from './shift-update-communication-test.util';
import { ShiftsService } from './shifts.service';

export function createIntegrationShiftsService(db: NodePgDatabase<typeof schema>) {
  const platformAudit = new PlatformAuditService(db);
  return new ShiftsService(
    db,
    {
      sendAssignmentConfirmations: vi.fn(),
    } as unknown as ShiftAssignmentConfirmationService,
    {
      evaluateStaffForShift: vi.fn().mockResolvedValue({ eligible: true, reasons: [] }),
    } as unknown as ShiftMatchingService,
    createMockShiftReminderService(),
    createMockShiftCancellationService(),
    platformAudit,
    createMockShiftUpdateCommunicationService(),
    createMockShiftManualUnassignCommunicationService(),
    createMockShiftBatchProgressCommunicationService() as unknown as ShiftBatchProgressCommunicationService,
    new ShiftBatchStalenessService(db, platformAudit),
  );
}

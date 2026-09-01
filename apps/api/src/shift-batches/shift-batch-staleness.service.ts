import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import { shiftBatches } from '../db/schema';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService } from '../platform-audit/platform-audit.service';

export type BatchMaterialChangeKind =
  | 'assignment'
  | 'unassign'
  | 'cancellation'
  | 'schedule'
  | 'role'
  | 'shift_notes';

@Injectable()
export class ShiftBatchStalenessService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  /** Record a material child change after the Batch has been confirmed to the Centre. */
  async recordMaterialChange(
    batchId: string | null | undefined,
    kind: BatchMaterialChangeKind,
    metadata: Record<string, unknown> = {},
    executor?: DbExecutor,
  ): Promise<void> {
    if (!batchId) return;

    const run = async (tx: DbExecutor) => {
      const rows = await tx
        .select({
          id: shiftBatches.id,
          centreId: shiftBatches.centreId,
          requestCompletedAt: shiftBatches.requestCompletedAt,
          pendingChangeRevision: shiftBatches.pendingChangeRevision,
        })
        .from(shiftBatches)
        .where(eq(shiftBatches.id, batchId))
        .for('update')
        .limit(1);

      const batch = rows[0];
      if (!batch?.requestCompletedAt) return;

      const wasAlreadyStale = batch.pendingChangeRevision > 0;
      const nextRevision = batch.pendingChangeRevision + 1;
      const now = new Date();

      await tx
        .update(shiftBatches)
        .set({ pendingChangeRevision: nextRevision, updatedAt: now })
        .where(eq(shiftBatches.id, batchId));

      if (!wasAlreadyStale) {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.batchConfirmationOutdated,
            actorType: 'system',
            centreId: batch.centreId,
            entityId: batch.id,
            metadata: {
              batchId: batch.id,
              changeKind: kind,
              pendingChangeRevision: nextRevision,
              ...metadata,
            },
          },
          tx,
        );
      }
    };

    if (executor) {
      await run(executor);
      return;
    }

    await this.db.transaction(run);
  }
}

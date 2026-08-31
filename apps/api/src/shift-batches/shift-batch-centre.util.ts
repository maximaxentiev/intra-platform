import { BadRequestException, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '../db/drizzle.module';
import { shiftBatches, shifts } from '../db/schema';

export async function lockOpenShiftBatch(
  tx: DbExecutor,
  batchId: string,
): Promise<{
  id: string;
  centreId: string;
  requestCompletedAt: Date | null;
}> {
  const rows = await tx
    .select({
      id: shiftBatches.id,
      centreId: shiftBatches.centreId,
      requestCompletedAt: shiftBatches.requestCompletedAt,
    })
    .from(shiftBatches)
    .where(eq(shiftBatches.id, batchId))
    .for('update');

  const batch = rows[0];
  if (!batch) throw new NotFoundException('Batch not found.');
  if (batch.requestCompletedAt) {
    throw new BadRequestException('Batch request is already completed.');
  }
  return batch;
}

export function assertShiftCentreMatchesBatch(centreId: string, batchCentreId: string): void {
  if (centreId !== batchCentreId) {
    throw new BadRequestException('Shift centre must match the batch centre.');
  }
}

export async function assertBatchCentreImmutable(
  tx: DbExecutor,
  batchId: string,
  nextCentreId: string,
): Promise<void> {
  const childCountRows = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(shifts)
    .where(eq(shifts.batchId, batchId));
  const childCount = Number(childCountRows[0]?.count ?? 0);
  if (childCount === 0) return;

  const batchRows = await tx
    .select({ centreId: shiftBatches.centreId })
    .from(shiftBatches)
    .where(eq(shiftBatches.id, batchId));
  const batch = batchRows[0];
  if (!batch) throw new NotFoundException('Batch not found.');
  if (batch.centreId !== nextCentreId) {
    throw new BadRequestException('Batch centre cannot be changed once child shifts exist.');
  }
}

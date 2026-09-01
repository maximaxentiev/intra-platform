import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { shiftBatches, shifts } from '../db/schema';
import {
  type ShiftCommunicationPolicy,
  resolveShiftCommunicationPolicyFromRow,
} from './shift-communication-policy.util';

@Injectable()
export class ShiftCommunicationPolicyService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async resolveForShift(shiftId: string): Promise<ShiftCommunicationPolicy> {
    const rows = await this.db
      .select({
        batchId: shifts.batchId,
        requestCompletedAt: shiftBatches.requestCompletedAt,
        pendingChangeRevision: shiftBatches.pendingChangeRevision,
      })
      .from(shifts)
      .leftJoin(shiftBatches, eq(shifts.batchId, shiftBatches.id))
      .where(eq(shifts.id, shiftId))
      .limit(1);

    const row = rows[0];
    if (!row) throw new NotFoundException('Shift not found.');

    return resolveShiftCommunicationPolicyFromRow({
      batchId: row.batchId,
      requestCompletedAt: row.requestCompletedAt,
      pendingChangeRevision: row.pendingChangeRevision ?? 0,
    });
  }
}

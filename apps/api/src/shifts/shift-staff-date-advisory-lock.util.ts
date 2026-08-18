import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../db/drizzle.module';

/**
 * Transaction-scoped advisory lock for shift assignment eligibility.
 * Serializes same Staff + same calendar date to prevent overlap/buffer races.
 */
export async function acquireShiftStaffDateAdvisoryLock(
  tx: Pick<DbExecutor, 'execute'>,
  staffId: string,
  shiftDate: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${staffId}), hashtext(${shiftDate}))`,
  );
}

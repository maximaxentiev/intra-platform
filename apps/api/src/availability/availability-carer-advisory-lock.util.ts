import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../db/drizzle.module';

/**
 * Stable second component for pg_advisory_xact_lock(int, int).
 * Combined with hashtext(staffId) this scopes one Staff member/week/day.
 */
export function carerAvailabilityDayLockSuffix(
  weekStartDate: string,
  dayOfWeek: number,
): string {
  return `${weekStartDate}:${dayOfWeek}`;
}

/**
 * Transaction-scoped advisory lock for carer availability mutations.
 *
 * PostgreSQL `SELECT … FOR UPDATE` cannot lock rows that do not exist yet, so
 * concurrent first inserts for the same staff/week/day must be serialized here.
 * `pg_advisory_xact_lock` is held until commit/rollback on this transaction.
 *
 * Keys are derived in SQL via PostgreSQL `hashtext()` (deterministic int4 hashes;
 * no Node object/string hashing). Parameterized inputs prevent SQL injection.
 */
export async function acquireCarerAvailabilityDayLock(
  tx: Pick<DbExecutor, 'execute'>,
  staffId: string,
  weekStartDate: string,
  dayOfWeek: number,
): Promise<void> {
  const dayKey = carerAvailabilityDayLockSuffix(weekStartDate, dayOfWeek);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${staffId}), hashtext(${dayKey}))`,
  );
}

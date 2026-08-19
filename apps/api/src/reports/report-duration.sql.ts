import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

/**
 * PostgreSQL expression for same-day shift duration in whole minutes.
 * Matches deriveScheduledShiftMinutes() for valid HH:mm:ss wall-clock values.
 *
 * Malformed legacy rows where end_time <= start_time contribute 0 minutes so
 * reporting aggregates never crash on historical bad data.
 *
 * Use in aggregate SELECT/GROUP BY queries; validate row-level inputs in application
 * code when loading or mutating individual shifts.
 */
export function scheduledShiftDurationMinutesSql(
  startTime: SQLWrapper,
  endTime: SQLWrapper,
): SQL<number> {
  return sql<number>`CASE
    WHEN ${endTime} > ${startTime}
    THEN FLOOR(EXTRACT(EPOCH FROM (${endTime} - ${startTime})) / 60)::int
    ELSE 0
  END`;
}

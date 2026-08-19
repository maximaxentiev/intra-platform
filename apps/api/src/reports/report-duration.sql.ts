import { sql, type SQL } from 'drizzle-orm';

/**
 * PostgreSQL expression for same-day shift duration in whole minutes.
 * Matches deriveScheduledShiftMinutes() for HH:mm:ss wall-clock values.
 *
 * Use in aggregate SELECT/GROUP BY queries; validate row-level inputs in application
 * code when loading individual shifts.
 */
export function scheduledShiftDurationMinutesSql(startTime: SQL, endTime: SQL): SQL<number> {
  return sql<number>`FLOOR(EXTRACT(EPOCH FROM (${endTime} - ${startTime})) / 60)::int`;
}

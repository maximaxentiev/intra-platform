import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { availability, shifts, staff } from '../db/schema';

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async summary(weekStart: string, weekEnd: string, dayOfWeek: number) {
    const [weekShifts, pending, filled, availToday, rosterStaff] = await Promise.all([
      this.db
        .select({ id: shifts.id })
        .from(shifts)
        .where(and(gte(shifts.shiftDate, weekStart), lte(shifts.shiftDate, weekEnd))),
      this.db.select({ id: shifts.id }).from(shifts).where(eq(shifts.status, 'pending')),
      this.db.select({ id: shifts.id }).from(shifts).where(eq(shifts.status, 'filled')),
      this.db
        .select({ staffId: availability.staffId })
        .from(availability)
        .where(and(eq(availability.weekStartDate, weekStart), eq(availability.dayOfWeek, dayOfWeek))),
      this.db
        .select({
          id: staff.id,
          legalName: staff.legalName,
          displayName: staff.displayName,
          useDisplayName: staff.useDisplayName,
        })
        .from(staff),
    ]);

    const availIds = new Set(availToday.map((a) => a.staffId));
    const availableToday = rosterStaff.filter((s) => availIds.has(s.id));

    return {
      week: weekShifts.length,
      pending: pending.length,
      filled: filled.length,
      availableToday,
    };
  }
}

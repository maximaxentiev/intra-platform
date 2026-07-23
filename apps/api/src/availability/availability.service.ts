import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { availability } from '../db/schema';
import { CreateAvailabilityDto, UpdateAvailabilityDto } from './dto/availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  list(weekStart: string, staffId?: string) {
    const conds: SQL[] = [eq(availability.weekStartDate, weekStart)];
    if (staffId) conds.push(eq(availability.staffId, staffId));
    return this.db
      .select()
      .from(availability)
      .where(and(...conds))
      .orderBy(asc(availability.dayOfWeek));
  }

  async create(dto: CreateAvailabilityDto) {
    const rows = await this.db
      .insert(availability)
      .values({
        staffId: dto.staffId,
        weekStartDate: dto.weekStartDate,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateAvailabilityDto) {
    const patch: Record<string, unknown> = {};
    if (dto.startTime !== undefined) patch.startTime = dto.startTime;
    if (dto.endTime !== undefined) patch.endTime = dto.endTime;
    const rows = await this.db
      .update(availability)
      .set(patch)
      .where(eq(availability.id, id))
      .returning();
    if (!rows[0]) throw new NotFoundException('Availability not found.');
    return rows[0];
  }

  async remove(id: string) {
    await this.db.delete(availability).where(eq(availability.id, id));
    return { ok: true };
  }
}

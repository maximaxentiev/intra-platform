import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, staff } from '../db/schema';

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async assertCentreExists(centreId: string): Promise<void> {
    const rows = await this.db
      .select({ id: centres.id })
      .from(centres)
      .where(eq(centres.id, centreId))
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundException('Centre not found.');
    }
  }

  async assertCentresExist(centreIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(centreIds)];
    if (uniqueIds.length === 0) {
      return;
    }

    const rows = await this.db
      .select({ id: centres.id })
      .from(centres)
      .where(inArray(centres.id, uniqueIds));
    if (rows.length !== uniqueIds.length) {
      throw new NotFoundException('Centre not found.');
    }
  }

  async assertStaffExists(staffId: string): Promise<void> {
    const rows = await this.db
      .select({ id: staff.id })
      .from(staff)
      .where(eq(staff.id, staffId))
      .limit(1);
    if (!rows[0]) {
      throw new NotFoundException('Staff not found.');
    }
  }
}

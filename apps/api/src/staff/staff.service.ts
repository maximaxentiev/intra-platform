import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, shifts, staff, staffCentreBanned, staffCentreTop } from '../db/schema';
import { sanitizeOptionalHttpUrl } from '../common/url.util';
import { SetCentreLinksDto, UpsertStaffDto } from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  list() {
    return this.db.select().from(staff).orderBy(staff.legalName);
  }

  async get(id: string) {
    const rows = await this.db.select().from(staff).where(eq(staff.id, id));
    if (!rows[0]) throw new NotFoundException('Staff not found.');
    return rows[0];
  }

  private toValues(dto: UpsertStaffDto) {
    return {
      legalName: dto.legalName,
      displayName: dto.displayName ?? '',
      useDisplayName: dto.useDisplayName ?? false,
      phone: dto.phone ?? '',
      email: dto.email ?? '',
      role: dto.role ?? '',
      status: dto.status ?? 'active',
      notes: dto.notes ?? '',
      documentsUrl: sanitizeOptionalHttpUrl(dto.documentsUrl),
    };
  }

  async create(dto: UpsertStaffDto) {
    const rows = await this.db.insert(staff).values(this.toValues(dto)).returning();
    return rows[0];
  }

  async update(id: string, dto: UpsertStaffDto) {
    const rows = await this.db
      .update(staff)
      .set({ ...this.toValues(dto), updatedAt: new Date() })
      .where(eq(staff.id, id))
      .returning();
    if (!rows[0]) throw new NotFoundException('Staff not found.');
    return rows[0];
  }

  async remove(id: string) {
    await this.db.delete(staff).where(eq(staff.id, id));
    return { ok: true };
  }

  async topCentreIds(staffId: string) {
    const rows = await this.db
      .select({ centreId: staffCentreTop.centreId })
      .from(staffCentreTop)
      .where(eq(staffCentreTop.staffId, staffId));
    return rows.map((r) => r.centreId);
  }

  async bannedCentreIds(staffId: string) {
    const rows = await this.db
      .select({ centreId: staffCentreBanned.centreId })
      .from(staffCentreBanned)
      .where(eq(staffCentreBanned.staffId, staffId));
    return rows.map((r) => r.centreId);
  }

  // Replace the full set of top centres for a staff member. Enforces
  // mutual exclusion: any centre set as top is removed from banned (M-rule).
  async setTopCentres(staffId: string, centreIds: string[]) {
    await this.get(staffId);
    await this.db.transaction(async (tx) => {
      await tx.delete(staffCentreTop).where(eq(staffCentreTop.staffId, staffId));
      if (centreIds.length) {
        await tx
          .insert(staffCentreTop)
          .values(centreIds.map((centreId) => ({ staffId, centreId })));
        await tx
          .delete(staffCentreBanned)
          .where(and(eq(staffCentreBanned.staffId, staffId), inArray(staffCentreBanned.centreId, centreIds)));
      }
    });
    return this.topCentreIds(staffId);
  }

  async setBannedCentres(staffId: string, centreIds: string[]) {
    await this.get(staffId);
    await this.db.transaction(async (tx) => {
      await tx.delete(staffCentreBanned).where(eq(staffCentreBanned.staffId, staffId));
      if (centreIds.length) {
        await tx
          .insert(staffCentreBanned)
          .values(centreIds.map((centreId) => ({ staffId, centreId })));
        await tx
          .delete(staffCentreTop)
          .where(and(eq(staffCentreTop.staffId, staffId), inArray(staffCentreTop.centreId, centreIds)));
      }
    });
    return this.bannedCentreIds(staffId);
  }

  async shiftHistory(staffId: string) {
    return this.db
      .select({
        id: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        status: shifts.status,
        roleNeeded: shifts.roleNeeded,
        centreId: shifts.centreId,
        centreName: centres.name,
      })
      .from(shifts)
      .leftJoin(centres, eq(centres.id, shifts.centreId))
      .where(eq(shifts.assignedStaffId, staffId))
      .orderBy(desc(shifts.shiftDate));
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  centreContacts,
  centreSecondaryChannels,
  centres,
  shifts,
  staff,
  staffCentreBanned,
  staffCentreTop,
} from '../db/schema';
import {
  ReorderContactsDto,
  UpsertCentreDto,
  UpsertContactDto,
} from './dto/centres.dto';
import { assertCityForCreate, assertCityForUpdate } from '../common/city-validation';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import {
  PlatformAuditService,
  buildFieldChanges,
} from '../platform-audit/platform-audit.service';

type Channel = 'whatsapp' | 'goto' | 'email';

function normalizeInternalOpsNotes(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class CentresService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  // List with the primary (lowest sort_order) contact name for the directory.
  async list() {
    const rows = await this.db.select().from(centres).orderBy(centres.name);
    const contacts = await this.db
      .select({
        centreId: centreContacts.centreId,
        name: centreContacts.name,
        sortOrder: centreContacts.sortOrder,
      })
      .from(centreContacts)
      .orderBy(asc(centreContacts.sortOrder));

    const primaryByCentre = new Map<string, string>();
    for (const c of contacts) {
      if (!primaryByCentre.has(c.centreId) && c.name) primaryByCentre.set(c.centreId, c.name);
    }
    return rows.map((r) => ({ ...r, primaryContactName: primaryByCentre.get(r.id) ?? '' }));
  }

  async get(id: string) {
    const rows = await this.db.select().from(centres).where(eq(centres.id, id));
    if (!rows[0]) throw new NotFoundException('Centre not found.');
    return rows[0];
  }

  async create(dto: UpsertCentreDto, actorUserId: string) {
    const city = dto.city?.trim() ? assertCityForCreate(dto.city) : '';
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .insert(centres)
        .values({
          name: dto.name,
          address: dto.address ?? '',
          city,
          hourlyRate: dto.hourlyRate ?? null,
          primaryChannel: dto.primaryChannel,
          notes: dto.notes ?? '',
          internalOpsNotes: normalizeInternalOpsNotes(dto.internalOpsNotes),
        })
        .returning();
      const created = rows[0]!;
      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.centreCreated,
          actorType: 'ops_user',
          actorUserId,
          centreId: created.id,
          entityId: created.id,
          metadata: { name: created.name },
        },
        tx,
      );
      return created;
    });
  }

  async update(id: string, dto: UpsertCentreDto, actorUserId: string) {
    const existing = await this.get(id);
    let city = dto.city ?? '';
    if (dto.city !== undefined && dto.city.trim()) {
      city = assertCityForUpdate(dto.city, existing.city);
    } else if (dto.city !== undefined) {
      city = '';
    }

    const rows = await this.db.transaction(async (tx) => {
      const updatedRows = await tx
        .update(centres)
        .set({
          name: dto.name,
          address: dto.address ?? '',
          city,
          hourlyRate: dto.hourlyRate ?? null,
          primaryChannel: dto.primaryChannel,
          notes: dto.notes ?? '',
          internalOpsNotes: normalizeInternalOpsNotes(dto.internalOpsNotes),
          updatedAt: new Date(),
        })
        .where(eq(centres.id, id))
        .returning();
      if (!updatedRows[0]) throw new NotFoundException('Centre not found.');

      const changes = buildFieldChanges(
        {
          name: existing.name,
          address: existing.address,
          city: existing.city,
          primaryChannel: existing.primaryChannel,
        },
        {
          name: updatedRows[0].name,
          address: updatedRows[0].address,
          city: updatedRows[0].city,
          primaryChannel: updatedRows[0].primaryChannel,
        },
        ['name', 'address', 'city', 'primaryChannel'],
      );
      if (changes) {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.centreUpdated,
            actorType: 'ops_user',
            actorUserId,
            centreId: id,
            entityId: id,
            metadata: { changes },
          },
          tx,
        );
      }

      return updatedRows;
    });
    return rows[0];
  }

  async remove(id: string, actorUserId: string) {
    const existing = await this.get(id);
    await this.db.transaction(async (tx) => {
      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.centreDeleted,
          actorType: 'ops_user',
          actorUserId,
          centreId: id,
          entityId: id,
          metadata: { name: existing.name },
        },
        tx,
      );
      await tx.delete(centres).where(eq(centres.id, id));
    });
    return { ok: true };
  }

  // --- Secondary channels -------------------------------------------------
  async secondaryChannels(centreId: string): Promise<Channel[]> {
    const rows = await this.db
      .select({ channel: centreSecondaryChannels.channel })
      .from(centreSecondaryChannels)
      .where(eq(centreSecondaryChannels.centreId, centreId));
    return rows.map((r) => r.channel as Channel);
  }

  async setSecondaryChannels(centreId: string, channels: Channel[]) {
    const centre = await this.get(centreId);
    // Secondary must never duplicate the primary channel.
    const filtered = [...new Set(channels)].filter((c) => c !== centre.primaryChannel);
    await this.db.transaction(async (tx) => {
      await tx.delete(centreSecondaryChannels).where(eq(centreSecondaryChannels.centreId, centreId));
      if (filtered.length) {
        await tx
          .insert(centreSecondaryChannels)
          .values(filtered.map((channel) => ({ centreId, channel })));
      }
    });
    return this.secondaryChannels(centreId);
  }

  // --- Contacts -----------------------------------------------------------
  contacts(centreId: string) {
    return this.db
      .select()
      .from(centreContacts)
      .where(eq(centreContacts.centreId, centreId))
      .orderBy(asc(centreContacts.sortOrder));
  }

  async addContact(centreId: string, dto: UpsertContactDto) {
    await this.get(centreId);
    const existing = await this.contacts(centreId);
    const rows = await this.db
      .insert(centreContacts)
      .values({
        centreId,
        name: dto.name ?? '',
        title: dto.title ?? '',
        email: dto.email ?? '',
        phone: dto.phone ?? '',
        sortOrder: existing.length,
      })
      .returning();
    return rows[0];
  }

  async updateContact(contactId: string, dto: UpsertContactDto) {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    const rows = await this.db
      .update(centreContacts)
      .set(patch)
      .where(eq(centreContacts.id, contactId))
      .returning();
    if (!rows[0]) throw new NotFoundException('Contact not found.');
    return rows[0];
  }

  async removeContact(contactId: string) {
    await this.db.delete(centreContacts).where(eq(centreContacts.id, contactId));
    return { ok: true };
  }

  async reorderContacts(centreId: string, dto: ReorderContactsDto) {
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < dto.ids.length; i++) {
        await tx
          .update(centreContacts)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(centreContacts.id, dto.ids[i]), eq(centreContacts.centreId, centreId)));
      }
    });
    return this.contacts(centreId);
  }

  // --- Top / Banned staff (mirror of staff-side with mutual exclusion) ----
  private async linkedStaff(centreId: string, table: typeof staffCentreTop | typeof staffCentreBanned) {
    return this.db
      .select({
        staffId: table.staffId,
        id: staff.id,
        legalName: staff.legalName,
        displayName: staff.displayName,
        useDisplayName: staff.useDisplayName,
      })
      .from(table)
      .innerJoin(staff, eq(staff.id, table.staffId))
      .where(eq(table.centreId, centreId));
  }

  topStaff(centreId: string) {
    return this.linkedStaff(centreId, staffCentreTop);
  }

  bannedStaff(centreId: string) {
    return this.linkedStaff(centreId, staffCentreBanned);
  }

  async setTopStaff(centreId: string, staffIds: string[]) {
    await this.get(centreId);
    await this.db.transaction(async (tx) => {
      await tx.delete(staffCentreTop).where(eq(staffCentreTop.centreId, centreId));
      if (staffIds.length) {
        await tx.insert(staffCentreTop).values(staffIds.map((staffId) => ({ centreId, staffId })));
        await tx
          .delete(staffCentreBanned)
          .where(and(eq(staffCentreBanned.centreId, centreId), inArray(staffCentreBanned.staffId, staffIds)));
      }
    });
    return this.topStaff(centreId);
  }

  async setBannedStaff(centreId: string, staffIds: string[]) {
    await this.get(centreId);
    await this.db.transaction(async (tx) => {
      await tx.delete(staffCentreBanned).where(eq(staffCentreBanned.centreId, centreId));
      if (staffIds.length) {
        await tx.insert(staffCentreBanned).values(staffIds.map((staffId) => ({ centreId, staffId })));
        await tx
          .delete(staffCentreTop)
          .where(and(eq(staffCentreTop.centreId, centreId), inArray(staffCentreTop.staffId, staffIds)));
      }
    });
    return this.bannedStaff(centreId);
  }

  shiftHistory(centreId: string) {
    return this.db
      .select({
        id: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        status: shifts.status,
        roleNeeded: shifts.roleNeeded,
        assignedStaffId: shifts.assignedStaffId,
        assignedLegalName: staff.legalName,
        assignedDisplayName: staff.displayName,
        assignedUseDisplayName: staff.useDisplayName,
      })
      .from(shifts)
      .leftJoin(staff, eq(staff.id, shifts.assignedStaffId))
      .where(eq(shifts.centreId, centreId))
      .orderBy(desc(shifts.shiftDate));
  }
}

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  centres,
  shifts,
  staff,
  staffAccounts,
  staffCentreBanned,
  staffCentreTop,
  staffPortalAuditEvents,
} from '../db/schema';
import { sanitizeOptionalHttpUrl } from '../common/url.util';
import { assertCityForCreate, assertCityForUpdate } from '../common/city-validation';
import { CreateManualStaffDto } from './dto/create-manual-staff.dto';
import { SetCentreLinksDto, UpsertStaffDto } from './dto/staff.dto';
import {
  normalizeStaffEmail,
  resolvePortalAccountDisplayStatus,
} from '../staff-portal/portal-account-status.util';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
  staffPortalAuditBlocksDeletion,
} from '../staff-portal/staff-portal-audit.service';
import { StaffDocumentsService } from '../staff-documents/staff-documents.service';
import { PLATFORM_AUDIT_ACTIONS } from '../platform-audit/platform-audit.constants';
import { PlatformAuditService, buildFieldChanges } from '../platform-audit/platform-audit.service';

@Injectable()
export class StaffService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly portalAudit: StaffPortalAuditService,
    private readonly staffDocuments: StaffDocumentsService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  async list() {
    const rows = await this.db.select().from(staff).orderBy(staff.legalName);
    const accounts = await this.db.select().from(staffAccounts);
    const byStaff = new Map(accounts.map((a) => [a.staffId, a]));
    const documentStatusByStaff = await this.staffDocuments.getDocumentStatusMapForStaffIds(
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...this.withPortalSummary(row, byStaff.get(row.id)),
      documentStatus: documentStatusByStaff.get(row.id) ?? 'no_documents_submitted',
    }));
  }

  async get(id: string) {
    const rows = await this.db.select().from(staff).where(eq(staff.id, id));
    if (!rows[0]) throw new NotFoundException('Staff not found.');
    const account = (
      await this.db.select().from(staffAccounts).where(eq(staffAccounts.staffId, id))
    )[0];
    return {
      ...this.serializeStaff(rows[0]),
      portalAccount: account ? this.portalAccountFields(account) : null,
    };
  }

  async createManual(
    dto: CreateManualStaffDto,
    actorUserId: string,
    auditMeta?: { source?: 'manual' | 'csv_import'; importBatchId?: string },
  ) {
    const email = normalizeStaffEmail(dto.email);
    await this.assertStaffEmailAvailable(email);
    await this.assertPortalEmailAvailable(email);

    const legalFirstName = dto.legalFirstName.trim();
    const legalLastName = dto.legalLastName.trim();
    const legalName = `${legalFirstName} ${legalLastName}`.trim();
    const city = assertCityForCreate(dto.city);

    const rows = await this.db
      .insert(staff)
      .values({
        legalName,
        legalFirstName,
        legalLastName,
        displayName: dto.displayName.trim(),
        useDisplayName: true,
        phone: dto.phone.trim(),
        email,
        address: dto.address.trim(),
        city,
        role: dto.role,
        status: 'active',
      })
      .returning();

    await this.portalAudit.record({
      staffId: rows[0]!.id,
      actorUserId,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.staffCreated,
      detail: {
        email,
        source: auditMeta?.source ?? 'manual',
        ...(auditMeta?.importBatchId ? { importBatchId: auditMeta.importBatchId } : {}),
      },
    });

    return this.withPortalSummary(rows[0]!, undefined);
  }

  private withPortalSummary(row: typeof staff.$inferSelect, account?: typeof staffAccounts.$inferSelect) {
    return {
      ...this.serializeStaff(row),
      portalAccountStatus: resolvePortalAccountDisplayStatus(account ?? null),
    };
  }

  private portalAccountFields(account: typeof staffAccounts.$inferSelect) {
    return {
      accountStatus: resolvePortalAccountDisplayStatus(account),
      email: account.email,
      inviteSentAt: account.inviteSentAt?.toISOString() ?? null,
      inviteExpiresAt: account.inviteTokenExpiresAt?.toISOString() ?? null,
      lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
      onboardingCompletedAt: account.onboardingCompletedAt?.toISOString() ?? null,
      onboardingStep: account.onboardingStep,
      profileCompletedAt: account.profileCompletedAt?.toISOString() ?? null,
    };
  }

  private serializeStaff(row: typeof staff.$inferSelect) {
    return {
      id: row.id,
      legalName: row.legalName,
      legalFirstName: row.legalFirstName,
      legalLastName: row.legalLastName,
      displayName: row.displayName,
      useDisplayName: row.useDisplayName,
      phone: row.phone,
      email: row.email,
      address: row.address,
      city: row.city,
      role: row.role,
      notes: row.notes,
      documentsUrl: row.documentsUrl,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async assertStaffEmailAvailable(email: string, excludeStaffId?: string) {
    const rows = await this.db
      .select({ id: staff.id })
      .from(staff)
      .where(
        excludeStaffId
          ? and(eq(staff.email, email), ne(staff.id, excludeStaffId))
          : eq(staff.email, email),
      );
    if (rows.length) {
      throw new ConflictException('A staff member with this email address already exists.');
    }
  }

  private async assertPortalEmailAvailable(email: string, excludeStaffId?: string) {
    const rows = await this.db.select().from(staffAccounts).where(eq(staffAccounts.email, email));
    if (rows.some((r) => r.staffId !== excludeStaffId)) {
      throw new ConflictException('This email is already used by a portal account.');
    }
  }

  private toValues(dto: UpsertStaffDto) {
    const legalFirstName = dto.legalFirstName?.trim() ?? '';
    const legalLastName = dto.legalLastName?.trim() ?? '';
    const legalName =
      dto.legalName?.trim() ||
      `${legalFirstName} ${legalLastName}`.trim() ||
      dto.legalName ||
      '';
    return {
      legalName,
      legalFirstName,
      legalLastName,
      address: dto.address?.trim() ?? '',
      city: dto.city?.trim() ?? '',
      displayName: dto.displayName?.trim() ?? '',
      useDisplayName: dto.useDisplayName ?? false,
      phone: dto.phone?.trim() ?? '',
      email: dto.email ? normalizeStaffEmail(dto.email) : '',
      role: dto.role ?? '',
      notes: dto.notes ?? '',
      documentsUrl: sanitizeOptionalHttpUrl(dto.documentsUrl),
    };
  }

  async create(dto: UpsertStaffDto) {
    const rows = await this.db.insert(staff).values(this.toValues(dto)).returning();
    return rows[0];
  }

  async update(id: string, dto: UpsertStaffDto, actorUserId: string) {
    const existing = (
      await this.db.select().from(staff).where(eq(staff.id, id))
    )[0];
    if (!existing) throw new NotFoundException('Staff not found.');

    const values = this.toValues(dto);
    if (dto.city !== undefined) {
      values.city = assertCityForUpdate(values.city, existing.city);
    }
    if (dto.documentsUrl === undefined) {
      values.documentsUrl = existing.documentsUrl;
    }

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(staff)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(staff.id, id))
        .returning();
      if (!rows[0]) throw new NotFoundException('Staff not found.');

      const changes = buildFieldChanges(
        {
          legalName: existing.legalName,
          role: existing.role,
          email: existing.email,
        },
        {
          legalName: rows[0].legalName,
          role: rows[0].role,
          email: rows[0].email,
        },
        ['legalName', 'role', 'email'],
      );
      if (changes) {
        await this.platformAudit.record(
          {
            action: PLATFORM_AUDIT_ACTIONS.staffUpdated,
            actorType: 'ops_user',
            actorUserId,
            staffId: id,
            entityId: id,
            metadata: { changes },
          },
          tx,
        );
      }

      return rows[0];
    });
  }

  async remove(id: string, actorUserId: string) {
    const account = (
      await this.db.select().from(staffAccounts).where(eq(staffAccounts.staffId, id))
    )[0];
    if (account) {
      throw new ConflictException(
        'This staff member has a carer portal account. Disable portal access instead of deleting.',
      );
    }

    const auditRows = await this.db
      .select({ eventType: staffPortalAuditEvents.eventType })
      .from(staffPortalAuditEvents)
      .where(eq(staffPortalAuditEvents.staffId, id));
    const hasPortalLifecycleAudit = auditRows.some((row) =>
      staffPortalAuditBlocksDeletion(row.eventType),
    );
    if (hasPortalLifecycleAudit) {
      throw new ConflictException(
        'This staff member has portal invitation or access history. Disable portal access instead of deleting.',
      );
    }

    await this.db.transaction(async (tx) => {
      await this.platformAudit.record(
        {
          action: PLATFORM_AUDIT_ACTIONS.staffDeleted,
          actorType: 'ops_user',
          actorUserId,
          staffId: id,
          entityId: id,
          metadata: { name: (await tx.select({ legalName: staff.legalName }).from(staff).where(eq(staff.id, id)))[0]?.legalName },
        },
        tx,
      );
      await tx.delete(staff).where(eq(staff.id, id));
    });
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

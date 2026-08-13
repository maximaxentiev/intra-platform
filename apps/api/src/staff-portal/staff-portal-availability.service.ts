import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import {
  assertCalendarDateNotBeforeToday,
  assertNoOverlap,
  assertStartBeforeEnd,
  assertValidWeekStartDate,
  formatAvailabilityTimeForCarer,
  normalizeAvailabilityTimeHm,
} from '../availability/availability-carer-validation.util';
import { calendarDateFromWeekDay } from '../availability/availability-calendar.util';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { availability, staffAccounts, type Availability } from '../db/schema';
import {
  CreateStaffPortalAvailabilityDto,
  StaffPortalAvailabilityDto,
  StaffPortalAvailabilityOnboardingDto,
  UpdateStaffPortalAvailabilityDto,
} from './dto/staff-portal-availability.dto';
import { ONBOARDING_STEP } from './staff-onboarding.util';
import type { StaffSessionPayload } from './staff-session.service';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from './staff-portal-audit.service';

@Injectable()
export class StaffPortalAvailabilityService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: StaffPortalAuditService,
  ) {}

  async list(session: StaffSessionPayload, weekStart: string): Promise<StaffPortalAvailabilityDto[]> {
    assertValidWeekStartDate(weekStart);
    const rows = await this.db
      .select()
      .from(availability)
      .where(
        and(eq(availability.staffId, session.staffId), eq(availability.weekStartDate, weekStart)),
      )
      .orderBy(asc(availability.dayOfWeek), asc(availability.startTime));

    return rows.map((row) => this.toDto(row));
  }

  async create(
    session: StaffSessionPayload,
    dto: CreateStaffPortalAvailabilityDto,
  ): Promise<StaffPortalAvailabilityDto> {
    await this.loadActiveAccount(session);
    assertValidWeekStartDate(dto.weekStartDate);
    assertCalendarDateNotBeforeToday(dto.weekStartDate, dto.dayOfWeek, 'create');

    const startTime = normalizeAvailabilityTimeHm(dto.startTime, 'startTime');
    const endTime = normalizeAvailabilityTimeHm(dto.endTime, 'endTime');
    assertStartBeforeEnd(startTime, endTime);

    const calendarDate = calendarDateFromWeekDay(dto.weekStartDate, dto.dayOfWeek);

    const row = await this.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(availability)
        .where(
          and(
            eq(availability.staffId, session.staffId),
            eq(availability.weekStartDate, dto.weekStartDate),
            eq(availability.dayOfWeek, dto.dayOfWeek),
          ),
        )
        .for('update');

      assertNoOverlap({ startTime, endTime }, existing);

      const inserted = await tx
        .insert(availability)
        .values({
          staffId: session.staffId,
          weekStartDate: dto.weekStartDate,
          dayOfWeek: dto.dayOfWeek,
          startTime,
          endTime,
        })
        .returning();

      await this.audit.record(
        {
          staffId: session.staffId,
          staffAccountId: session.accountId,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.carerAvailabilityCreated,
          detail: {
            source: 'carer_portal',
            availabilityId: inserted[0]!.id,
            calendarDate,
            startTime: formatAvailabilityTimeForCarer(startTime),
            endTime: formatAvailabilityTimeForCarer(endTime),
          },
        },
        tx,
      );

      return inserted[0]!;
    });

    return this.toDto(row);
  }

  async update(
    session: StaffSessionPayload,
    id: string,
    dto: UpdateStaffPortalAvailabilityDto,
  ): Promise<StaffPortalAvailabilityDto> {
    await this.loadActiveAccount(session);

    const startTime = normalizeAvailabilityTimeHm(dto.startTime, 'startTime');
    const endTime = normalizeAvailabilityTimeHm(dto.endTime, 'endTime');
    assertStartBeforeEnd(startTime, endTime);

    const row = await this.db.transaction(async (tx) => {
      const owned = await this.loadOwnedRowTx(tx, id, session.staffId);
      assertCalendarDateNotBeforeToday(owned.weekStartDate, owned.dayOfWeek, 'update');

      const existing = await tx
        .select()
        .from(availability)
        .where(
          and(
            eq(availability.staffId, session.staffId),
            eq(availability.weekStartDate, owned.weekStartDate),
            eq(availability.dayOfWeek, owned.dayOfWeek),
          ),
        )
        .for('update');

      assertNoOverlap({ startTime, endTime }, existing, id);

      const updated = await tx
        .update(availability)
        .set({ startTime, endTime })
        .where(eq(availability.id, id))
        .returning();

      const calendarDate = calendarDateFromWeekDay(owned.weekStartDate, owned.dayOfWeek);
      await this.audit.record(
        {
          staffId: session.staffId,
          staffAccountId: session.accountId,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.carerAvailabilityUpdated,
          detail: {
            source: 'carer_portal',
            availabilityId: id,
            calendarDate,
            startTime: formatAvailabilityTimeForCarer(startTime),
            endTime: formatAvailabilityTimeForCarer(endTime),
          },
        },
        tx,
      );

      return updated[0]!;
    });

    return this.toDto(row);
  }

  async remove(session: StaffSessionPayload, id: string): Promise<{ ok: true }> {
    await this.loadActiveAccount(session);

    await this.db.transaction(async (tx) => {
      const owned = await this.loadOwnedRowTx(tx, id, session.staffId);
      await tx.delete(availability).where(eq(availability.id, id));

      const calendarDate = calendarDateFromWeekDay(owned.weekStartDate, owned.dayOfWeek);
      await this.audit.record(
        {
          staffId: session.staffId,
          staffAccountId: session.accountId,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.carerAvailabilityDeleted,
          detail: {
            source: 'carer_portal',
            availabilityId: id,
            calendarDate,
            startTime: formatAvailabilityTimeForCarer(owned.startTime),
            endTime: formatAvailabilityTimeForCarer(owned.endTime),
          },
        },
        tx,
      );
    });

    return { ok: true };
  }

  /** Marks onboarding Step 3 complete. Idempotent; zero availability rows is allowed. */
  async completeStep3(session: StaffSessionPayload): Promise<StaffPortalAvailabilityOnboardingDto> {
    const account = await this.loadActiveAccount(session);

    if (!account.profileCompletedAt) {
      throw new BadRequestException('Complete your profile before finishing onboarding.');
    }
    if (!account.documentsCompletedAt) {
      throw new BadRequestException('Complete your documents before finishing onboarding.');
    }

    if (account.onboardingCompletedAt) {
      return this.toOnboardingDto(account);
    }

    const now = new Date();
    await this.db
      .update(staffAccounts)
      .set({
        onboardingCompletedAt: now,
        onboardingStep: Math.max(account.onboardingStep, ONBOARDING_STEP.availability),
        updatedAt: now,
      })
      .where(eq(staffAccounts.id, account.id));

    await this.audit.record({
      staffId: account.staffId,
      staffAccountId: account.id,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.onboardingStep3Completed,
      detail: { source: 'carer_portal' },
    });

    const refreshed = await this.loadActiveAccount(session);
    return this.toOnboardingDto(refreshed);
  }

  private async loadActiveAccount(session: StaffSessionPayload) {
    const account = (
      await this.db.select().from(staffAccounts).where(eq(staffAccounts.id, session.accountId))
    )[0];
    if (!account || account.status === 'disabled') {
      throw new UnauthorizedException('Not authenticated.');
    }
    if (account.staffId !== session.staffId) {
      throw new UnauthorizedException('Not authenticated.');
    }
    return account;
  }

  private async loadOwnedRowTx(
    tx: Pick<Database, 'select'>,
    id: string,
    staffId: string,
  ): Promise<Availability> {
    const rows = await tx.select().from(availability).where(eq(availability.id, id)).for('update');
    const row = rows[0];
    if (!row || row.staffId !== staffId) {
      throw new NotFoundException('Availability not found.');
    }
    return row;
  }

  private toDto(row: Availability): StaffPortalAvailabilityDto {
    return {
      id: row.id,
      weekStartDate: row.weekStartDate,
      dayOfWeek: row.dayOfWeek,
      startTime: formatAvailabilityTimeForCarer(row.startTime),
      endTime: formatAvailabilityTimeForCarer(row.endTime),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toOnboardingDto(
    account: typeof staffAccounts.$inferSelect,
  ): StaffPortalAvailabilityOnboardingDto {
    return {
      profileCompletedAt: account.profileCompletedAt?.toISOString() ?? null,
      documentsCompletedAt: account.documentsCompletedAt?.toISOString() ?? null,
      onboardingStep: account.onboardingStep,
      onboardingCompletedAt: account.onboardingCompletedAt?.toISOString() ?? null,
    };
  }
}

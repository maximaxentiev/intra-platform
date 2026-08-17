import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  addDaysToDateString,
  buildAnchoredOnboardingDays,
  canCompleteGuidedOnboarding,
  computeOnboardingDayStatus,
  isAnchoredOnboardingWeekStart,
  isOnboardingWeekComplete,
  torontoMondayWeekStart,
} from '../availability/availability-onboarding-state.util';
import {
  assertCalendarDateNotBeforeToday,
  assertNoOverlap,
  assertStartBeforeEnd,
  assertValidWeekStartDate,
  formatAvailabilityTimeForCarer,
  normalizeAvailabilityTimeHm,
} from '../availability/availability-carer-validation.util';
import { calendarDateFromWeekDay } from '../availability/availability-calendar.util';
import { acquireCarerAvailabilityDayLock } from '../availability/availability-carer-advisory-lock.util';
import { torontoTodayDateString } from '../availability/availability-toronto.util';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  availability,
  staffAccounts,
  staffAvailabilityUnavailableDays,
  type Availability,
} from '../db/schema';
import {
  CreateStaffPortalAvailabilityDto,
  MarkStaffPortalUnavailableDto,
  StaffPortalAvailabilityDto,
  StaffPortalAvailabilityOnboardingStateDto,
  UpdateStaffPortalAvailabilityDto,
} from './dto/staff-portal-availability.dto';
import type { StaffSessionPayload } from './staff-session.service';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from './staff-portal-audit.service';
import { StaffPortalOnboardingService } from './staff-portal-onboarding.service';
import type { StaffPortalOnboardingStatusDto } from './dto/staff-portal-onboarding.dto';

@Injectable()
export class StaffPortalAvailabilityService {
  /**
   * Carer availability writes serialize per staff/week/day using
   * pg_advisory_xact_lock inside the mutation transaction, then SELECT … FOR UPDATE
   * on existing same-day rows as defense-in-depth when rows are present.
   */
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: StaffPortalAuditService,
    private readonly onboarding: StaffPortalOnboardingService,
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

  async getOnboardingState(
    session: StaffSessionPayload,
  ): Promise<StaffPortalAvailabilityOnboardingStateDto> {
    const account = await this.loadActiveAccount(session);
    return this.buildOnboardingState(session.staffId, account);
  }

  /** Idempotently establishes the two-week onboarding anchor (Toronto Monday of today). */
  async ensureOnboardingState(
    session: StaffSessionPayload,
  ): Promise<StaffPortalAvailabilityOnboardingStateDto> {
    await this.assertOnboardingPrerequisites(session);

    const anchorStarted = await this.db.transaction(async (tx) => {
      const account = await this.loadAccountForUpdateTx(tx, session.accountId, session.staffId);

      if (account.availabilityOnboardingWeek1Start) {
        return false;
      }

      const week1Start = torontoMondayWeekStart();
      const now = new Date();
      await tx
        .update(staffAccounts)
        .set({
          availabilityOnboardingWeek1Start: week1Start,
          updatedAt: now,
        })
        .where(eq(staffAccounts.id, account.id));

      await this.audit.record(
        {
          staffId: session.staffId,
          staffAccountId: session.accountId,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.availabilityOnboardingPeriodStarted,
          detail: { source: 'carer_portal', week1Start },
        },
        tx,
      );

      return true;
    });

    const account = await this.loadActiveAccount(session);
    const state = await this.buildOnboardingState(session.staffId, account);
    if (anchorStarted && !state.anchorEstablished) {
      throw new BadRequestException('Failed to establish onboarding anchor.');
    }
    return state;
  }

  async markUnavailable(
    session: StaffSessionPayload,
    dto: MarkStaffPortalUnavailableDto,
  ): Promise<StaffPortalAvailabilityOnboardingStateDto> {
    await this.loadActiveAccount(session);
    assertValidWeekStartDate(dto.weekStartDate);
    assertCalendarDateNotBeforeToday(dto.weekStartDate, dto.dayOfWeek, 'mark unavailable');

    const account = await this.loadActiveAccount(session);
    const week1Start = account.availabilityOnboardingWeek1Start;
    if (!week1Start) {
      throw new BadRequestException('Establish your onboarding period before marking days unavailable.');
    }
    if (!isAnchoredOnboardingWeekStart(week1Start, dto.weekStartDate)) {
      throw new BadRequestException('Date is outside your guided onboarding period.');
    }

    const calendarDate = calendarDateFromWeekDay(dto.weekStartDate, dto.dayOfWeek);

    await this.db.transaction(async (tx) => {
      await acquireCarerAvailabilityDayLock(
        tx,
        session.staffId,
        dto.weekStartDate,
        dto.dayOfWeek,
      );

      const removed = await tx
        .delete(availability)
        .where(
          and(
            eq(availability.staffId, session.staffId),
            eq(availability.weekStartDate, dto.weekStartDate),
            eq(availability.dayOfWeek, dto.dayOfWeek),
          ),
        )
        .returning();

      await tx
        .insert(staffAvailabilityUnavailableDays)
        .values({ staffId: session.staffId, calendarDate })
        .onConflictDoUpdate({
          target: [
            staffAvailabilityUnavailableDays.staffId,
            staffAvailabilityUnavailableDays.calendarDate,
          ],
          set: { createdAt: new Date() },
        });

      await this.audit.record(
        {
          staffId: session.staffId,
          staffAccountId: session.accountId,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.carerAvailabilityMarkedUnavailable,
          detail: {
            source: 'carer_portal',
            calendarDate,
            removedWindowCount: removed.length,
          },
        },
        tx,
      );
    });

    return this.getOnboardingState(session);
  }

  async clearUnavailable(
    session: StaffSessionPayload,
    dto: MarkStaffPortalUnavailableDto,
  ): Promise<StaffPortalAvailabilityOnboardingStateDto> {
    await this.loadActiveAccount(session);
    assertValidWeekStartDate(dto.weekStartDate);

    const account = await this.loadActiveAccount(session);
    const week1Start = account.availabilityOnboardingWeek1Start;
    if (!week1Start) {
      throw new BadRequestException('Establish your onboarding period before clearing unavailable days.');
    }
    if (!isAnchoredOnboardingWeekStart(week1Start, dto.weekStartDate)) {
      throw new BadRequestException('Date is outside your guided onboarding period.');
    }

    const calendarDate = calendarDateFromWeekDay(dto.weekStartDate, dto.dayOfWeek);

    await this.db.transaction(async (tx) => {
      await acquireCarerAvailabilityDayLock(
        tx,
        session.staffId,
        dto.weekStartDate,
        dto.dayOfWeek,
      );

      const deleted = await tx
        .delete(staffAvailabilityUnavailableDays)
        .where(
          and(
            eq(staffAvailabilityUnavailableDays.staffId, session.staffId),
            eq(staffAvailabilityUnavailableDays.calendarDate, calendarDate),
          ),
        )
        .returning();

      if (deleted.length > 0) {
        await this.audit.record(
          {
            staffId: session.staffId,
            staffAccountId: session.accountId,
            eventType: STAFF_PORTAL_AUDIT_EVENTS.carerAvailabilityUnavailableCleared,
            detail: { source: 'carer_portal', calendarDate },
          },
          tx,
        );
      }
    });

    return this.getOnboardingState(session);
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
      await acquireCarerAvailabilityDayLock(
        tx,
        session.staffId,
        dto.weekStartDate,
        dto.dayOfWeek,
      );

      await tx
        .delete(staffAvailabilityUnavailableDays)
        .where(
          and(
            eq(staffAvailabilityUnavailableDays.staffId, session.staffId),
            eq(staffAvailabilityUnavailableDays.calendarDate, calendarDate),
          ),
        );

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

      await acquireCarerAvailabilityDayLock(
        tx,
        session.staffId,
        owned.weekStartDate,
        owned.dayOfWeek,
      );

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

      await acquireCarerAvailabilityDayLock(
        tx,
        session.staffId,
        owned.weekStartDate,
        owned.dayOfWeek,
      );

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

  /** Marks the availability onboarding step complete. Does not finalize onboarding. */
  async completeOnboardingStep(
    session: StaffSessionPayload,
  ): Promise<StaffPortalOnboardingStatusDto> {
    return this.onboarding.completeAvailabilityStep(session);
  }

  /**
   * @deprecated Phase 4C.3B web will migrate to `POST complete-onboarding-step`.
   * Delegates to availability-step completion; no longer sets `onboardingCompletedAt`.
   */
  async completeStep3(session: StaffSessionPayload): Promise<StaffPortalOnboardingStatusDto> {
    return this.completeOnboardingStep(session);
  }

  private async assertOnboardingPrerequisites(session: StaffSessionPayload) {
    const account = await this.loadActiveAccount(session);
    if (!account.profileCompletedAt) {
      throw new BadRequestException('Complete your profile before starting availability onboarding.');
    }
    if (!account.documentsCompletedAt) {
      throw new BadRequestException('Complete your documents before starting availability onboarding.');
    }
  }

  private async buildOnboardingState(
    staffId: string,
    account: typeof staffAccounts.$inferSelect,
  ): Promise<StaffPortalAvailabilityOnboardingStateDto> {
    const week1Start = account.availabilityOnboardingWeek1Start;
    if (!week1Start) {
      return {
        anchorEstablished: false,
        week1Start: null,
        week2Start: null,
        days: [],
        week1Complete: false,
        week2Complete: false,
        canCompleteOnboarding: false,
      };
    }

    const week2Start = addDaysToDateString(week1Start, 7);
    const anchoredDays = buildAnchoredOnboardingDays(week1Start);
    const calendarDates = anchoredDays.map((d) => d.calendarDate);
    const today = torontoTodayDateString();

    const [windows, unavailableRows] = await Promise.all([
      this.db
        .select()
        .from(availability)
        .where(
          and(
            eq(availability.staffId, staffId),
            inArray(availability.weekStartDate, [week1Start, week2Start]),
          ),
        )
        .orderBy(asc(availability.weekStartDate), asc(availability.dayOfWeek), asc(availability.startTime)),
      this.db
        .select()
        .from(staffAvailabilityUnavailableDays)
        .where(
          and(
            eq(staffAvailabilityUnavailableDays.staffId, staffId),
            inArray(staffAvailabilityUnavailableDays.calendarDate, calendarDates),
          ),
        ),
    ]);

    const unavailableSet = new Set(unavailableRows.map((r) => r.calendarDate));
    const windowsByDate = new Map<string, Availability[]>();
    for (const day of anchoredDays) {
      windowsByDate.set(day.calendarDate, []);
    }
    for (const row of windows) {
      const date = calendarDateFromWeekDay(row.weekStartDate, row.dayOfWeek);
      const bucket = windowsByDate.get(date);
      if (bucket) bucket.push(row);
    }

    const days = anchoredDays.map((day) => {
      const dayWindows = windowsByDate.get(day.calendarDate) ?? [];
      const status = computeOnboardingDayStatus(
        day.calendarDate,
        today,
        dayWindows.length,
        unavailableSet.has(day.calendarDate),
      );
      return {
        calendarDate: day.calendarDate,
        weekIndex: day.weekIndex,
        dayOfWeek: day.dayOfWeek,
        status,
        windows: dayWindows.map((w) => this.toDto(w)),
      };
    });

    return {
      anchorEstablished: true,
      week1Start,
      week2Start,
      days,
      week1Complete: isOnboardingWeekComplete(days, 1),
      week2Complete: isOnboardingWeekComplete(days, 2),
      canCompleteOnboarding: canCompleteGuidedOnboarding(days),
    };
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

  private async loadAccountForUpdateTx(
    tx: Pick<Database, 'select'>,
    accountId: string,
    staffId: string,
  ) {
    const rows = await tx
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.id, accountId))
      .for('update');
    const account = rows[0];
    if (!account || account.status === 'disabled' || account.staffId !== staffId) {
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
}

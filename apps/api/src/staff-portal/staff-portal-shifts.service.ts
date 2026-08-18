import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import {
  torontoNowTimeString,
  torontoTodayDateString,
} from '../availability/availability-toronto.util';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, shifts, staffAccounts } from '../db/schema';
import { ShiftReminderService } from '../shifts/shift-reminder.service';
import { ShiftCancellationService } from '../shifts/shift-cancellation.service';
import {
  isCarerDirectCancellationEligible,
  type ShiftInternalStatus,
  type ShiftRowForCarer,
  toCarerShiftSummaryDto,
} from './carer-shift.util';
import {
  CARER_SHIFT_CANCELLATION_REASON_MAX_LENGTH,
  type CarerShiftSummaryDto,
  StaffPortalShiftPageSize,
  StaffPortalShiftsPageResponseDto,
  StaffPortalShiftsSummaryResponseDto,
} from './dto/staff-portal-shifts.dto';
import type { StaffSessionPayload } from './staff-session.service';

type ShiftQueryRow = {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role_needed: string;
  status: ShiftInternalStatus;
  centre_name: string;
  centre_address: string;
  centre_city: string;
};

@Injectable()
export class StaffPortalShiftsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly shiftReminders: ShiftReminderService,
    private readonly shiftCancellations: ShiftCancellationService,
  ) {}

  async listUpcoming(
    session: StaffSessionPayload,
    page: number,
    pageSize: StaffPortalShiftPageSize,
  ): Promise<StaffPortalShiftsPageResponseDto> {
    await this.loadOnboardedAccount(session);
    const today = torontoTodayDateString();
    const nowTime = torontoNowTimeString();
    return this.listScoped(session.staffId, 'upcoming', page, pageSize, today, nowTime);
  }

  async listHistory(
    session: StaffSessionPayload,
    page: number,
    pageSize: StaffPortalShiftPageSize,
  ): Promise<StaffPortalShiftsPageResponseDto> {
    await this.loadOnboardedAccount(session);
    const today = torontoTodayDateString();
    const nowTime = torontoNowTimeString();
    return this.listScoped(session.staffId, 'history', page, pageSize, today, nowTime);
  }

  async summary(
    session: StaffSessionPayload,
    limit: number,
  ): Promise<StaffPortalShiftsSummaryResponseDto> {
    await this.loadOnboardedAccount(session);
    const today = torontoTodayDateString();
    const nowTime = torontoNowTimeString();
    const rows = await this.fetchShiftRows(
      session.staffId,
      'upcoming',
      today,
      nowTime,
      limit,
      0,
    );
    return { items: this.mapRows(rows, today, nowTime) };
  }

  async getDetail(
    session: StaffSessionPayload,
    shiftId: string,
  ): Promise<CarerShiftSummaryDto> {
    await this.loadOnboardedAccount(session);

    const rows = await this.db
      .select({
        id: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        status: shifts.status,
        cancellationReason: shifts.cancellationReason,
        centreName: centres.name,
        centreAddress: centres.address,
        centreCity: centres.city,
      })
      .from(shifts)
      .innerJoin(centres, eq(centres.id, shifts.centreId))
      .where(and(eq(shifts.id, shiftId), eq(shifts.assignedStaffId, session.staffId)));

    const row = rows[0];
    if (!row) {
      throw new NotFoundException('Shift not found.');
    }

    const today = torontoTodayDateString();
    const nowTime = torontoNowTimeString();
    const dto = toCarerShiftSummaryDto(
      {
        id: row.id,
        shiftDate: row.shiftDate,
        startTime: row.startTime,
        endTime: row.endTime,
        roleNeeded: row.roleNeeded,
        status: row.status as ShiftInternalStatus,
        centreName: row.centreName,
        centreAddress: row.centreAddress,
        centreCity: row.centreCity,
      },
      today,
      nowTime,
    );

    if (!dto) {
      throw new NotFoundException('Shift not found.');
    }

    if (dto.status === 'cancelled' && row.cancellationReason.trim()) {
      dto.cancellationReason = row.cancellationReason.trim();
    }

    return dto;
  }

  async cancelShift(
    session: StaffSessionPayload,
    shiftId: string,
    reason: string,
  ): Promise<CarerShiftSummaryDto> {
    await this.loadOnboardedAccount(session);

    const trimmed = reason.trim();
    if (!trimmed) {
      throw new BadRequestException('Reason is required.');
    }
    if (trimmed.length > CARER_SHIFT_CANCELLATION_REASON_MAX_LENGTH) {
      throw new BadRequestException(
        `Reason must be at most ${CARER_SHIFT_CANCELLATION_REASON_MAX_LENGTH} characters.`,
      );
    }

    const today = torontoTodayDateString();
    const nowTime = torontoNowTimeString();

    let scheduledCancellationIds: string[] = [];

    const dto = await this.db.transaction(async (tx) => {
      const locked = await tx
        .select({
          id: shifts.id,
          centreId: shifts.centreId,
          shiftDate: shifts.shiftDate,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
          roleNeeded: shifts.roleNeeded,
          status: shifts.status,
          assignedStaffId: shifts.assignedStaffId,
          centreName: centres.name,
          centreAddress: centres.address,
          centreCity: centres.city,
        })
        .from(shifts)
        .innerJoin(centres, eq(centres.id, shifts.centreId))
        .where(eq(shifts.id, shiftId))
        .for('update');

      const shift = locked[0];
      if (!shift || shift.assignedStaffId !== session.staffId) {
        throw new NotFoundException('Shift not found.');
      }

      if (shift.status === 'cancelled') {
        throw new ConflictException('Shift is already cancelled.');
      }

      if (
        !isCarerDirectCancellationEligible(
          shift.status as ShiftInternalStatus,
          shift.shiftDate,
          shift.endTime,
          today,
          nowTime,
        )
      ) {
        throw new BadRequestException('This shift cannot be cancelled.');
      }

      const updated = await tx
        .update(shifts)
        .set({
          status: 'cancelled',
          cancellationReason: trimmed,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shifts.id, shiftId),
            eq(shifts.assignedStaffId, session.staffId),
            eq(shifts.status, 'filled'),
            sql`(
              ${shifts.shiftDate} > ${today}::date
              OR (${shifts.shiftDate} = ${today}::date AND ${shifts.endTime} > ${nowTime}::time)
            )`,
          ),
        )
        .returning({
          id: shifts.id,
          shiftDate: shifts.shiftDate,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
          roleNeeded: shifts.roleNeeded,
          status: shifts.status,
          cancellationReason: shifts.cancellationReason,
          updatedAt: shifts.updatedAt,
        });

      const row = updated[0];
      if (!row) {
        throw new BadRequestException('This shift cannot be cancelled.');
      }

      await this.shiftReminders.cancelPendingForShift(shiftId, tx);

      if (shift.assignedStaffId) {
        scheduledCancellationIds = await this.shiftCancellations.scheduleForAssignedCancellation(
          {
            shiftId,
            assignedStaffId: shift.assignedStaffId,
            centreId: shift.centreId,
            scheduledFor: row.updatedAt,
          },
          tx,
        );
      }

      const summary = toCarerShiftSummaryDto(
        {
          id: row.id,
          shiftDate: row.shiftDate,
          startTime: row.startTime,
          endTime: row.endTime,
          roleNeeded: row.roleNeeded,
          status: row.status as ShiftInternalStatus,
          centreName: shift.centreName,
          centreAddress: shift.centreAddress,
          centreCity: shift.centreCity,
        },
        today,
        nowTime,
      );

      if (!summary) {
        throw new BadRequestException('This shift cannot be cancelled.');
      }

      summary.cancellationReason = trimmed;
      return summary;
    });

    if (scheduledCancellationIds.length > 0) {
      await this.shiftCancellations.enqueueScheduledIds(scheduledCancellationIds);
    }

    return dto;
  }

  private async listScoped(
    staffId: string,
    scope: 'upcoming' | 'history',
    page: number,
    pageSize: number,
    today: string,
    nowTime: string,
  ): Promise<StaffPortalShiftsPageResponseDto> {
    const totalItems = await this.countShiftRows(staffId, scope, today, nowTime);
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    if (totalItems === 0 || page > totalPages) {
      return { items: [], page, pageSize, totalItems, totalPages };
    }

    const offset = (page - 1) * pageSize;
    const rows = await this.fetchShiftRows(staffId, scope, today, nowTime, pageSize, offset);

    return {
      items: this.mapRows(rows, today, nowTime),
      page,
      pageSize,
      totalItems,
      totalPages,
    };
  }

  private async countShiftRows(
    staffId: string,
    scope: 'upcoming' | 'history',
    today: string,
    nowTime: string,
  ): Promise<number> {
    const where = this.scopeWhereSql(staffId, scope, today, nowTime);
    const result = await this.db.execute(sql`
      SELECT COUNT(*)::int AS total_items
      FROM shifts s
      WHERE ${where}
    `);
    return Number(this.rowsFromExecute<{ total_items: number }>(result)[0]?.total_items ?? 0);
  }

  private async fetchShiftRows(
    staffId: string,
    scope: 'upcoming' | 'history',
    today: string,
    nowTime: string,
    limit: number,
    offset: number,
  ): Promise<ShiftRowForCarer[]> {
    const where = this.scopeWhereSql(staffId, scope, today, nowTime);
    const order =
      scope === 'upcoming'
        ? sql`s.shift_date ASC, s.start_time ASC`
        : sql`s.shift_date DESC, s.start_time DESC`;

    const result = await this.db.execute(sql`
      SELECT
        s.id,
        s.shift_date,
        s.start_time,
        s.end_time,
        s.role_needed,
        s.status,
        c.name AS centre_name,
        c.address AS centre_address,
        c.city AS centre_city
      FROM shifts s
      INNER JOIN centres c ON c.id = s.centre_id
      WHERE ${where}
      ORDER BY ${order}
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    return this.rowsFromExecute<ShiftQueryRow>(result).map((row) => ({
      id: row.id,
      shiftDate: row.shift_date,
      startTime: row.start_time,
      endTime: row.end_time,
      roleNeeded: row.role_needed,
      status: row.status,
      centreName: row.centre_name,
      centreAddress: row.centre_address,
      centreCity: row.centre_city,
    }));
  }

  private scopeWhereSql(
    staffId: string,
    scope: 'upcoming' | 'history',
    today: string,
    nowTime: string,
  ) {
    if (scope === 'upcoming') {
      return sql`
        s.assigned_staff_id = ${staffId}
        AND s.status <> 'pending'
        AND (
          (
            s.status = 'filled'
            AND (
              s.shift_date > ${today}::date
              OR (s.shift_date = ${today}::date AND s.end_time > ${nowTime}::time)
            )
          )
          OR (s.status = 'cancelled' AND s.shift_date >= ${today}::date)
        )
      `;
    }

    return sql`
      s.assigned_staff_id = ${staffId}
      AND s.status <> 'pending'
      AND (
        s.status = 'completed'
        OR (
          s.status = 'filled'
          AND (
            s.shift_date < ${today}::date
            OR (s.shift_date = ${today}::date AND s.end_time <= ${nowTime}::time)
          )
        )
        OR (s.status = 'cancelled' AND s.shift_date < ${today}::date)
      )
    `;
  }

  private mapRows(
    rows: ShiftRowForCarer[],
    today: string,
    nowTime: string,
  ): CarerShiftSummaryDto[] {
    const items: CarerShiftSummaryDto[] = [];
    for (const row of rows) {
      const dto = toCarerShiftSummaryDto(row, today, nowTime);
      if (dto) items.push(dto);
    }
    return items;
  }

  /**
   * Portal account gate for regular shift data.
   * Uses staff_accounts lifecycle (disabled + onboardingCompletedAt).
   * Does not interpret staff.status (active/inactive) — that remains Ops-side.
   */
  private async loadOnboardedAccount(session: StaffSessionPayload) {
    const account = (
      await this.db.select().from(staffAccounts).where(eq(staffAccounts.id, session.accountId))
    )[0];
    if (!account || account.status === 'disabled') {
      throw new UnauthorizedException('Not authenticated.');
    }
    if (account.staffId !== session.staffId) {
      throw new UnauthorizedException('Not authenticated.');
    }
    if (!account.onboardingCompletedAt) {
      throw new UnauthorizedException('Not authenticated.');
    }
    return account;
  }

  private rowsFromExecute<T>(result: unknown): T[] {
    if (result && typeof result === 'object' && 'rows' in result) {
      return (result as { rows: T[] }).rows;
    }
    return [];
  }
}

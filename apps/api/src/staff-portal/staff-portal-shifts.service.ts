import {
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
import { ShiftCancellationRequestsService } from '../shifts/shift-cancellation-requests.service';
import {
  type ShiftInternalStatus,
  type ShiftRowForCarer,
  toCarerShiftSummaryDto,
} from './carer-shift.util';
import type {
  CarerShiftSummaryDto,
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
    private readonly cancellationRequests: ShiftCancellationRequestsService,
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
    return { items: await this.attachCancellationSummaries(this.mapRows(rows, today, nowTime), session.staffId) };
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

    const pending = await this.cancellationRequests.getCarerRequest(shiftId, session.staffId);
    if (pending) {
      dto.cancellationRequest = {
        status: 'pending',
        requestedAt: pending.requestedAt,
        reason: pending.reason,
      };
    }

    return dto;
  }

  async createCancellationRequest(
    session: StaffSessionPayload,
    shiftId: string,
    reason: string,
  ) {
    await this.loadOnboardedAccount(session);
    return this.cancellationRequests.createCarerRequest({
      shiftId,
      staffId: session.staffId,
      staffAccountId: session.accountId,
      reason,
    });
  }

  async getCancellationRequest(session: StaffSessionPayload, shiftId: string) {
    await this.loadOnboardedAccount(session);

    const rows = await this.db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.id, shiftId), eq(shifts.assignedStaffId, session.staffId)));
    if (!rows[0]) {
      throw new NotFoundException('Shift not found.');
    }

    return this.cancellationRequests.getCarerRequest(shiftId, session.staffId);
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
      items: await this.attachCancellationSummaries(
        this.mapRows(rows, today, nowTime),
        staffId,
      ),
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

  private async attachCancellationSummaries(
    items: CarerShiftSummaryDto[],
    staffId: string,
  ): Promise<CarerShiftSummaryDto[]> {
    if (items.length === 0) return items;
    const pending = await this.cancellationRequests.getPendingSummaryByShiftIds(
      items.map((i) => i.id),
      staffId,
    );
    return items.map((item) => {
      const summary = pending.get(item.id);
      if (!summary) return item;
      return { ...item, cancellationRequest: summary };
    });
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

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  torontoNowTimeString,
  torontoTodayDateString,
} from '../availability/availability-toronto.util';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { shiftCancellationRequests, shifts, staff } from '../db/schema';
import { mapCarerShiftStatus, type ShiftInternalStatus } from '../staff-portal/carer-shift.util';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from '../staff-portal/staff-portal-audit.service';
import type {
  CarerCancellationRequestDto,
  CarerCancellationRequestSummaryDto,
  OpsCancellationRequestDto,
  PendingCancellationRequestListItemDto,
} from './dto/shift-cancellation-request.dto';

export const CANCELLATION_REQUEST_MAX_REASON_LENGTH = 1000;

export type CancellationRequestResolutionContext =
  | 'manual'
  | 'shift_cancelled'
  | 'shift_reassigned'
  | 'shift_unassigned'
  | 'shift_completed';

const RESOLUTION_NOTE_BY_CONTEXT: Record<CancellationRequestResolutionContext, string> = {
  manual: '',
  shift_cancelled: 'Shift cancelled by operations.',
  shift_reassigned: 'Shift reassigned to another staff member.',
  shift_unassigned: 'Staff unassigned from shift.',
  shift_completed: 'Shift marked completed.',
};

function trimReason(value: string): string {
  return value.trim();
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

@Injectable()
export class ShiftCancellationRequestsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly audit: StaffPortalAuditService,
  ) {}

  async createCarerRequest(params: {
    shiftId: string;
    staffId: string;
    staffAccountId: string;
    reason: string;
  }): Promise<CarerCancellationRequestDto> {
    const reason = trimReason(params.reason);
    if (!reason) {
      throw new BadRequestException('Reason is required.');
    }
    if (reason.length > CANCELLATION_REQUEST_MAX_REASON_LENGTH) {
      throw new BadRequestException(
        `Reason must be at most ${CANCELLATION_REQUEST_MAX_REASON_LENGTH} characters.`,
      );
    }

    return this.db.transaction(async (tx) => {
      const shiftRows = await tx
        .select({
          id: shifts.id,
          assignedStaffId: shifts.assignedStaffId,
          status: shifts.status,
          shiftDate: shifts.shiftDate,
          endTime: shifts.endTime,
        })
        .from(shifts)
        .where(eq(shifts.id, params.shiftId))
        .for('update');

      const shift = shiftRows[0];
      if (!shift || shift.assignedStaffId !== params.staffId) {
        throw new NotFoundException('Shift not found.');
      }

      this.assertCarerCancellationEligible(shift.status, shift.shiftDate, shift.endTime);

      const inserted = await tx.execute(sql`
        INSERT INTO shift_cancellation_requests (shift_id, staff_id, reason, status, requested_at)
        VALUES (${params.shiftId}, ${params.staffId}, ${reason}, 'pending', now())
        ON CONFLICT (shift_id, staff_id) WHERE (status = 'pending')
        DO NOTHING
        RETURNING id, shift_id, status, reason, requested_at
      `);

      const createdRow = this.firstRow<{
        id: string;
        shift_id: string;
        status: 'pending' | 'resolved';
        reason: string;
        requested_at: Date;
      }>(inserted);

      const row =
        createdRow ??
        (await this.fetchPendingRowForStaff(tx, params.shiftId, params.staffId));

      if (!row) {
        throw new BadRequestException('Cancellation cannot be requested for this shift.');
      }

      if (createdRow) {
        await this.audit.record(
          {
            staffId: params.staffId,
            staffAccountId: params.staffAccountId,
            eventType: STAFF_PORTAL_AUDIT_EVENTS.shiftCancellationRequested,
            detail: {
              shiftId: params.shiftId,
              requestId: createdRow.id,
            },
          },
          tx,
        );
      }

      return this.toCarerDto(row);
    });
  }

  async getCarerRequest(
    shiftId: string,
    staffId: string,
  ): Promise<CarerCancellationRequestDto | null> {
    const rows = await this.db
      .select({
        id: shiftCancellationRequests.id,
        shiftId: shiftCancellationRequests.shiftId,
        status: shiftCancellationRequests.status,
        reason: shiftCancellationRequests.reason,
        requestedAt: shiftCancellationRequests.requestedAt,
      })
      .from(shiftCancellationRequests)
      .where(
        and(
          eq(shiftCancellationRequests.shiftId, shiftId),
          eq(shiftCancellationRequests.staffId, staffId),
          eq(shiftCancellationRequests.status, 'pending'),
        ),
      )
      .orderBy(desc(shiftCancellationRequests.requestedAt))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      shiftId: row.shiftId,
      status: row.status,
      reason: row.reason,
      requestedAt: row.requestedAt.toISOString(),
    };
  }

  async getPendingSummaryByShiftIds(
    shiftIds: string[],
    staffId?: string,
  ): Promise<Map<string, CarerCancellationRequestSummaryDto>> {
    if (shiftIds.length === 0) return new Map();

    const conds = [
      inArray(shiftCancellationRequests.shiftId, shiftIds),
      eq(shiftCancellationRequests.status, 'pending'),
    ];
    if (staffId) {
      conds.push(eq(shiftCancellationRequests.staffId, staffId));
    }

    const rows = await this.db
      .select({
        shiftId: shiftCancellationRequests.shiftId,
        requestedAt: shiftCancellationRequests.requestedAt,
      })
      .from(shiftCancellationRequests)
      .where(and(...conds));

    const map = new Map<string, CarerCancellationRequestSummaryDto>();
    for (const row of rows) {
      map.set(row.shiftId, {
        status: 'pending',
        requestedAt: row.requestedAt.toISOString(),
      });
    }
    return map;
  }

  async getOpsPendingRequest(shiftId: string): Promise<OpsCancellationRequestDto | null> {
    const rows = await this.db
      .select({
        id: shiftCancellationRequests.id,
        shiftId: shiftCancellationRequests.shiftId,
        staffId: shiftCancellationRequests.staffId,
        status: shiftCancellationRequests.status,
        reason: shiftCancellationRequests.reason,
        requestedAt: shiftCancellationRequests.requestedAt,
        resolvedAt: shiftCancellationRequests.resolvedAt,
        resolvedByUserId: shiftCancellationRequests.resolvedByUserId,
        resolutionNote: shiftCancellationRequests.resolutionNote,
        staffLegalName: staff.legalName,
        staffDisplayName: staff.displayName,
        staffUseDisplayName: staff.useDisplayName,
      })
      .from(shiftCancellationRequests)
      .innerJoin(staff, eq(staff.id, shiftCancellationRequests.staffId))
      .where(
        and(
          eq(shiftCancellationRequests.shiftId, shiftId),
          eq(shiftCancellationRequests.status, 'pending'),
        ),
      )
      .orderBy(desc(shiftCancellationRequests.requestedAt))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return this.toOpsDto(row);
  }

  async listPending(
    page: number,
    pageSize: number,
  ): Promise<{ items: PendingCancellationRequestListItemDto[]; totalItems: number }> {
    const countResult = await this.db.execute(sql`
      SELECT COUNT(*)::int AS total_items
      FROM shift_cancellation_requests r
      WHERE r.status = 'pending'
    `);
    const totalItems = Number(this.firstRow<{ total_items: number }>(countResult)?.total_items ?? 0);
    if (totalItems === 0) {
      return { items: [], totalItems: 0 };
    }

    const offset = (page - 1) * pageSize;
    const result = await this.db.execute(sql`
      SELECT
        r.id AS request_id,
        r.shift_id,
        s.shift_date,
        s.start_time,
        s.end_time,
        c.name AS centre_name,
        st.legal_name AS staff_legal_name,
        st.display_name AS staff_display_name,
        st.use_display_name AS staff_use_display_name,
        r.reason,
        r.requested_at
      FROM shift_cancellation_requests r
      INNER JOIN shifts s ON s.id = r.shift_id
      INNER JOIN centres c ON c.id = s.centre_id
      INNER JOIN staff st ON st.id = r.staff_id
      WHERE r.status = 'pending'
      ORDER BY r.requested_at ASC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `);

    const items = this.rowsFromExecute<{
      request_id: string;
      shift_id: string;
      shift_date: string;
      start_time: string;
      end_time: string;
      centre_name: string;
      staff_legal_name: string;
      staff_display_name: string;
      staff_use_display_name: boolean;
      reason: string;
      requested_at: Date;
    }>(result).map((row) => ({
      requestId: row.request_id,
      shiftId: row.shift_id,
      shiftDate: row.shift_date,
      startTime: row.start_time,
      endTime: row.end_time,
      centreName: row.centre_name,
      staffLegalName: row.staff_legal_name,
      staffDisplayName: row.staff_display_name,
      staffUseDisplayName: row.staff_use_display_name,
      reason: row.reason,
      requestedAt: row.requested_at.toISOString(),
    }));

    return { items, totalItems };
  }

  async getPendingShiftIdSet(shiftIds: string[]): Promise<Set<string>> {
    if (shiftIds.length === 0) return new Set();
    const rows = await this.db
      .select({ shiftId: shiftCancellationRequests.shiftId })
      .from(shiftCancellationRequests)
      .where(
        and(
          inArray(shiftCancellationRequests.shiftId, shiftIds),
          eq(shiftCancellationRequests.status, 'pending'),
        ),
      );
    return new Set(rows.map((r) => r.shiftId));
  }

  async resolvePendingManually(
    shiftId: string,
    actorUserId: string,
    resolutionNote?: string,
  ): Promise<OpsCancellationRequestDto> {
    const note = resolutionNote?.trim() ?? '';
    const resolved = await this.resolvePendingForShift({
      shiftId,
      context: 'manual',
      resolvedByUserId: actorUserId,
      resolutionNote: note,
    });
    if (!resolved) {
      throw new NotFoundException('No pending cancellation request for this shift.');
    }
    return resolved;
  }

  async resolvePendingForShift(params: {
    shiftId: string;
    staffId?: string;
    context: CancellationRequestResolutionContext;
    resolvedByUserId?: string | null;
    resolutionNote?: string;
  }): Promise<OpsCancellationRequestDto | null> {
    const defaultNote = RESOLUTION_NOTE_BY_CONTEXT[params.context];
    const note = params.resolutionNote?.trim() ?? defaultNote;

    return this.db.transaction(async (tx) => {
      const conds = [
        eq(shiftCancellationRequests.shiftId, params.shiftId),
        eq(shiftCancellationRequests.status, 'pending'),
      ];
      if (params.staffId) {
        conds.push(eq(shiftCancellationRequests.staffId, params.staffId));
      }

      const pendingRows = await tx
        .select({
          id: shiftCancellationRequests.id,
          shiftId: shiftCancellationRequests.shiftId,
          staffId: shiftCancellationRequests.staffId,
          status: shiftCancellationRequests.status,
          reason: shiftCancellationRequests.reason,
          requestedAt: shiftCancellationRequests.requestedAt,
          resolvedAt: shiftCancellationRequests.resolvedAt,
          resolvedByUserId: shiftCancellationRequests.resolvedByUserId,
          resolutionNote: shiftCancellationRequests.resolutionNote,
          staffLegalName: staff.legalName,
          staffDisplayName: staff.displayName,
          staffUseDisplayName: staff.useDisplayName,
        })
        .from(shiftCancellationRequests)
        .innerJoin(staff, eq(staff.id, shiftCancellationRequests.staffId))
        .where(and(...conds))
        .for('update');

      const pending = pendingRows[0];
      if (!pending) return null;

      const now = new Date();
      await tx
        .update(shiftCancellationRequests)
        .set({
          status: 'resolved',
          resolvedAt: now,
          resolvedByUserId: params.resolvedByUserId ?? null,
          resolutionNote: note,
          updatedAt: now,
        })
        .where(eq(shiftCancellationRequests.id, pending.id));

      await this.audit.record(
        {
          staffId: pending.staffId,
          actorUserId: params.resolvedByUserId ?? null,
          eventType: STAFF_PORTAL_AUDIT_EVENTS.shiftCancellationRequestResolved,
          detail: {
            shiftId: params.shiftId,
            requestId: pending.id,
            resolutionContext: params.context,
          },
        },
        tx,
      );

      return this.toOpsDto({
        ...pending,
        status: 'resolved',
        resolvedAt: now,
        resolvedByUserId: params.resolvedByUserId ?? null,
        resolutionNote: note,
      });
    });
  }

  assertCarerCancellationEligible(
    internalStatus: string,
    shiftDate: string,
    endTime: string,
  ): void {
    if (internalStatus !== 'filled') {
      throw new BadRequestException('Cancellation cannot be requested for this shift.');
    }

    const today = torontoTodayDateString();
    const nowTime = torontoNowTimeString();
    const carerStatus = mapCarerShiftStatus(
      internalStatus as ShiftInternalStatus,
      shiftDate,
      endTime,
      today,
      nowTime,
    );

    if (carerStatus !== 'upcoming' && carerStatus !== 'today') {
      throw new BadRequestException('Cancellation cannot be requested for this shift.');
    }
  }

  private async fetchPendingRowForStaff(
    tx: Pick<Database, 'select'>,
    shiftId: string,
    staffId: string,
  ) {
    const rows = await tx
      .select({
        id: shiftCancellationRequests.id,
        shift_id: shiftCancellationRequests.shiftId,
        status: shiftCancellationRequests.status,
        reason: shiftCancellationRequests.reason,
        requested_at: shiftCancellationRequests.requestedAt,
      })
      .from(shiftCancellationRequests)
      .where(
        and(
          eq(shiftCancellationRequests.shiftId, shiftId),
          eq(shiftCancellationRequests.staffId, staffId),
          eq(shiftCancellationRequests.status, 'pending'),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  private toCarerDto(row: {
    id: string;
    shift_id?: string;
    shiftId?: string;
    status: 'pending' | 'resolved';
    reason: string;
    requested_at?: Date;
    requestedAt?: Date;
  }): CarerCancellationRequestDto {
    const requestedAt = row.requested_at ?? row.requestedAt;
    return {
      id: row.id,
      shiftId: row.shift_id ?? row.shiftId ?? '',
      status: row.status,
      reason: row.reason,
      requestedAt: requestedAt instanceof Date ? requestedAt.toISOString() : String(requestedAt),
    };
  }

  private toOpsDto(row: {
    id: string;
    shiftId: string;
    staffId: string;
    status: 'pending' | 'resolved';
    reason: string;
    requestedAt: Date;
    resolvedAt: Date | null;
    resolvedByUserId: string | null;
    resolutionNote: string;
    staffLegalName: string;
    staffDisplayName: string;
    staffUseDisplayName: boolean;
  }): OpsCancellationRequestDto {
    return {
      id: row.id,
      shiftId: row.shiftId,
      staffId: row.staffId,
      staffLegalName: row.staffLegalName,
      staffDisplayName: row.staffDisplayName,
      staffUseDisplayName: row.staffUseDisplayName,
      status: row.status,
      reason: row.reason,
      requestedAt: row.requestedAt.toISOString(),
      resolvedAt: toIso(row.resolvedAt),
      resolvedByUserId: row.resolvedByUserId,
      resolutionNote: row.resolutionNote,
    };
  }

  private firstRow<T>(result: unknown): T | undefined {
    return this.rowsFromExecute<T>(result)[0];
  }

  private rowsFromExecute<T>(result: unknown): T[] {
    if (result && typeof result === 'object' && 'rows' in result) {
      return (result as { rows: T[] }).rows;
    }
    return [];
  }
}

import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, shifts, staff, users } from '../db/schema';
import type { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import { presentActivityLogItem } from './activity-log-presenter.util';
import { EXCLUDED_PORTAL_AUDIT_EVENT_TYPES } from './activity-log-portal-map.util';
import { resolveActivityLogDateRange } from './report-date.util';
import {
  buildPaginatedReportResponse,
  parseActivityLogPagination,
} from './activity-log-pagination.util';
import { torontoDateEndExclusiveInstant, torontoDateStartInstant } from './report-timezone.util';
import type { ActivityLogItem, ActivityLogRawRow, ActivityLogResponse } from './types/activity-log.types';

/** Safety cap for Activity Log CSV exports — prevents unbounded memory use. */
export const ACTIVITY_LOG_EXPORT_MAX_ROWS = 50_000;

const EXCLUDED_PORTAL_LIST = [...EXCLUDED_PORTAL_AUDIT_EVENT_TYPES]
  .map((value) => `'${value}'`)
  .join(', ');

@Injectable()
export class ReportsActivityService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getActivityLog(query: ActivityLogQueryDto): Promise<ActivityLogResponse> {
    const { dateFrom, dateTo } = resolveActivityLogDateRange(query.dateFrom, query.dateTo);
    const { page, pageSize, offset } = parseActivityLogPagination({
      page: query.page,
      pageSize: query.pageSize,
    });

    const { filterClauses, activityUnion } = this.buildActivityQueryParts(dateFrom, dateTo, query);

    const countResult = await this.db.execute(sql`
      WITH activity AS (${activityUnion})
      SELECT COUNT(*)::int AS total FROM activity
      ${this.buildActivityWhereSql(filterClauses)}
    `);
    const totalCount = Number((countResult.rows[0] as { total?: number })?.total ?? 0);

    const pageResult = await this.db.execute(sql`
      WITH activity AS (${activityUnion})
      SELECT * FROM activity
      ${this.buildActivityWhereSql(filterClauses)}
      ORDER BY occurred_at DESC, source_key DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const rawRows = pageResult.rows as unknown as ActivityLogRawRow[];
    const names = await this.loadDisplayNames(rawRows);
    const items = rawRows.map((row) => presentActivityLogItem(row, names));

    return {
      dateFrom,
      dateTo,
      category: query.category ?? null,
      actorType: query.actorType ?? null,
      staffId: query.staffId ?? null,
      centreId: query.centreId ?? null,
      shiftId: query.shiftId ?? null,
      opsUserId: query.opsUserId ?? null,
      ...buildPaginatedReportResponse(items, page, pageSize, totalCount),
    };
  }

  async getActivityLogExportItems(query: ActivityLogQueryDto): Promise<{
    dateFrom: string;
    dateTo: string;
    items: ActivityLogItem[];
  }> {
    const { dateFrom, dateTo } = resolveActivityLogDateRange(query.dateFrom, query.dateTo);
    const { filterClauses, activityUnion } = this.buildActivityQueryParts(dateFrom, dateTo, query);

    const countResult = await this.db.execute(sql`
      WITH activity AS (${activityUnion})
      SELECT COUNT(*)::int AS total FROM activity
      ${this.buildActivityWhereSql(filterClauses)}
    `);
    const totalCount = Number((countResult.rows[0] as { total?: number })?.total ?? 0);

    if (totalCount > ACTIVITY_LOG_EXPORT_MAX_ROWS) {
      throw new BadRequestException(
        `This Activity Log export matches ${totalCount.toLocaleString()} events, which exceeds the ${ACTIVITY_LOG_EXPORT_MAX_ROWS.toLocaleString()} row export limit. Narrow your filters and try again.`,
      );
    }

    const exportResult = await this.db.execute(sql`
      WITH activity AS (${activityUnion})
      SELECT * FROM activity
      ${this.buildActivityWhereSql(filterClauses)}
      ORDER BY occurred_at DESC, source_key DESC
    `);

    const rawRows = exportResult.rows as unknown as ActivityLogRawRow[];
    const names = await this.loadDisplayNames(rawRows);
    const items = rawRows.map((row) => presentActivityLogItem(row, names));

    return { dateFrom, dateTo, items };
  }

  private buildActivityWhereSql(filterClauses: ReturnType<typeof sql>[]) {
    return filterClauses.length > 0
      ? sql`WHERE ${sql.join(filterClauses, sql` AND `)}`
      : sql``;
  }

  private buildActivityQueryParts(
    dateFrom: string,
    dateTo: string,
    query: ActivityLogQueryDto,
  ) {
    const fromInstant = torontoDateStartInstant(dateFrom);
    const toExclusive = torontoDateEndExclusiveInstant(dateTo);

    const filterClauses: ReturnType<typeof sql>[] = [];
    if (query.category) {
      filterClauses.push(sql`category = ${query.category}`);
    }
    if (query.actorType) {
      filterClauses.push(sql`actor_type = ${query.actorType}`);
    }
    if (query.staffId) {
      filterClauses.push(sql`staff_id = ${query.staffId}`);
    }
    if (query.centreId) {
      filterClauses.push(sql`centre_id = ${query.centreId}`);
    }
    if (query.shiftId) {
      filterClauses.push(sql`shift_id = ${query.shiftId}`);
    }
    if (query.opsUserId) {
      filterClauses.push(sql`actor_user_id = ${query.opsUserId}`);
    }

    const activityUnion = this.buildActivityUnionSql(fromInstant, toExclusive);
    return { filterClauses, activityUnion };
  }

  private buildActivityUnionSql(fromInstant: Date, toExclusive: Date) {
    return sql`
        SELECT
          ('platform:' || p.id::text) AS source_key,
          p.occurred_at,
          CASE
            WHEN p.action IN ('shift_update_communication_sent', 'shift_update_communication_failed') THEN 'communications'
            WHEN p.action IN ('batch_progress_email_scheduled', 'batch_progress_email_blocked') THEN 'communications'
            WHEN p.action IN ('batch_request_completed', 'batch_final_confirmation_scheduled') THEN 'communications'
            WHEN p.action LIKE 'shift_%' THEN 'shifts'
            WHEN p.action LIKE 'centre_%' THEN 'centres'
            WHEN p.action LIKE 'user_%' THEN 'users'
            WHEN p.action LIKE 'staff_%' THEN 'staff'
            ELSE 'system'
          END AS category,
          p.action,
          p.actor_type,
          p.actor_user_id,
          p.staff_id,
          p.centre_id,
          p.shift_id,
          p.target_user_id,
          p.metadata
        FROM platform_audit_events p
        WHERE p.occurred_at >= ${fromInstant} AND p.occurred_at < ${toExclusive}

        UNION ALL

        SELECT
          ('portal:' || e.id::text) AS source_key,
          e.created_at AS occurred_at,
          CASE
            WHEN e.event_type LIKE 'carer_document_%' OR e.event_type LIKE 'ops_document_%' THEN 'documents'
            WHEN e.event_type IN ('shift_cancellation_requested', 'shift_cancellation_request_resolved') THEN 'shifts'
            ELSE 'staff'
          END AS category,
          'staff_portal_event' AS action,
          CASE
            WHEN e.actor_user_id IS NOT NULL THEN 'ops_user'
            WHEN e.staff_account_id IS NOT NULL THEN 'staff'
            ELSE 'unknown'
          END AS actor_type,
          e.actor_user_id,
          e.staff_id,
          NULL::uuid AS centre_id,
          NULL::uuid AS shift_id,
          NULL::uuid AS target_user_id,
          jsonb_build_object('eventType', e.event_type) || e.detail AS metadata
        FROM staff_portal_audit_events e
        WHERE e.created_at >= ${fromInstant}
          AND e.created_at < ${toExclusive}
          AND e.event_type NOT IN (${sql.raw(EXCLUDED_PORTAL_LIST)})

        UNION ALL

        SELECT
          ('assign_notify:' || n.id::text) AS source_key,
          COALESCE(n.sent_at, n.created_at) AS occurred_at,
          'communications' AS category,
          CASE n.status
            WHEN 'sent' THEN 'assignment_confirmation_sent'
            ELSE 'assignment_confirmation_failed'
          END AS action,
          CASE WHEN n.actor_user_id IS NOT NULL THEN 'ops_user' ELSE 'unknown' END AS actor_type,
          n.actor_user_id,
          n.assigned_staff_id AS staff_id,
          s.centre_id,
          n.shift_id,
          NULL::uuid AS target_user_id,
          jsonb_build_object('recipientType', n.recipient_type, 'trigger', n.trigger) AS metadata
        FROM shift_assignment_notifications n
        LEFT JOIN shifts s ON s.id = n.shift_id
        WHERE COALESCE(n.sent_at, n.created_at) >= ${fromInstant}
          AND COALESCE(n.sent_at, n.created_at) < ${toExclusive}
          AND n.status IN ('sent', 'failed')

        UNION ALL

        SELECT
          ('comm_delivery:' || d.id::text) AS source_key,
          COALESCE(d.sent_at, d.attempted_at) AS occurred_at,
          'communications' AS category,
          CASE d.status
            WHEN 'sent' THEN 'communication_sent'
            ELSE 'communication_failed'
          END AS action,
          'system' AS actor_type,
          NULL::uuid AS actor_user_id,
          CASE
            WHEN sc.entity_type = 'shift' THEN s.assigned_staff_id
            WHEN sc.entity_type = 'staff_document' THEN ds.staff_id
            WHEN sc.entity_type = 'staff_account' THEN sa.staff_id
            ELSE NULL
          END AS staff_id,
          CASE
            WHEN sc.entity_type = 'shift' THEN s.centre_id
            WHEN sc.entity_type = 'shift_batch' THEN sb.centre_id
            ELSE NULL
          END AS centre_id,
          CASE WHEN sc.entity_type = 'shift' THEN sc.entity_id ELSE NULL END AS shift_id,
          NULL::uuid AS target_user_id,
          jsonb_build_object('communicationType', sc.communication_type) AS metadata
        FROM communication_deliveries d
        INNER JOIN scheduled_communications sc ON sc.id = d.scheduled_communication_id
        LEFT JOIN shifts s ON sc.entity_type = 'shift' AND sc.entity_id = s.id
        LEFT JOIN shift_batches sb ON sc.entity_type = 'shift_batch' AND sc.entity_id = sb.id
        LEFT JOIN staff_document_submissions sub ON sc.entity_type = 'staff_document' AND sc.entity_id = sub.id
        LEFT JOIN staff_document_sets ds ON sub.document_set_id = ds.id
        LEFT JOIN staff_accounts sa ON sc.entity_type = 'staff_account' AND sc.entity_id = sa.id
        WHERE COALESCE(d.sent_at, d.attempted_at) >= ${fromInstant}
          AND COALESCE(d.sent_at, d.attempted_at) < ${toExclusive}
          AND d.status IN ('sent', 'failed')
          AND sc.communication_type NOT LIKE 'test_%'

        UNION ALL

        SELECT
          ('legacy_shift:' || s.id::text) AS source_key,
          s.created_at AS occurred_at,
          'shifts' AS category,
          'shift_record_created' AS action,
          'unknown' AS actor_type,
          NULL::uuid AS actor_user_id,
          s.assigned_staff_id AS staff_id,
          s.centre_id,
          s.id AS shift_id,
          NULL::uuid AS target_user_id,
          jsonb_build_object('shiftDate', s.shift_date::text) AS metadata
        FROM shifts s
        WHERE s.created_at >= ${fromInstant}
          AND s.created_at < ${toExclusive}
          AND NOT EXISTS (
            SELECT 1 FROM platform_audit_events p
            WHERE p.shift_id = s.id AND p.action = 'shift_created'
          )
    `;
  }

  async loadDisplayNamesForRows(rows: ActivityLogRawRow[]) {
    return this.loadDisplayNames(rows);
  }

  private async loadDisplayNames(rows: ActivityLogRawRow[]) {
    const staffIds = [...new Set(rows.map((row) => row.staff_id).filter(Boolean))] as string[];
    const centreIds = [...new Set(rows.map((row) => row.centre_id).filter(Boolean))] as string[];
    const userIds = [...new Set(rows.map((row) => row.actor_user_id).filter(Boolean))] as string[];
    const shiftIds = [...new Set(rows.map((row) => row.shift_id).filter(Boolean))] as string[];

    const [staffRows, centreRows, userRows, shiftRows] = await Promise.all([
      staffIds.length
        ? this.db
            .select({
              id: staff.id,
              legalName: staff.legalName,
              displayName: staff.displayName,
              useDisplayName: staff.useDisplayName,
            })
            .from(staff)
            .where(inArray(staff.id, staffIds))
        : Promise.resolve([]),
      centreIds.length
        ? this.db.select({ id: centres.id, name: centres.name }).from(centres).where(inArray(centres.id, centreIds))
        : Promise.resolve([]),
      userIds.length
        ? this.db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, userIds))
        : Promise.resolve([]),
      shiftIds.length
        ? this.db
            .select({ id: shifts.id, shiftDate: shifts.shiftDate })
            .from(shifts)
            .where(inArray(shifts.id, shiftIds))
        : Promise.resolve([]),
    ]);

    return {
      staff: new Map(staffRows.map((row) => [row.id, row])),
      centres: new Map(centreRows.map((row) => [row.id, row.name])),
      users: new Map(userRows.map((row) => [row.id, row.fullName])),
      shifts: new Map(shiftRows.map((row) => [row.id, String(row.shiftDate)])),
    };
  }
}

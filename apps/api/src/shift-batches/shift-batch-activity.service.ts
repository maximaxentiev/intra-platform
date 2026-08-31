import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { shiftBatches } from '../db/schema';
import { presentActivityLogItem } from '../reports/activity-log-presenter.util';
import { buildPaginatedReportResponse } from '../reports/activity-log-pagination.util';
import type { ActivityLogItem, ActivityLogRawRow } from '../reports/types/activity-log.types';
import { ReportsActivityService } from '../reports/reports-activity.service';

const BATCH_ACTIVITY_PAGE_SIZE = 10;

export type BatchActivityResponse = {
  batchId: string;
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  items: ActivityLogItem[];
};

@Injectable()
export class ShiftBatchActivityService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reportsActivity: ReportsActivityService,
  ) {}

  async getBatchActivity(
    batchId: string,
    page = 1,
    pageSize = BATCH_ACTIVITY_PAGE_SIZE,
  ): Promise<BatchActivityResponse> {
    const batchRows = await this.db
      .select({ id: shiftBatches.id, createdAt: shiftBatches.createdAt, centreId: shiftBatches.centreId })
      .from(shiftBatches)
      .where(eq(shiftBatches.id, batchId))
      .limit(1);

    const batch = batchRows[0];
    if (!batch) throw new NotFoundException('Batch not found.');

    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(1, pageSize), 25);
    const offset = (safePage - 1) * safePageSize;

    const activityUnion = this.buildBatchActivityUnionSql(batchId);

    const countResult = await this.db.execute(sql`
      WITH activity AS (${activityUnion})
      SELECT COUNT(*)::int AS total FROM activity
    `);
    const totalCount = Number((countResult.rows[0] as { total?: number })?.total ?? 0);

    const pageResult = await this.db.execute(sql`
      WITH activity AS (${activityUnion})
      SELECT * FROM activity
      ORDER BY occurred_at DESC, source_key DESC
      LIMIT ${safePageSize} OFFSET ${offset}
    `);

    const rawRows = pageResult.rows as unknown as ActivityLogRawRow[];
    const names = await this.reportsActivity.loadDisplayNamesForRows(rawRows);
    const items = rawRows.map((row) => presentActivityLogItem(row, names));

    return {
      batchId,
      ...buildPaginatedReportResponse(items, safePage, safePageSize, totalCount),
    };
  }

  private buildBatchActivityUnionSql(batchId: string) {
    return sql`
      SELECT
        ('batch_created:' || b.id::text) AS source_key,
        b.created_at AS occurred_at,
        'shifts' AS category,
        'batch_request_created' AS action,
        'unknown' AS actor_type,
        NULL::uuid AS actor_user_id,
        NULL::uuid AS staff_id,
        b.centre_id,
        NULL::uuid AS shift_id,
        NULL::uuid AS target_user_id,
        jsonb_build_object('batchId', b.id::text) AS metadata
      FROM shift_batches b
      WHERE b.id = ${batchId}::uuid

      UNION ALL

      SELECT
        ('platform:' || p.id::text) AS source_key,
        p.occurred_at,
        CASE
          WHEN p.action IN ('batch_progress_email_scheduled', 'batch_progress_email_blocked', 'batch_request_completed', 'batch_final_confirmation_scheduled') THEN 'communications'
          ELSE 'shifts'
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
      WHERE p.metadata->>'batchId' = ${batchId}

      UNION ALL

      SELECT
        ('comm_delivery:' || d.id::text) AS source_key,
        COALESCE(d.sent_at, d.attempted_at) AS occurred_at,
        'communications' AS category,
        CASE d.status
          WHEN 'sent' THEN 'communication_sent'
          WHEN 'skipped' THEN 'communication_skipped'
          ELSE 'communication_failed'
        END AS action,
        'system' AS actor_type,
        NULL::uuid AS actor_user_id,
        NULL::uuid AS staff_id,
        sb.centre_id,
        NULL::uuid AS shift_id,
        NULL::uuid AS target_user_id,
        jsonb_build_object(
          'communicationType', sc.communication_type,
          'skipCode', sc.last_error_code,
          'skipReason', sc.last_error_reason
        ) AS metadata
      FROM communication_deliveries d
      INNER JOIN scheduled_communications sc ON sc.id = d.scheduled_communication_id
      INNER JOIN shift_batches sb ON sc.entity_type = 'shift_batch' AND sc.entity_id = sb.id
      WHERE sb.id = ${batchId}::uuid
        AND d.status IN ('sent', 'failed', 'skipped')
        AND sc.communication_type IN ('batch_progress_70', 'batch_confirmation_final')

      UNION ALL

      SELECT
        ('comm_cancelled:' || sc.id::text) AS source_key,
        COALESCE(sc.cancelled_at, sc.updated_at) AS occurred_at,
        'communications' AS category,
        'communication_cancelled' AS action,
        'system' AS actor_type,
        NULL::uuid AS actor_user_id,
        NULL::uuid AS staff_id,
        sb.centre_id,
        NULL::uuid AS shift_id,
        NULL::uuid AS target_user_id,
        jsonb_build_object(
          'communicationType', sc.communication_type,
          'skipCode', sc.last_error_code,
          'skipReason', sc.last_error_reason
        ) AS metadata
      FROM scheduled_communications sc
      INNER JOIN shift_batches sb ON sc.entity_type = 'shift_batch' AND sc.entity_id = sb.id
      WHERE sb.id = ${batchId}::uuid
        AND sc.status = 'cancelled'
        AND sc.communication_type IN ('batch_progress_70', 'batch_confirmation_final')
    `;
  }
}

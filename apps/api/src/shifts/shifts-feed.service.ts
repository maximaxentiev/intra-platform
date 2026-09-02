import { Inject, Injectable } from '@nestjs/common';
import { aliasedTable, and, eq, gte, inArray, isNotNull, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import { centres, shiftBatches, shifts, staff } from '../db/schema';
import { resolveCentreUsageCentreIds } from '../reports/dto/report-centre-ids.util';
import type { ShiftFeedQuery, ShiftFeedResponseDto } from './dto/shifts-feed.dto';
import { normalizeShiftFeedQuery } from './dto/shifts-feed.dto';
import {
  childMatchesFeedFilters,
  compareFeedItems,
  computeBatchFeedProgress,
  deriveBatchFeedDisplayState,
  formatBatchFeedDateRange,
  hasShiftFeedLevelFilters,
  sortFeedChildren,
  type ShiftFeedChildSummary,
} from './shifts-feed.util';

const assignee = aliasedTable(staff, 'assignee');

type FeedKey = {
  type: 'shift' | 'batch';
  id: string;
  sortDate: string;
  sortTime: string;
  createdAt: Date;
};

@Injectable()
export class ShiftsFeedService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async feed(rawQuery: ShiftFeedQuery): Promise<ShiftFeedResponseDto> {
    const q = normalizeShiftFeedQuery(rawQuery);
    const shiftConds = this.buildShiftMatchConditions(q);
    const batchCentreConds = this.buildBatchCentreConditions(q);
    const hasShiftLevelFilters = hasShiftFeedLevelFilters(q);

    const individuals = await this.db
      .select({
        id: shifts.id,
        sortDate: shifts.shiftDate,
        sortTime: shifts.startTime,
        createdAt: shifts.createdAt,
      })
      .from(shifts)
      .where(and(isNull(shifts.batchId), ...shiftConds));

    const batchRows = await this.db
      .select({
        id: shiftBatches.id,
        createdAt: shiftBatches.createdAt,
      })
      .from(shiftBatches)
      .where(batchCentreConds.length ? and(...batchCentreConds) : undefined);

    const batchSortRows =
      batchRows.length > 0
        ? await this.db
            .select({
              batchId: shifts.batchId,
              sortDate: sql<string | null>`min(${shifts.shiftDate})`.as('sort_date'),
              sortTime: sql<string | null>`min(${shifts.startTime})`.as('sort_time'),
            })
            .from(shifts)
            .where(
              inArray(
                shifts.batchId,
                batchRows.map((row) => row.id),
              ),
            )
            .groupBy(shifts.batchId)
        : [];

    const sortByBatchId = new Map(
      batchSortRows.map((row) => [
        row.batchId!,
        { sortDate: row.sortDate ?? '0000-01-01', sortTime: row.sortTime ?? '00:00:00' },
      ]),
    );

    let eligibleBatchIds = new Set(batchRows.map((row) => row.id));
    if (hasShiftLevelFilters) {
      const matching = await this.db
        .selectDistinct({ batchId: shifts.batchId })
        .from(shifts)
        .where(and(isNotNull(shifts.batchId), ...shiftConds));
      eligibleBatchIds = new Set(
        matching.map((row) => row.batchId).filter((id): id is string => Boolean(id)),
      );
    }

    const feedKeys: FeedKey[] = [
      ...individuals.map((row) => ({
        type: 'shift' as const,
        id: row.id,
        sortDate: String(row.sortDate),
        sortTime: String(row.sortTime),
        createdAt: row.createdAt,
      })),
      ...batchRows
        .filter((row) => eligibleBatchIds.has(row.id))
        .map((row) => {
          const sort = sortByBatchId.get(row.id) ?? {
            sortDate: '0000-01-01',
            sortTime: '00:00:00',
          };
          return {
            type: 'batch' as const,
            id: row.id,
            sortDate: sort.sortDate,
            sortTime: sort.sortTime,
            createdAt: row.createdAt,
          };
        }),
    ];

    feedKeys.sort(compareFeedItems);

    const totalItems = feedKeys.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / q.pageSize);
    const offset = (q.page - 1) * q.pageSize;
    const pageKeys = feedKeys.slice(offset, offset + q.pageSize);

    const shiftIds = pageKeys.filter((key) => key.type === 'shift').map((key) => key.id);
    const batchIds = pageKeys.filter((key) => key.type === 'batch').map((key) => key.id);

    const [shiftRows, batchMetaRows, batchChildRows] = await Promise.all([
      shiftIds.length
        ? this.db
            .select({
              id: shifts.id,
              centreId: shifts.centreId,
              shiftDate: shifts.shiftDate,
              startTime: shifts.startTime,
              endTime: shifts.endTime,
              roleNeeded: shifts.roleNeeded,
              addedToStaffpoint: shifts.addedToStaffpoint,
              status: shifts.status,
              assignedStaffId: shifts.assignedStaffId,
              centreName: centres.name,
              assignedLegalName: assignee.legalName,
              assignedDisplayName: assignee.displayName,
              assignedUseDisplayName: assignee.useDisplayName,
            })
            .from(shifts)
            .leftJoin(centres, eq(centres.id, shifts.centreId))
            .leftJoin(assignee, eq(assignee.id, shifts.assignedStaffId))
            .where(inArray(shifts.id, shiftIds))
        : Promise.resolve([]),
      batchIds.length
        ? this.db
            .select({
              id: shiftBatches.id,
              centreId: shiftBatches.centreId,
              centreName: centres.name,
              requestCompletedAt: shiftBatches.requestCompletedAt,
              confirmationRevision: shiftBatches.confirmationRevision,
              pendingChangeRevision: shiftBatches.pendingChangeRevision,
              lastConfirmationScheduledAt: shiftBatches.lastConfirmationScheduledAt,
              cancelledAt: shiftBatches.cancelledAt,
            })
            .from(shiftBatches)
            .innerJoin(centres, eq(centres.id, shiftBatches.centreId))
            .where(inArray(shiftBatches.id, batchIds))
        : Promise.resolve([]),
      batchIds.length
        ? this.db
            .select({
              id: shifts.id,
              batchId: shifts.batchId,
              shiftDate: shifts.shiftDate,
              startTime: shifts.startTime,
              endTime: shifts.endTime,
              roleNeeded: shifts.roleNeeded,
              addedToStaffpoint: shifts.addedToStaffpoint,
              status: shifts.status,
              assignedStaffId: shifts.assignedStaffId,
              assignedLegalName: assignee.legalName,
              assignedDisplayName: assignee.displayName,
              assignedUseDisplayName: assignee.useDisplayName,
            })
            .from(shifts)
            .leftJoin(assignee, eq(assignee.id, shifts.assignedStaffId))
            .where(inArray(shifts.batchId, batchIds))
        : Promise.resolve([]),
    ]);

    const shiftById = new Map(shiftRows.map((row) => [row.id, row]));
    const batchById = new Map(batchMetaRows.map((row) => [row.id, row]));
    const childrenByBatchId = new Map<string, ShiftFeedChildSummary[]>();
    for (const row of batchChildRows) {
      if (!row.batchId) continue;
      const list = childrenByBatchId.get(row.batchId) ?? [];
      list.push({
        id: row.id,
        shiftDate: String(row.shiftDate),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        roleNeeded: row.roleNeeded,
        addedToStaffpoint: row.addedToStaffpoint,
        status: row.status,
        assignedStaffId: row.assignedStaffId,
        assignedLegalName: row.assignedLegalName,
        assignedDisplayName: row.assignedDisplayName,
        assignedUseDisplayName: row.assignedUseDisplayName,
      });
      childrenByBatchId.set(row.batchId, list);
    }

    const childFilterInput = {
      staffId: q.staffId,
      status: q.status,
      from: q.from,
      to: q.to,
      staffpoint: q.staffpoint,
    };

    const items = pageKeys.map((key) => {
      if (key.type === 'shift') {
        const row = shiftById.get(key.id)!;
        return {
          type: 'shift' as const,
          shift: {
            id: row.id,
            centreId: row.centreId,
            centreName: row.centreName,
            shiftDate: String(row.shiftDate),
            startTime: String(row.startTime),
            endTime: String(row.endTime),
            roleNeeded: row.roleNeeded,
            addedToStaffpoint: row.addedToStaffpoint,
            status: row.status,
            assignedStaffId: row.assignedStaffId,
            assignedLegalName: row.assignedLegalName,
            assignedDisplayName: row.assignedDisplayName,
            assignedUseDisplayName: row.assignedUseDisplayName,
          },
        };
      }

      const batch = batchById.get(key.id)!;
      const allChildren = sortFeedChildren(childrenByBatchId.get(key.id) ?? []);
      const progress = computeBatchFeedProgress(allChildren);
      const matchingChildren = hasShiftLevelFilters
        ? sortFeedChildren(allChildren.filter((child) => childMatchesFeedFilters(child, childFilterInput)))
        : allChildren;

      return {
        type: 'batch' as const,
        batch: {
          id: batch.id,
          centreId: batch.centreId,
          centreName: batch.centreName,
          requestCompletedAt: batch.requestCompletedAt?.toISOString() ?? null,
          dateRange: formatBatchFeedDateRange(allChildren),
          displayState: deriveBatchFeedDisplayState(
            {
              requestCompletedAt: batch.requestCompletedAt,
              confirmationRevision: batch.confirmationRevision,
              pendingChangeRevision: batch.pendingChangeRevision,
              lastConfirmationScheduledAt: batch.lastConfirmationScheduledAt,
              cancelledAt: batch.cancelledAt,
            },
            progress,
          ),
        },
        matchingChildren,
        totalChildCount: allChildren.length,
        activeChildCount: progress.activeChildCount,
        fulfilledChildCount: progress.fulfilledChildCount,
        cancelledChildCount: progress.cancelledChildCount,
        matchingChildCount: matchingChildren.length,
      };
    });

    return {
      items,
      page: q.page,
      pageSize: q.pageSize,
      totalItems,
      totalPages,
    };
  }

  private buildShiftMatchConditions(q: ReturnType<typeof normalizeShiftFeedQuery>): SQL[] {
    const conds: SQL[] = [];
    const centreIds = resolveCentreUsageCentreIds({
      centreIds: q.centreIds,
      centreId: q.centreId,
    });
    if (centreIds?.length) conds.push(inArray(shifts.centreId, centreIds));
    if (q.staffId) conds.push(eq(shifts.assignedStaffId, q.staffId));
    if (q.status) conds.push(eq(shifts.status, q.status as never));
    if (q.from) conds.push(gte(shifts.shiftDate, q.from));
    if (q.to) conds.push(lte(shifts.shiftDate, q.to));
    if (q.staffpoint === 'yes') conds.push(eq(shifts.addedToStaffpoint, true));
    if (q.staffpoint === 'no') conds.push(eq(shifts.addedToStaffpoint, false));
    return conds;
  }

  private buildBatchCentreConditions(q: ReturnType<typeof normalizeShiftFeedQuery>): SQL[] {
    const conds: SQL[] = [];
    const centreIds = resolveCentreUsageCentreIds({
      centreIds: q.centreIds,
      centreId: q.centreId,
    });
    if (centreIds?.length) conds.push(inArray(shiftBatches.centreId, centreIds));
    return conds;
  }
}

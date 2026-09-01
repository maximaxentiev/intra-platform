import { eq, inArray } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '../db/schema';
import { centres, shiftBatches, shifts, users } from '../db/schema';
import { ShiftBatchesService } from '../shift-batches/shift-batches.service';
import { createMockShiftBatchProgressCommunicationService } from '../shift-batches/shift-batch-progress-test.util';
import {
  createMockShiftBatchCompletionReadinessService,
  createMockShiftBatchCompletionService,
  createMockShiftBatchUpdateConfirmationService,
} from '../shift-batches/shift-batch-completion-test.util';
import { ensurePlatformAuditTable } from '../platform-audit/test-platform-audit-schema.util';
import { createIntegrationShiftsService } from './shifts-integration-test.util';
import type { ShiftsService } from './shifts.service';
import { ShiftsFeedService } from './shifts-feed.service';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

async function probePostgres(): Promise<boolean> {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2500, max: 1 });
  try {
    await pool.query('select 1');
    await pool.end();
    return true;
  } catch {
    await pool.end().catch(() => undefined);
    return false;
  }
}

const POSTGRES_READY = await probePostgres();

const FIXTURE = {
  centreA: '77777777-7777-4777-8777-777777777701',
  opsUser: '77777777-7777-4777-8777-777777777702',
};

function buildBatchesService(db: NodePgDatabase<typeof schema>, shiftsService: ShiftsService) {
  return new ShiftBatchesService(
    db,
    shiftsService,
    createMockShiftBatchProgressCommunicationService(),
    createMockShiftBatchCompletionReadinessService(),
    createMockShiftBatchCompletionService(),
    createMockShiftBatchUpdateConfirmationService(),
    { getBatchActivity: vi.fn() } as never,
  );
}

describe.skipIf(!POSTGRES_READY)('Shifts feed Phase B2 integration', () => {
  let pool: Pool;
  let db: NodePgDatabase<typeof schema>;
  let shiftsService: ShiftsService;
  let batchesService: ShiftBatchesService;
  let feedService: ShiftsFeedService;
  const batchIds: string[] = [];
  const shiftIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    db = drizzle(pool, { schema });
    await ensurePlatformAuditTable(pool);
    shiftsService = createIntegrationShiftsService(db);
    batchesService = buildBatchesService(db, shiftsService);
    feedService = new ShiftsFeedService(db);

    await db.delete(shifts).where(eq(shifts.centreId, FIXTURE.centreA));
    await db.delete(shiftBatches).where(eq(shiftBatches.centreId, FIXTURE.centreA));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreA));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));

    await db.insert(users).values({
      id: FIXTURE.opsUser,
      email: 'shift-feed-b2@example.test',
      fullName: 'Feed Ops',
      role: 'admin',
      passwordHash: 'hash',
      isActive: true,
    });
    await db.insert(centres).values({
      id: FIXTURE.centreA,
      name: 'Feed Centre A',
      city: 'Toronto',
      status: 'active',
    });
  });

  afterAll(async () => {
    if (shiftIds.length) await db.delete(shifts).where(inArray(shifts.id, shiftIds));
    if (batchIds.length) await db.delete(shiftBatches).where(inArray(shiftBatches.id, batchIds));
    await db.delete(centres).where(eq(centres.id, FIXTURE.centreA));
    await db.delete(users).where(eq(users.id, FIXTURE.opsUser));
    await pool.end();
  });

  it('returns batch parent once and excludes child shifts from top-level feed', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreA,
        shifts: [
          {
            shiftDate: '2026-10-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
          },
          {
            shiftDate: '2026-10-02',
            startTime: '09:00:00',
            endTime: '17:00:00',
            roleNeeded: 'ECA',
          },
        ],
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    shiftIds.push(...created.created.map((row) => row.id));

    const individual = await shiftsService.create(
      {
        centreId: FIXTURE.centreA,
        shiftDate: '2026-10-03',
        startTime: '08:00:00',
        endTime: '16:00:00',
        roleNeeded: 'RECE',
      },
      FIXTURE.opsUser,
    );
    shiftIds.push(individual.id);

    const feed = await feedService.feed({ centreId: FIXTURE.centreA, page: 1, pageSize: 25 });
    const topLevelIds = feed.items.map((item) =>
      item.type === 'shift' ? item.shift.id : item.batch.id,
    );

    expect(feed.totalItems).toBe(2);
    expect(topLevelIds).toContain(created.batch.id);
    expect(topLevelIds).toContain(individual.id);
    expect(topLevelIds).not.toContain(created.created[0]?.id);

    const batchItem = feed.items.find(
      (item): item is Extract<(typeof feed.items)[number], { type: 'batch' }> =>
        item.type === 'batch' && item.batch.id === created.batch.id,
    );
    expect(batchItem?.matchingChildren).toHaveLength(2);
    expect(batchItem?.totalChildCount).toBe(2);
  });

  it('paginates top-level feed items and counts a 5-child batch as one item', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreA,
        shifts: Array.from({ length: 5 }, (_, index) => ({
          shiftDate: `2026-11-${String(index + 1).padStart(2, '0')}`,
          startTime: '08:00:00',
          endTime: '16:00:00',
          roleNeeded: 'ECA',
        })),
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    shiftIds.push(...created.created.map((row) => row.id));

    const feed = await feedService.feed({
      centreId: FIXTURE.centreA,
      from: '2026-11-01',
      to: '2026-11-30',
      page: 1,
      pageSize: 1,
    });

    expect(feed.totalItems).toBe(1);
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?.type).toBe('batch');
    if (feed.items[0]?.type === 'batch') {
      expect(feed.items[0].totalChildCount).toBe(5);
    }
  });

  it('filters expanded batch children by status while keeping full-batch progress counts', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreA,
        shifts: [
          {
            shiftDate: '2026-12-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
          },
          {
            shiftDate: '2026-12-02',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECA',
          },
        ],
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    shiftIds.push(...created.created.map((row) => row.id));

    const pendingChildId = created.created[0]!.id;
    await shiftsService.changeStatus(pendingChildId, { status: 'filled' }, FIXTURE.opsUser);

    const feed = await feedService.feed({
      centreId: FIXTURE.centreA,
      from: '2026-12-01',
      to: '2026-12-31',
      status: 'pending',
      page: 1,
      pageSize: 25,
    });

    const batchItem = feed.items.find(
      (item): item is Extract<(typeof feed.items)[number], { type: 'batch' }> =>
        item.type === 'batch' && item.batch.id === created.batch.id,
    );
    expect(batchItem).toBeTruthy();
    if (!batchItem || batchItem.type !== 'batch') return;

    expect(batchItem.matchingChildren).toHaveLength(1);
    expect(batchItem.matchingChildCount).toBe(1);
    expect(batchItem.totalChildCount).toBe(2);
    expect(batchItem.fulfilledChildCount).toBe(1);
    expect(batchItem.activeChildCount).toBe(2);
  });

  it('filters batches by staffpoint on the server', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreA,
        shifts: [
          {
            shiftDate: '2027-01-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
            addedToStaffpoint: true,
          },
          {
            shiftDate: '2027-01-02',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECA',
            addedToStaffpoint: false,
          },
        ],
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    shiftIds.push(...created.created.map((row) => row.id));

    const feed = await feedService.feed({
      centreId: FIXTURE.centreA,
      from: '2027-01-01',
      to: '2027-01-31',
      staffpoint: 'yes',
      page: 1,
      pageSize: 25,
    });

    const batchItem = feed.items.find(
      (item): item is Extract<(typeof feed.items)[number], { type: 'batch' }> =>
        item.type === 'batch' && item.batch.id === created.batch.id,
    );
    expect(batchItem?.matchingChildren).toHaveLength(1);
    expect(batchItem?.matchingChildren[0]?.addedToStaffpoint).toBe(true);
  });

  it('shows stale batch states in feed instead of completed', async () => {
    const created = await batchesService.createWithShifts(
      {
        centreId: FIXTURE.centreA,
        shifts: [
          {
            shiftDate: '2028-03-01',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECE',
          },
          {
            shiftDate: '2028-03-02',
            startTime: '08:00:00',
            endTime: '16:00:00',
            roleNeeded: 'ECA',
          },
        ],
      },
      FIXTURE.opsUser,
    );
    batchIds.push(created.batch.id);
    shiftIds.push(...created.created.map((row) => row.id));

    const childA = created.created[0]!.id;
    const childB = created.created[1]!.id;
    const staffPlaceholder = '77777777-7777-4777-8777-777777777799';
    await db
      .update(shifts)
      .set({ status: 'filled', assignedStaffId: staffPlaceholder })
      .where(inArray(shifts.id, [childA, childB]));

    const confirmedAt = new Date('2028-03-01T12:00:00Z');
    await db
      .update(shiftBatches)
      .set({
        requestCompletedAt: confirmedAt,
        confirmationRevision: 1,
        pendingChangeRevision: 0,
        lastConfirmationScheduledAt: confirmedAt,
      })
      .where(eq(shiftBatches.id, created.batch.id));

    await shiftsService.unassign(childA, FIXTURE.opsUser);

    const feed = await feedService.feed({
      centreId: FIXTURE.centreA,
      from: '2028-03-01',
      to: '2028-03-31',
      page: 1,
      pageSize: 25,
    });
    const batchItem = feed.items.find(
      (item): item is Extract<(typeof feed.items)[number], { type: 'batch' }> =>
        item.type === 'batch' && item.batch.id === created.batch.id,
    );
    expect(batchItem?.batch.displayState).toBe('updates_required');

    await db
      .update(shifts)
      .set({ status: 'filled', assignedStaffId: staffPlaceholder })
      .where(eq(shifts.id, childA));
    const feedReady = await feedService.feed({
      centreId: FIXTURE.centreA,
      from: '2028-03-01',
      to: '2028-03-31',
      page: 1,
      pageSize: 25,
    });
    const readyItem = feedReady.items.find(
      (item): item is Extract<(typeof feedReady.items)[number], { type: 'batch' }> =>
        item.type === 'batch' && item.batch.id === created.batch.id,
    );
    expect(readyItem?.batch.displayState).toBe('ready_to_send_updates');
  });
});

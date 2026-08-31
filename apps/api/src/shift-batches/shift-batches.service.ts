import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { aliasedTable, asc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database, type DbExecutor } from '../db/drizzle.module';
import { centres, shiftBatches, shifts, staff } from '../db/schema';
import { ShiftsService } from '../shifts/shifts.service';
import { assertSameDayShiftSchedule } from '../shifts/shift-schedule-validation.util';
import { assertActiveShiftRoleForCreate } from '../shifts/shift-role-update.util';
import type {
  BulkCreateBatchChildShiftsDto,
  BulkCreateBatchChildShiftsResultDto,
  CreateBatchChildShiftDto,
  CreateShiftBatchDto,
  ShiftBatchWorkspaceDto,
} from './dto/shift-batches.dto';
import { lockOpenShiftBatch } from './shift-batch-centre.util';

const assignee = aliasedTable(staff, 'assignee');

@Injectable()
export class ShiftBatchesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly shifts: ShiftsService,
  ) {}

  async create(dto: CreateShiftBatchDto, actorUserId: string) {
    await this.assertCentreExists(dto.centreId);

    const rows = await this.db
      .insert(shiftBatches)
      .values({
        centreId: dto.centreId,
        createdByUserId: actorUserId,
      })
      .returning({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        createdByUserId: shiftBatches.createdByUserId,
        requestCompletedAt: shiftBatches.requestCompletedAt,
        requestCompletedByUserId: shiftBatches.requestCompletedByUserId,
        createdAt: shiftBatches.createdAt,
        updatedAt: shiftBatches.updatedAt,
      });

    const batch = rows[0];
    if (!batch) throw new BadRequestException('Batch could not be created.');
    return this.mapBatchRecord(batch);
  }

  async getWorkspace(id: string): Promise<ShiftBatchWorkspaceDto> {
    const batchRows = await this.db
      .select({
        id: shiftBatches.id,
        centreId: shiftBatches.centreId,
        centreName: centres.name,
        requestCompletedAt: shiftBatches.requestCompletedAt,
        requestCompletedByUserId: shiftBatches.requestCompletedByUserId,
        createdByUserId: shiftBatches.createdByUserId,
        createdAt: shiftBatches.createdAt,
        updatedAt: shiftBatches.updatedAt,
      })
      .from(shiftBatches)
      .innerJoin(centres, eq(centres.id, shiftBatches.centreId))
      .where(eq(shiftBatches.id, id));

    const batch = batchRows[0];
    if (!batch) throw new NotFoundException('Batch not found.');

    const childRows = await this.db
      .select({
        id: shifts.id,
        shiftDate: shifts.shiftDate,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        roleNeeded: shifts.roleNeeded,
        addedToStaffpoint: shifts.addedToStaffpoint,
        status: shifts.status,
        confirmationNotes: shifts.shiftConfirmationNotes,
        assignedStaffId: shifts.assignedStaffId,
        assignedLegalName: assignee.legalName,
        assignedDisplayName: assignee.displayName,
        assignedUseDisplayName: assignee.useDisplayName,
      })
      .from(shifts)
      .leftJoin(assignee, eq(assignee.id, shifts.assignedStaffId))
      .where(eq(shifts.batchId, id))
      .orderBy(asc(shifts.shiftDate), asc(shifts.startTime));

    return {
      id: batch.id,
      centreId: batch.centreId,
      centreName: batch.centreName,
      requestCompletedAt: batch.requestCompletedAt?.toISOString() ?? null,
      requestCompletedByUserId: batch.requestCompletedByUserId,
      createdByUserId: batch.createdByUserId,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      shifts: childRows.map((row) => ({
        id: row.id,
        shiftDate: String(row.shiftDate),
        startTime: String(row.startTime),
        endTime: String(row.endTime),
        roleNeeded: row.roleNeeded,
        addedToStaffpoint: row.addedToStaffpoint,
        status: row.status,
        confirmationNotes: row.confirmationNotes,
        assignedStaffId: row.assignedStaffId,
        assignedLegalName: row.assignedLegalName,
        assignedDisplayName: row.assignedDisplayName,
        assignedUseDisplayName: row.assignedUseDisplayName,
      })),
    };
  }

  async addChild(batchId: string, dto: CreateBatchChildShiftDto, actorUserId: string) {
    return this.db.transaction(async (tx) => {
      const batch = await lockOpenShiftBatch(tx, batchId);
      return this.createChildInTransaction(tx, batch.centreId, batchId, dto, actorUserId);
    });
  }

  async bulkAddChildren(
    batchId: string,
    dto: BulkCreateBatchChildShiftsDto,
    actorUserId: string,
  ): Promise<BulkCreateBatchChildShiftsResultDto> {
    this.validateBulkPayload(dto.shifts);

    return this.db.transaction(async (tx) => {
      const batch = await lockOpenShiftBatch(tx, batchId);
      const created: { id: string; shiftDate: string }[] = [];

      for (let index = 0; index < dto.shifts.length; index++) {
        try {
          const row = dto.shifts[index]!;
          const result = await this.createChildInTransaction(
            tx,
            batch.centreId,
            batchId,
            row,
            actorUserId,
          );
          created.push({ id: result.id, shiftDate: row.shiftDate });
        } catch (err) {
          throw new BadRequestException({
            message: 'Bulk shift creation failed.',
            index,
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { created };
    });
  }

  private validateBulkPayload(rows: CreateBatchChildShiftDto[]) {
    if (!rows.length) {
      throw new BadRequestException('At least one shift is required.');
    }

    rows.forEach((row, index) => {
      try {
        assertActiveShiftRoleForCreate(row.roleNeeded);
        assertSameDayShiftSchedule(row.startTime, row.endTime);
      } catch (err) {
        throw new BadRequestException({
          message: 'Bulk shift validation failed.',
          index,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  private async createChildInTransaction(
    tx: DbExecutor,
    batchCentreId: string,
    batchId: string,
    dto: CreateBatchChildShiftDto,
    actorUserId: string,
  ) {
    const created = await this.shifts.create(
      {
        centreId: batchCentreId,
        shiftDate: dto.shiftDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        roleNeeded: dto.roleNeeded,
        addedToStaffpoint: dto.addedToStaffpoint,
        confirmationNotes: dto.confirmationNotes,
      },
      actorUserId,
      { tx, batchId },
    );

    await this.shifts.insertInitialComment(tx, created.id, actorUserId, dto.internalComment);

    return created;
  }

  private async assertCentreExists(centreId: string) {
    const rows = await this.db.select({ id: centres.id }).from(centres).where(eq(centres.id, centreId));
    if (!rows[0]) throw new NotFoundException('Centre not found.');
  }

  private mapBatchRecord(batch: {
    id: string;
    centreId: string;
    createdByUserId: string | null;
    requestCompletedAt: Date | null;
    requestCompletedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: batch.id,
      centreId: batch.centreId,
      createdByUserId: batch.createdByUserId,
      requestCompletedAt: batch.requestCompletedAt?.toISOString() ?? null,
      requestCompletedByUserId: batch.requestCompletedByUserId,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
    };
  }
}

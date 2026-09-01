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
  CreateBatchWithShiftsDto,
  CreateBatchWithShiftsResultDto,
  CreateShiftBatchDto,
  ShiftBatchWorkspaceDto,
} from './dto/shift-batches.dto';
import { lockOpenShiftBatch } from './shift-batch-centre.util';
import { ShiftBatchProgressCommunicationService } from './shift-batch-progress-communication.service';
import { ShiftBatchCompletionReadinessService } from './shift-batch-completion-readiness.service';
import { ShiftBatchCompletionService } from './shift-batch-completion.service';
import { ShiftBatchUpdateConfirmationService } from './shift-batch-update-confirmation.service';
import { ShiftBatchActivityService } from './shift-batch-activity.service';
import { deriveBatchConfirmationUiState } from './shift-batch-confirmation-state.util';
import { computeBatchProgressCounts } from './shift-batch-progress.util';

const assignee = aliasedTable(staff, 'assignee');

@Injectable()
export class ShiftBatchesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly shifts: ShiftsService,
    private readonly batchProgressCommunications: ShiftBatchProgressCommunicationService,
    private readonly batchCompletionReadiness: ShiftBatchCompletionReadinessService,
    private readonly batchCompletion: ShiftBatchCompletionService,
    private readonly batchUpdateConfirmation: ShiftBatchUpdateConfirmationService,
    private readonly batchActivity: ShiftBatchActivityService,
  ) {}

  async createWithShifts(
    dto: CreateBatchWithShiftsDto,
    actorUserId: string,
  ): Promise<CreateBatchWithShiftsResultDto> {
    this.validateBulkPayload(dto.shifts);
    await this.assertCentreExists(dto.centreId);

    return this.db.transaction(async (tx) => {
      const batchRows = await tx
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

      const batch = batchRows[0];
      if (!batch) throw new BadRequestException('Batch could not be created.');

      const created: { id: string; shiftDate: string }[] = [];

      for (let index = 0; index < dto.shifts.length; index++) {
        try {
          const row = dto.shifts[index]!;
          const result = await this.createChildInTransaction(
            tx,
            batch.centreId,
            batch.id,
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

      return {
        batch: this.mapBatchRecord(batch),
        created,
      };
    });
  }

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
        confirmationRevision: shiftBatches.confirmationRevision,
        pendingChangeRevision: shiftBatches.pendingChangeRevision,
        lastConfirmationScheduledAt: shiftBatches.lastConfirmationScheduledAt,
        progressEmailScheduledAt: shiftBatches.progressEmailScheduledAt,
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

    const progressEmailStatus =
      await this.batchProgressCommunications.resolveProgressEmailStatus(id);
    const finalConfirmationStatus =
      await this.batchCompletion.resolveFinalConfirmationStatus(id);

    const progress = computeBatchProgressCounts(childRows);
    const confirmationUiState = deriveBatchConfirmationUiState(
      {
        requestCompletedAt: batch.requestCompletedAt,
        confirmationRevision: batch.confirmationRevision,
        pendingChangeRevision: batch.pendingChangeRevision,
        lastConfirmationScheduledAt: batch.lastConfirmationScheduledAt,
      },
      progress,
    );

    return {
      id: batch.id,
      centreId: batch.centreId,
      centreName: batch.centreName,
      requestCompletedAt: batch.requestCompletedAt?.toISOString() ?? null,
      requestCompletedByUserId: batch.requestCompletedByUserId,
      confirmationRevision: batch.confirmationRevision,
      pendingChangeRevision: batch.pendingChangeRevision,
      lastConfirmationScheduledAt: batch.lastConfirmationScheduledAt?.toISOString() ?? null,
      confirmationUiState,
      progressEmailScheduledAt: batch.progressEmailScheduledAt?.toISOString() ?? null,
      progressEmailStatus,
      finalConfirmationStatus,
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
    const created = await this.db.transaction(async (tx) => {
      const batch = await lockOpenShiftBatch(tx, batchId);
      return this.createChildInTransaction(tx, batch.centreId, batchId, dto, actorUserId);
    });
    await this.batchProgressCommunications.maybeEvaluateAfterFulfillmentChange(batchId);
    return created;
  }

  async bulkAddChildren(
    batchId: string,
    dto: BulkCreateBatchChildShiftsDto,
    actorUserId: string,
  ): Promise<BulkCreateBatchChildShiftsResultDto> {
    this.validateBulkPayload(dto.shifts);

    const result = await this.db.transaction(async (tx) => {
      const batch = await lockOpenShiftBatch(tx, batchId);
      const created: { id: string; shiftDate: string }[] = [];

      for (let index = 0; index < dto.shifts.length; index++) {
        try {
          const row = dto.shifts[index]!;
          const child = await this.createChildInTransaction(
            tx,
            batch.centreId,
            batchId,
            row,
            actorUserId,
          );
          created.push({ id: child.id, shiftDate: row.shiftDate });
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

    await this.batchProgressCommunications.maybeEvaluateAfterFulfillmentChange(batchId);
    return result;
  }

  async getCompletionReadiness(batchId: string) {
    return this.batchCompletionReadiness.getReadiness(batchId);
  }

  async completeRequest(batchId: string, actorUserId: string) {
    return this.batchCompletion.complete(batchId, actorUserId);
  }

  async retryFinalConfirmation(batchId: string, actorUserId: string) {
    return this.batchCompletion.retryFinalConfirmation(batchId, actorUserId);
  }

  async retryProgressEmail(batchId: string, actorUserId: string) {
    return this.batchProgressCommunications.retryProgressEmail(batchId, actorUserId);
  }

  async getUpdateReadiness(batchId: string) {
    return this.batchUpdateConfirmation.getUpdateReadiness(batchId);
  }

  async sendUpdatesConfirmation(batchId: string, selectedChangeIds: string[], actorUserId: string) {
    return this.batchUpdateConfirmation.scheduleUpdate(batchId, actorUserId, selectedChangeIds);
  }

  async retryUpdateConfirmation(batchId: string, actorUserId: string) {
    return this.batchUpdateConfirmation.retryUpdateConfirmation(batchId, actorUserId);
  }

  async getBatchActivity(batchId: string, page?: number, pageSize?: number) {
    return this.batchActivity.getBatchActivity(batchId, page, pageSize);
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

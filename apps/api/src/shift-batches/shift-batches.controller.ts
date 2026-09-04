import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionPayload } from '../auth/session.service';
import {
  BulkCreateBatchChildShiftsDto,
  CancelShiftBatchDto,
  CompleteBatchRequestDto,
  CreateBatchChildShiftDto,
  CreateBatchWithShiftsDto,
  CreateShiftBatchDto,
  SendBatchUpdatesConfirmationDto,
} from './dto/shift-batches.dto';
import { ShiftBatchesService } from './shift-batches.service';
import { BatchCentreEmailPreviewDto } from '../email/dto/centre-email-preview.dto';

@ApiTags('shift-batches')
@Controller('shift-batches')
export class ShiftBatchesController {
  constructor(private readonly shiftBatches: ShiftBatchesService) {}

  @Post()
  create(@Body() dto: CreateShiftBatchDto, @CurrentUser() user: SessionPayload) {
    return this.shiftBatches.create(dto, user.userId);
  }

  @Post('with-shifts')
  createWithShifts(
    @Body() dto: CreateBatchWithShiftsDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shiftBatches.createWithShifts(dto, user.userId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.shiftBatches.getWorkspace(id);
  }

  @Post(':id/shifts')
  addChild(
    @Param('id') id: string,
    @Body() dto: CreateBatchChildShiftDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shiftBatches.addChild(id, dto, user.userId);
  }

  @Post(':id/shifts/bulk')
  bulkAddChildren(
    @Param('id') id: string,
    @Body() dto: BulkCreateBatchChildShiftsDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shiftBatches.bulkAddChildren(id, dto, user.userId);
  }

  @Get(':id/completion-readiness')
  getCompletionReadiness(@Param('id') id: string) {
    return this.shiftBatches.getCompletionReadiness(id);
  }

  @Get(':id/activity')
  getBatchActivity(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.shiftBatches.getBatchActivity(
      id,
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Post(':id/complete')
  completeRequest(
    @Param('id') id: string,
    @Body() dto: CompleteBatchRequestDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shiftBatches.completeRequest(id, user.userId, dto.centreEmail);
  }

  @Post(':id/centre-email-preview')
  previewCentreEmail(@Param('id') id: string, @Body() dto: BatchCentreEmailPreviewDto) {
    return this.shiftBatches.previewCentreEmail(id, dto);
  }

  @Get(':id/update-readiness')
  getUpdateReadiness(@Param('id') id: string) {
    return this.shiftBatches.getUpdateReadiness(id);
  }

  @Post(':id/send-updates-confirmation')
  sendUpdatesConfirmation(
    @Param('id') id: string,
    @Body() dto: SendBatchUpdatesConfirmationDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shiftBatches.sendUpdatesConfirmation(
      id,
      dto.selectedChangeIds ?? [],
      user.userId,
      dto.expectedPendingChangeRevision,
      dto.centreEmail,
    );
  }

  @Post(':id/update-confirmation/retry')
  retryUpdateConfirmation(@Param('id') id: string, @CurrentUser() user: SessionPayload) {
    return this.shiftBatches.retryUpdateConfirmation(id, user.userId);
  }

  @Post(':id/final-confirmation/retry')
  retryFinalConfirmation(@Param('id') id: string, @CurrentUser() user: SessionPayload) {
    return this.shiftBatches.retryFinalConfirmation(id, user.userId);
  }

  @Post(':id/progress-email/retry')
  retryProgressEmail(@Param('id') id: string, @CurrentUser() user: SessionPayload) {
    return this.shiftBatches.retryProgressEmail(id, user.userId);
  }

  @Post(':id/cancel')
  cancelBatch(
    @Param('id') id: string,
    @Body() dto: CancelShiftBatchDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shiftBatches.cancelBatch(
      id,
      dto.cancellationReason,
      user.userId,
      dto.communications,
    );
  }
}

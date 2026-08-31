import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionPayload } from '../auth/session.service';
import {
  BulkCreateBatchChildShiftsDto,
  CreateBatchChildShiftDto,
  CreateBatchWithShiftsDto,
  CreateShiftBatchDto,
} from './dto/shift-batches.dto';
import { ShiftBatchesService } from './shift-batches.service';

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
}

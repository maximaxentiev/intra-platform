import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionPayload } from '../auth/session.service';
import {
  AddCommentDto,
  AssignDto,
  ChangeStatusDto,
  ContactedDto,
  ListShiftsQuery,
  UpdateShiftDto,
  UpsertShiftDto,
} from './dto/shifts.dto';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  list(@Query() q: ListShiftsQuery) {
    return this.shifts.list(q);
  }

  @Post()
  create(@Body() dto: UpsertShiftDto, @CurrentUser() user: SessionPayload) {
    return this.shifts.create(dto, user.userId);
  }

  @Delete('comments/:commentId')
  deleteComment(@Param('commentId') commentId: string, @CurrentUser() user: SessionPayload) {
    return this.shifts.deleteComment(commentId, user.userId, user.role);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.shifts.get(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shifts.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shifts.remove(id);
  }

  @Post(':id/assign')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shifts.assign(id, dto.staffId, user.userId);
  }

  @Post(':id/send-assignment-confirmation')
  sendAssignmentConfirmation(@Param('id') id: string, @CurrentUser() user: SessionPayload) {
    return this.shifts.sendAssignmentConfirmation(id, user.userId);
  }

  @Post(':id/unassign')
  unassign(@Param('id') id: string, @CurrentUser() user: SessionPayload) {
    return this.shifts.unassign(id, user.userId);
  }

  @Post(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shifts.changeStatus(id, dto, user.userId);
  }

  @Get(':id/available-staff')
  availableStaff(@Param('id') id: string) {
    return this.shifts.availableStaff(id);
  }

  @Post(':id/contacted')
  markContacted(@Param('id') id: string, @Body() dto: ContactedDto) {
    return this.shifts.setContacted(id, dto.staffId, true);
  }

  @Delete(':id/contacted/:staffId')
  unmarkContacted(@Param('id') id: string, @Param('staffId') staffId: string) {
    return this.shifts.setContacted(id, staffId, false);
  }

  @Get(':id/comments')
  comments(@Param('id') id: string) {
    return this.shifts.comments(id);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.shifts.addComment(id, user.userId, dto);
  }
}

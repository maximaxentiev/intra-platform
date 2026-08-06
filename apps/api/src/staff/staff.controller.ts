import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionPayload } from '../auth/session.service';
import { PortalInvitationRequestDto } from './dto/create-manual-staff.dto';
import { CreateManualStaffDto } from './dto/create-manual-staff.dto';
import { SetCentreLinksDto, UpsertStaffDto } from './dto/staff.dto';
import { StaffPortalInvitationsService } from '../staff-portal/staff-portal-invitations.service';
import { StaffService } from './staff.service';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly portalInvites: StaffPortalInvitationsService,
  ) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.staff.get(id);
  }

  @Post()
  createManual(@Body() dto: CreateManualStaffDto, @CurrentUser() user: SessionPayload) {
    return this.staff.createManual(dto, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertStaffDto) {
    return this.staff.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staff.remove(id);
  }

  @Post(':id/portal-invitations')
  sendPortalInvitation(
    @Param('id') id: string,
    @Body() body: PortalInvitationRequestDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.portalInvites.sendInvitation(id, user.userId, { resend: body?.resend });
  }

  @Post(':id/portal-access/disable')
  disablePortalAccess(@Param('id') id: string, @CurrentUser() user: SessionPayload) {
    return this.portalInvites.disablePortalAccess(id, user.userId);
  }

  @Post(':id/portal-access/enable')
  enablePortalAccess(@Param('id') id: string, @CurrentUser() user: SessionPayload) {
    return this.portalInvites.enablePortalAccess(id, user.userId);
  }

  @Get(':id/top-centres')
  topCentres(@Param('id') id: string) {
    return this.staff.topCentreIds(id);
  }

  @Get(':id/banned-centres')
  bannedCentres(@Param('id') id: string) {
    return this.staff.bannedCentreIds(id);
  }

  @Put(':id/top-centres')
  setTopCentres(@Param('id') id: string, @Body() dto: SetCentreLinksDto) {
    return this.staff.setTopCentres(id, dto.centreIds);
  }

  @Put(':id/banned-centres')
  setBannedCentres(@Param('id') id: string, @Body() dto: SetCentreLinksDto) {
    return this.staff.setBannedCentres(id, dto.centreIds);
  }

  @Get(':id/shifts')
  shifts(@Param('id') id: string) {
    return this.staff.shiftHistory(id);
  }
}

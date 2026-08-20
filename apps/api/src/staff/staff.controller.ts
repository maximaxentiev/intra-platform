import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionPayload } from '../auth/session.service';
import { PortalInvitationRequestDto } from './dto/create-manual-staff.dto';
import { CreateManualStaffDto } from './dto/create-manual-staff.dto';
import { StaffCsvImportConfirmDto } from './dto/staff-csv-import.dto';
import { SetCentreLinksDto, UpsertStaffDto } from './dto/staff.dto';
import { STAFF_CSV_MAX_BYTES } from './staff-csv-import.config';
import { StaffCsvImportService } from './staff-csv-import.service';
import { StaffPortalInvitationsService } from '../staff-portal/staff-portal-invitations.service';
import { StaffService } from './staff.service';

const csvUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: STAFF_CSV_MAX_BYTES },
});

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly portalInvites: StaffPortalInvitationsService,
    private readonly csvImport: StaffCsvImportService,
  ) {}

  @Post('import/preview')
  @UseInterceptors(csvUpload)
  previewCsvImport(@UploadedFile() file: Express.Multer.File) {
    return this.csvImport.previewFromUpload(file);
  }

  @Post('import')
  @UseInterceptors(csvUpload)
  confirmCsvImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: StaffCsvImportConfirmDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.csvImport.executeImport(file, user.userId, Boolean(body.sendPortalInvitations));
  }

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
  update(
    @Param('id') id: string,
    @Body() dto: UpsertStaffDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.staff.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: SessionPayload) {
    return this.staff.remove(id, user.userId);
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

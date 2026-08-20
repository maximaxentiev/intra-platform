import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionPayload } from '../auth/session.service';
import { CentresService } from './centres.service';
import {
  ReorderContactsDto,
  SetSecondaryChannelsDto,
  SetStaffLinksDto,
  UpsertCentreDto,
  UpsertContactDto,
} from './dto/centres.dto';

@ApiTags('centres')
@Controller('centres')
export class CentresController {
  constructor(private readonly centres: CentresService) {}

  @Get()
  list() {
    return this.centres.list();
  }

  // Contact routes are declared before ':id' collisions are avoided by using
  // a distinct '/contacts/:contactId' prefix.
  @Patch('contacts/:contactId')
  updateContact(@Param('contactId') contactId: string, @Body() dto: UpsertContactDto) {
    return this.centres.updateContact(contactId, dto);
  }

  @Delete('contacts/:contactId')
  removeContact(@Param('contactId') contactId: string) {
    return this.centres.removeContact(contactId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.centres.get(id);
  }

  @Post()
  create(@Body() dto: UpsertCentreDto, @CurrentUser() user: SessionPayload) {
    return this.centres.create(dto, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpsertCentreDto,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.centres.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: SessionPayload) {
    return this.centres.remove(id, user.userId);
  }

  @Get(':id/secondary-channels')
  secondaryChannels(@Param('id') id: string) {
    return this.centres.secondaryChannels(id);
  }

  @Put(':id/secondary-channels')
  setSecondaryChannels(@Param('id') id: string, @Body() dto: SetSecondaryChannelsDto) {
    return this.centres.setSecondaryChannels(id, dto.channels);
  }

  @Get(':id/contacts')
  contacts(@Param('id') id: string) {
    return this.centres.contacts(id);
  }

  @Post(':id/contacts')
  addContact(@Param('id') id: string, @Body() dto: UpsertContactDto) {
    return this.centres.addContact(id, dto);
  }

  @Put(':id/contacts/reorder')
  reorderContacts(@Param('id') id: string, @Body() dto: ReorderContactsDto) {
    return this.centres.reorderContacts(id, dto);
  }

  @Get(':id/top-staff')
  topStaff(@Param('id') id: string) {
    return this.centres.topStaff(id);
  }

  @Get(':id/banned-staff')
  bannedStaff(@Param('id') id: string) {
    return this.centres.bannedStaff(id);
  }

  @Put(':id/top-staff')
  setTopStaff(@Param('id') id: string, @Body() dto: SetStaffLinksDto) {
    return this.centres.setTopStaff(id, dto.staffIds);
  }

  @Put(':id/banned-staff')
  setBannedStaff(@Param('id') id: string, @Body() dto: SetStaffLinksDto) {
    return this.centres.setBannedStaff(id, dto.staffIds);
  }

  @Get(':id/shifts')
  shifts(@Param('id') id: string) {
    return this.centres.shiftHistory(id);
  }
}

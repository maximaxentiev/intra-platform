import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SetCentreLinksDto, UpsertStaffDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.staff.get(id);
  }

  @Post()
  create(@Body() dto: UpsertStaffDto) {
    return this.staff.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertStaffDto) {
    return this.staff.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staff.remove(id);
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

import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import {
  CreateAvailabilityDto,
  ListAvailabilityQuery,
  UpdateAvailabilityDto,
} from './dto/availability.dto';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  list(@Query() q: ListAvailabilityQuery) {
    return this.availability.list(q.weekStart, q.staffId);
  }

  @Post()
  create(@Body() dto: CreateAvailabilityDto) {
    return this.availability.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAvailabilityDto) {
    return this.availability.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.availability.remove(id);
  }
}

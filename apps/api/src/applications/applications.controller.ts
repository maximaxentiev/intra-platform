import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { ListApplicationsQuery } from './dto/applications.dto';

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@Query() query: ListApplicationsQuery) {
    return this.applications.list(query);
  }

  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.applications.listActivity(id);
  }

  @Get(':id/documents')
  documents(@Param('id') id: string) {
    return this.applications.listDocuments(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.applications.get(id);
  }
}

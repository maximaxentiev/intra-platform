import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionPayload } from '../auth/session.service';
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

  @Get(':id/documents/:documentId/content')
  async documentContent(
    @Param('id') applicationId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: SessionPayload,
    @Res() res: Response,
  ) {
    const result = await this.applications.streamDocumentContent(
      applicationId,
      documentId,
      user.userId,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', result.contentDisposition);
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    result.body.on('error', () => {
      if (!res.headersSent) {
        res.status(503).json({ message: 'Document is temporarily unavailable.', statusCode: 503 });
        return;
      }
      res.destroy();
    });

    result.body.pipe(res);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.applications.get(id);
  }
}

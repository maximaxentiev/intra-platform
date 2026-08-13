import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../auth/session.guard';
import { resolveClientIp } from '../common/client-ip.util';
import { ExchangeStaffDocumentShareSessionDto } from './dto/staff-document-share-public.dto';
import { StaffDocumentSharePublicService } from './staff-document-share-public.service';
import { StaffDocumentShareRateLimitService } from './staff-document-share-rate-limit.service';
import { applyPublicStaffDocumentShareHeaders } from './staff-document-share-public-headers.util';

@Public()
@ApiTags('public-staff-documents')
@Controller('v1/public/staff-documents/share')
export class StaffDocumentSharePublicController {
  constructor(
    private readonly publicShare: StaffDocumentSharePublicService,
    private readonly rateLimit: StaffDocumentShareRateLimitService,
  ) {}

  @Post('session')
  async exchangeSession(
    @Body() dto: ExchangeStaffDocumentShareSessionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    applyPublicStaffDocumentShareHeaders(res);
    await this.rateLimit.assertExchangeAllowed(resolveClientIp(req));
    return this.publicShare.exchangeSession(dto.slug, dto.token, req, res);
  }

  @Get()
  async getMetadata(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    applyPublicStaffDocumentShareHeaders(res);
    await this.rateLimit.assertMetadataAllowed(resolveClientIp(req));
    return this.publicShare.getMetadata(req);
  }

  @Get(':documentType/files/:fileId/content')
  async streamFile(
    @Req() req: Request,
    @Res() res: Response,
    @Param('documentType') documentType: string,
    @Param('fileId') fileId: string,
  ) {
    applyPublicStaffDocumentShareHeaders(res);
    await this.rateLimit.assertFileStreamAllowed(resolveClientIp(req));

    const result = await this.publicShare.streamFile(req, documentType, fileId);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', result.contentDisposition);

    result.body.on('error', () => {
      if (!res.headersSent) {
        res.status(503).json({ message: 'Document is temporarily unavailable.', statusCode: 503 });
        return;
      }
      res.destroy();
    });

    result.body.pipe(res);
  }
}

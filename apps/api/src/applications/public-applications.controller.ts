import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/session.guard';
import {
  NETWORK_SUBMIT_MAX_FILES,
  NETWORK_SUBMIT_MAX_FILE_BYTES,
  NETWORK_SUBMIT_MAX_TOTAL_BYTES,
} from './network-submit.constants';
import { NetworkApplicationApiKeyGuard } from './network-application-api-key.guard';
import { NetworkApplicationsSubmitService } from './network-applications-submit.service';

@ApiTags('public-applications')
@Controller('v1/public/applications')
export class PublicApplicationsController {
  constructor(private readonly submitService: NetworkApplicationsSubmitService) {}

  @Public()
  @UseGuards(NetworkApplicationApiKeyGuard)
  @Post('network')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        files: NETWORK_SUBMIT_MAX_FILES,
        fileSize: NETWORK_SUBMIT_MAX_FILE_BYTES,
        fieldSize: 512 * 1024,
        fields: 2,
      },
    }),
  )
  submitNetworkApplication(
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const applicationJson = this.readApplicationField(req);
    const clientIp = this.resolveClientIp(req);
    return this.submitService.submit(applicationJson, files ?? [], clientIp);
  }

  private readApplicationField(req: Request): string {
    const body = req.body as Record<string, unknown> | undefined;
    const value = body?.application;
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException('application field is required.');
    }
    if (value.length > NETWORK_SUBMIT_MAX_TOTAL_BYTES) {
      throw new BadRequestException('application payload is too large.');
    }
    return value;
  }

  private resolveClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  }
}

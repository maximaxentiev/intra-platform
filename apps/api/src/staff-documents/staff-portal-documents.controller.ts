import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Body,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../auth/session.guard';
import { CarerPortalEnabledGuard } from '../staff-portal/carer-portal-enabled.guard';
import { CurrentStaff, StaffSessionGuard } from '../staff-portal/staff-session.guard';
import type { StaffSessionPayload } from '../staff-portal/staff-session.service';
import {
  mapStaffDocumentMulterError,
  parseRetainFileIds,
  pickNewDocumentFiles,
  staffDocumentUploadInterceptor,
} from './staff-document-multipart.util';
import { StaffDocumentsService } from './staff-documents.service';
import { SetStaffDocumentRemindersDto } from './dto/staff-documents.dto';

@Public()
@UseGuards(CarerPortalEnabledGuard, StaffSessionGuard)
@ApiTags('staff-portal')
@Controller('staff-portal/documents')
export class StaffPortalDocumentsController {
  constructor(private readonly documents: StaffDocumentsService) {}

  @Get()
  list(@CurrentStaff() session: StaffSessionPayload) {
    return this.documents.getCarerDocuments(session);
  }

  @Post('complete-step-2')
  completeStep2(@CurrentStaff() session: StaffSessionPayload) {
    return this.documents.completeStep2(session);
  }

  @Patch(':documentType/reminders')
  setReminders(
    @CurrentStaff() session: StaffSessionPayload,
    @Param('documentType') documentType: string,
    @Body() dto: SetStaffDocumentRemindersDto,
  ) {
    return this.documents.setRemindersCarer(session, documentType, dto.enabled);
  }

  @Post(':documentType')
  @UseInterceptors(staffDocumentUploadInterceptor())
  async saveCategory(
    @CurrentStaff() session: StaffSessionPayload,
    @Param('documentType') documentType: string,
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      const body = req.body as Record<string, unknown>;
      return await this.documents.saveCategoryCarer(
        session,
        documentType,
        {
          processedDate: typeof body.processedDate === 'string' ? body.processedDate : undefined,
          expiryDate: typeof body.expiryDate === 'string' ? body.expiryDate : undefined,
          retainFileIds: parseRetainFileIds(body.retainFileIds),
        },
        pickNewDocumentFiles(files),
      );
    } catch (err) {
      mapStaffDocumentMulterError(err);
    }
  }

  @Delete(':documentType')
  clearCategory(
    @CurrentStaff() session: StaffSessionPayload,
    @Param('documentType') documentType: string,
  ) {
    return this.documents.clearCategoryCarer(session, documentType);
  }

  @Get(':documentType/files/:fileId/content')
  async streamFile(
    @CurrentStaff() session: StaffSessionPayload,
    @Param('documentType') documentType: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const result = await this.documents.streamCarerFile(session, documentType, fileId);

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
}

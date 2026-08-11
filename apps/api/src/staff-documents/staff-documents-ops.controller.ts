import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionPayload } from '../auth/session.service';
import { FlagStaffDocumentIssueDto, SetStaffDocumentRemindersDto } from './dto/staff-documents.dto';
import {
  mapStaffDocumentMulterError,
  parseRetainFileIds,
  pickNewDocumentFiles,
  staffDocumentUploadInterceptor,
} from './staff-document-multipart.util';
import { StaffDocumentsService } from './staff-documents.service';

@ApiTags('staff')
@Controller('staff')
export class StaffDocumentsOpsController {
  constructor(private readonly documents: StaffDocumentsService) {}

  @Get(':staffId/documents')
  list(@Param('staffId') staffId: string) {
    return this.documents.getOpsDocuments(staffId);
  }

  @Post(':staffId/documents/:documentType')
  @UseInterceptors(staffDocumentUploadInterceptor())
  async saveCategory(
    @Param('staffId') staffId: string,
    @Param('documentType') documentType: string,
    @CurrentUser() user: SessionPayload,
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      const body = req.body as Record<string, unknown>;
      return await this.documents.saveCategoryOps(
        staffId,
        user.userId,
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

  @Post(':staffId/documents/:documentType/submissions/:submissionId/approve')
  approve(
    @Param('staffId') staffId: string,
    @Param('documentType') documentType: string,
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.documents.approveSubmission(staffId, user.userId, documentType, submissionId);
  }

  @Post(':staffId/documents/:documentType/submissions/:submissionId/flag-issue')
  flagIssue(
    @Param('staffId') staffId: string,
    @Param('documentType') documentType: string,
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: SessionPayload,
    @Body() dto: FlagStaffDocumentIssueDto,
  ) {
    return this.documents.flagIssue(staffId, user.userId, documentType, submissionId, dto.issueNote);
  }

  @Patch(':staffId/documents/:documentType/reminders')
  setReminders(
    @Param('staffId') staffId: string,
    @Param('documentType') documentType: string,
    @CurrentUser() user: SessionPayload,
    @Body() dto: SetStaffDocumentRemindersDto,
  ) {
    return this.documents.setReminders(staffId, user.userId, documentType, dto.enabled);
  }

  @Delete(':staffId/documents/:documentType')
  clearCategory(
    @Param('staffId') staffId: string,
    @Param('documentType') documentType: string,
    @CurrentUser() user: SessionPayload,
  ) {
    return this.documents.clearCategoryOps(staffId, user.userId, documentType);
  }

  @Get(':staffId/documents/:documentType/files/:fileId/content')
  async streamFile(
    @Param('staffId') staffId: string,
    @Param('documentType') documentType: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const result = await this.documents.streamOpsFile(staffId, documentType, fileId);

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

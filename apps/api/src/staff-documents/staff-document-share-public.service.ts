import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { Request, Response } from 'express';
import {
  buildContentDisposition,
  isInlinePreviewContentType,
} from '../applications/application-document-content.util';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  staff,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
  type StaffDocumentFile,
} from '../db/schema';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from '../staff-portal/staff-portal-audit.service';
import { StorageNotConfiguredError, StorageOperationError, StorageService } from '../storage/storage.service';
import type {
  ExchangeStaffDocumentShareSessionResponseDto,
  PublicStaffDocumentShareMetadataDto,
} from './dto/staff-document-share-public.dto';
import {
  buildCategoryComplianceMap,
  buildComplianceInputsForStaff,
  type StaffDocumentCategoryCompliance,
} from './staff-document-compliance.util';
import {
  isStaffDocumentPublicShareType,
  STAFF_DOCUMENT_TYPE_VALUES,
  type StaffDocumentType,
} from './staff-document.constants';
import { StaffDocumentSharePublicAuthService } from './staff-document-share-public-auth.service';
import { isPubliclyShareableCategory } from './staff-document-share-public-eligibility.util';
import { mapPublicStaffDocumentShareMetadata } from './staff-document-share-public.mapper';
import { shareTokenRotationEpochFromPersisted } from './staff-document-share-epoch.util';
import { StaffDocumentShareService } from './staff-document-share.service';
import {
  hashPublicShareDiagId,
  logPublicShareFileAuthDecision,
} from './staff-document-share-public-file-auth-diag.util';
import {
  assertStaffDocumentType,
  StaffDocumentValidationError,
} from './staff-document-validation.util';

function normalizePublicShareFileId(fileId: string): string {
  return fileId.trim().toLowerCase();
}

function findPublicShareFile(
  files: StaffDocumentFile[],
  fileId: string,
): StaffDocumentFile | undefined {
  const normalized = normalizePublicShareFileId(fileId);
  return files.find((file) => normalizePublicShareFileId(file.id) === normalized);
}

export type PublicStaffDocumentStreamResult = {
  body: NodeJS.ReadableStream;
  contentType: string;
  contentDisposition: string;
};

@Injectable()
export class StaffDocumentSharePublicService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly share: StaffDocumentShareService,
    private readonly auth: StaffDocumentSharePublicAuthService,
    private readonly storage: StorageService,
    private readonly audit: StaffPortalAuditService,
  ) {}

  async exchangeSession(
    slug: string,
    token: string,
    req: Request,
    res: Response,
  ): Promise<ExchangeStaffDocumentShareSessionResponseDto> {
    try {
      const normalizedSlug = slug.trim();
      const normalizedToken = token.trim();
      if (!normalizedSlug || !normalizedToken) {
        throw this.auth.unavailable();
      }

      const rows = await this.db
        .select()
        .from(staff)
        .where(eq(staff.documentSlug, normalizedSlug))
        .limit(1);
      const row = rows[0];
      if (!row || !this.auth.isActiveShareState(row)) {
        throw this.auth.unavailable();
      }

      if (
        !this.share.verifyShareToken(row.id, this.auth.shareFields(row), normalizedToken)
      ) {
        throw this.auth.unavailable();
      }

      const tokenIssuedAt = shareTokenRotationEpochFromPersisted(row.documentShareTokenCreatedAt);
      if (tokenIssuedAt === null) {
        throw this.auth.unavailable();
      }

      const sessionValue = this.share.signShareSession(row.id, tokenIssuedAt);
      this.auth.setSessionCookie(res, sessionValue);

      await this.audit.record({
        staffId: row.id,
        actorUserId: null,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.sharePageViewed,
        detail: { action: 'share_page_viewed' },
      });

      return { ok: true };
    } catch (err) {
      this.auth.clearSessionCookie(res);
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw this.auth.unavailable();
    }
  }

  async getMetadata(req: Request): Promise<PublicStaffDocumentShareMetadataDto> {
    const ctx = await this.auth.authorizeFromRequest(req);
    const snapshot = await this.loadPublicShareSnapshot(ctx.staffId);

    return mapPublicStaffDocumentShareMetadata({
      staff: ctx.staff,
      categories: snapshot.categories,
      filesByType: snapshot.filesByType,
    });
  }

  async streamFile(
    req: Request,
    documentTypeRaw: string,
    fileIdRaw: string,
  ): Promise<PublicStaffDocumentStreamResult> {
    const routeDocumentType = documentTypeRaw.trim();
    const routeFileId = fileIdRaw.trim();
    const ctx = await this.auth.authorizeFromRequest(req, 'file_stream');

    let documentType: StaffDocumentType;
    try {
      documentType = assertStaffDocumentType(routeDocumentType);
    } catch (err) {
      if (err instanceof StaffDocumentValidationError) {
        logPublicShareFileAuthDecision('file_stream', 'document_type_invalid', {
          routeDocumentType,
          routeFileIdHash: hashPublicShareDiagId(routeFileId),
        });
      }
      throw err;
    }

    if (!isStaffDocumentPublicShareType(documentType)) {
      logPublicShareFileAuthDecision('file_stream', 'document_type_not_public', {
        routeDocumentType: documentType,
        routeFileIdHash: hashPublicShareDiagId(routeFileId),
      });
      throw this.auth.unavailable();
    }

    const snapshot = await this.loadPublicShareSnapshot(ctx.staffId);
    const categoryFiles = snapshot.filesByType.get(documentType) ?? [];
    const category = snapshot.categories.find((item) => item.documentType === documentType);
    if (!category) {
      logPublicShareFileAuthDecision('file_stream', 'category_missing', {
        routeDocumentType: documentType,
        routeFileIdHash: hashPublicShareDiagId(routeFileId),
        snapshotFileCount: categoryFiles.length,
        routeFileMatchedSnapshot: false,
      });
      throw this.auth.unavailable();
    }

    if (!isPubliclyShareableCategory(category)) {
      logPublicShareFileAuthDecision('file_stream', 'category_not_shareable', {
        routeDocumentType: documentType,
        routeFileIdHash: hashPublicShareDiagId(routeFileId),
        snapshotFileCount: categoryFiles.length,
        isSubmitted: category.isSubmitted,
        reviewStatus: category.reviewStatus,
        supersededAtPresent: category.supersededAt !== null,
        fileCount: category.fileCount,
        expiryDisplay: category.expiryDisplay,
        currentSubmissionIdHash: hashPublicShareDiagId(category.currentSubmissionId),
      });
      throw this.auth.unavailable();
    }

    const file = findPublicShareFile(categoryFiles, routeFileId);
    const routeFileMatchedSnapshot = Boolean(file);
    if (!file) {
      logPublicShareFileAuthDecision('file_stream', 'file_not_in_snapshot', {
        routeDocumentType: documentType,
        routeFileIdHash: hashPublicShareDiagId(routeFileId),
        snapshotFileCount: categoryFiles.length,
        routeFileMatchedSnapshot,
        currentSubmissionIdHash: hashPublicShareDiagId(category.currentSubmissionId),
      });
      throw this.auth.unavailable();
    }

    const submissionMatches =
      category.currentSubmissionId !== null &&
      normalizePublicShareFileId(file.submissionId) ===
        normalizePublicShareFileId(category.currentSubmissionId);
    if (!submissionMatches) {
      logPublicShareFileAuthDecision('file_stream', 'file_submission_mismatch', {
        routeDocumentType: documentType,
        routeFileIdHash: hashPublicShareDiagId(routeFileId),
        snapshotFileCount: categoryFiles.length,
        routeFileMatchedSnapshot,
        currentSubmissionIdHash: hashPublicShareDiagId(category.currentSubmissionId),
        matchedFileSubmissionIdHash: hashPublicShareDiagId(file.submissionId),
        submissionIdMatchesCurrent: submissionMatches,
      });
      throw this.auth.unavailable();
    }

    let streamResult;
    try {
      streamResult = await this.storage.getObjectStream(file.storageKey);
    } catch (err) {
      if (err instanceof StorageNotConfiguredError || err instanceof StorageOperationError) {
        logPublicShareFileAuthDecision('file_stream', 'storage_stream_failed', {
          routeDocumentType: documentType,
          routeFileIdHash: hashPublicShareDiagId(file.id),
          storageErrorType: err.constructor.name,
        });
        throw new ServiceUnavailableException('Document is temporarily unavailable.');
      }
      throw err;
    }

    logPublicShareFileAuthDecision('file_stream', 'file_stream_authorized', {
      routeDocumentType: documentType,
      routeFileIdHash: hashPublicShareDiagId(file.id),
      snapshotFileCount: categoryFiles.length,
      routeFileMatchedSnapshot: true,
      submissionIdMatchesCurrent: true,
    });

    await this.audit.record({
      staffId: ctx.staffId,
      actorUserId: null,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.sharedDocumentViewed,
      detail: {
        action: 'shared_document_viewed',
        documentType,
        fileId: file.id,
      },
    });

    const contentType = file.contentType || streamResult.contentType || 'application/octet-stream';
    const inline = isInlinePreviewContentType(contentType, file.originalFilename);

    return {
      body: streamResult.body,
      contentType,
      contentDisposition: buildContentDisposition(file.originalFilename, inline),
    };
  }

  private async loadPublicShareSnapshot(staffId: string): Promise<{
    categories: StaffDocumentCategoryCompliance[];
    filesByType: Map<StaffDocumentType, StaffDocumentFile[]>;
  }> {
    const categories = await this.loadCategoryCompliance(staffId);
    const filesByType = await this.loadCurrentFilesByType(staffId);
    return { categories, filesByType };
  }

  private async loadCategoryCompliance(staffId: string): Promise<StaffDocumentCategoryCompliance[]> {
    const sets = await this.db
      .select()
      .from(staffDocumentSets)
      .where(eq(staffDocumentSets.staffId, staffId));

    const currentSubmissionIds = sets
      .map((set) => set.currentSubmissionId)
      .filter((id): id is string => Boolean(id));

    const submissions =
      currentSubmissionIds.length > 0
        ? await this.db
            .select()
            .from(staffDocumentSubmissions)
            .where(inArray(staffDocumentSubmissions.id, currentSubmissionIds))
        : [];

    const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));

    const files =
      currentSubmissionIds.length > 0
        ? await this.db
            .select({ submissionId: staffDocumentFiles.submissionId })
            .from(staffDocumentFiles)
            .where(inArray(staffDocumentFiles.submissionId, currentSubmissionIds))
        : [];

    const fileCountBySubmission = new Map<string, number>();
    for (const file of files) {
      fileCountBySubmission.set(
        file.submissionId,
        (fileCountBySubmission.get(file.submissionId) ?? 0) + 1,
      );
    }

    const inputs = buildComplianceInputsForStaff(sets, submissionById, fileCountBySubmission);
    const map = buildCategoryComplianceMap(inputs);
    return STAFF_DOCUMENT_TYPE_VALUES.map((type) => map.get(type)!);
  }

  private async loadCurrentFilesByType(staffId: string): Promise<Map<StaffDocumentType, StaffDocumentFile[]>> {
    const sets = await this.db
      .select()
      .from(staffDocumentSets)
      .where(eq(staffDocumentSets.staffId, staffId));

    const result = new Map<StaffDocumentType, StaffDocumentFile[]>();
    for (const type of STAFF_DOCUMENT_TYPE_VALUES) {
      result.set(type, []);
    }

    for (const set of sets) {
      if (!set.currentSubmissionId || !isStaffDocumentPublicShareType(set.documentType)) {
        continue;
      }
      const submissionRows = await this.db
        .select()
        .from(staffDocumentSubmissions)
        .where(eq(staffDocumentSubmissions.id, set.currentSubmissionId))
        .limit(1);
      const submission = submissionRows[0];
      if (!submission || submission.supersededAt || submission.reviewStatus !== 'approved') {
        continue;
      }

      const rows = await this.db
        .select()
        .from(staffDocumentFiles)
        .where(eq(staffDocumentFiles.submissionId, set.currentSubmissionId));
      result.set(set.documentType, rows);
    }

    return result;
  }
}

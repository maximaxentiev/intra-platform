import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import {
  buildContentDisposition,
  isInlinePreviewContentType,
} from '../applications/application-document-content.util';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  staff,
  staffAccounts,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
  type StaffAccount,
  type StaffDocumentFile,
  type StaffDocumentSet,
  type StaffDocumentSubmission,
} from '../db/schema';
import { buildStaffDocumentFileKey } from '../storage/storage-key.util';
import {
  StorageNotConfiguredError,
  StorageOperationError,
  StorageService,
} from '../storage/storage.service';
import {
  STAFF_PORTAL_AUDIT_EVENTS,
  StaffPortalAuditService,
} from '../staff-portal/staff-portal-audit.service';
import { ONBOARDING_STEP } from '../staff-portal/staff-onboarding.util';
import type { StaffSessionPayload } from '../staff-portal/staff-session.service';
import {
  STAFF_DOCUMENT_TYPE_VALUES,
  type StaffDocumentListStatus,
  type StaffDocumentType,
} from './staff-document.constants';
import {
  buildCategoryComplianceMap,
  buildComplianceInputsForStaff,
  complianceForRequiredCategories,
  deriveStaffShiftDocumentGate,
  type StaffDocumentCategoryComplianceInput,
} from './staff-document-compliance.util';
import {
  assertProcessedDateNotInFuture,
  deriveVscExpiryDate,
  parseDateOnly,
} from './staff-document-dates.util';
import { validateStaffDocumentFileContent } from './staff-document-file-signature.util';
import {
  buildDocumentsListDto,
  mapStaffDocumentFile,
  type StaffDocumentFileDto,
  type StaffDocumentsListDto,
  type StaffDocumentsOpsListDto,
} from './staff-document.mapper';
import {
  assertStaffDocumentType,
  StaffDocumentValidationError,
  validateStaffDocumentSubmissionFiles,
} from './staff-document-validation.util';
import { DocumentExpiryReminderService } from './document-expiry-reminder.service';

export type StaffDocumentStreamResult = {
  body: import('stream').Readable;
  contentType: string;
  contentDisposition: string;
};

type RetainedFileRef = Pick<
  StaffDocumentFile,
  'id' | 'originalFilename' | 'contentType' | 'byteSize' | 'storageKey' | 'checksumSha256'
>;

type CategorySaveActor =
  | { kind: 'carer'; staffId: string; staffAccountId: string }
  | { kind: 'ops_user'; staffId: string; userId: string };

@Injectable()
export class StaffDocumentsService {
  private readonly logger = new Logger(StaffDocumentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly audit: StaffPortalAuditService,
    private readonly documentReminders: DocumentExpiryReminderService,
  ) {}

  async getCarerDocuments(session: StaffSessionPayload): Promise<StaffDocumentsListDto> {
    const account = await this.loadActiveAccount(session);
    return this.buildDocumentsListForStaff(account);
  }

  async getOpsDocuments(staffId: string): Promise<StaffDocumentsOpsListDto> {
    await this.assertStaffExists(staffId);
    const account = await this.loadAccountByStaffId(staffId);
    const list = await this.buildDocumentsListForStaffId(staffId, account);
    return { staffId, ...list };
  }

  /** Batch aggregate document status for staff list — 3 queries total, no per-staff N+1. */
  async getDocumentStatusMapForStaffIds(
    staffIds: string[],
  ): Promise<Map<string, StaffDocumentListStatus>> {
    const result = new Map<string, StaffDocumentListStatus>();
    if (staffIds.length === 0) return result;

    const sets = await this.db
      .select()
      .from(staffDocumentSets)
      .where(inArray(staffDocumentSets.staffId, staffIds));

    const setsByStaff = new Map<string, StaffDocumentSet[]>();
    for (const set of sets) {
      const list = setsByStaff.get(set.staffId) ?? [];
      list.push(set);
      setsByStaff.set(set.staffId, list);
    }

    const currentSubmissionIds = [
      ...new Set(
        sets.map((s) => s.currentSubmissionId).filter((id): id is string => Boolean(id)),
      ),
    ];

    const submissions =
      currentSubmissionIds.length > 0
        ? await this.db
            .select()
            .from(staffDocumentSubmissions)
            .where(inArray(staffDocumentSubmissions.id, currentSubmissionIds))
        : [];

    const submissionById = new Map(submissions.map((s) => [s.id, s]));

    const fileRows =
      currentSubmissionIds.length > 0
        ? await this.db
            .select({ submissionId: staffDocumentFiles.submissionId })
            .from(staffDocumentFiles)
            .where(inArray(staffDocumentFiles.submissionId, currentSubmissionIds))
        : [];

    const fileCountBySubmission = new Map<string, number>();
    for (const row of fileRows) {
      fileCountBySubmission.set(
        row.submissionId,
        (fileCountBySubmission.get(row.submissionId) ?? 0) + 1,
      );
    }

    for (const staffId of staffIds) {
      const staffSets = setsByStaff.get(staffId) ?? [];
      const inputs = buildComplianceInputsForStaff(staffSets, submissionById, fileCountBySubmission);
      result.set(staffId, deriveStaffShiftDocumentGate(inputs).documentStatus);
    }

    return result;
  }

  async saveCategoryCarer(
    session: StaffSessionPayload,
    documentTypeRaw: string,
    fields: { processedDate?: string; expiryDate?: string; retainFileIds: string[] },
    uploadedFiles: Express.Multer.File[],
  ): Promise<StaffDocumentsListDto> {
    this.assertStorageConfigured();
    const account = await this.loadActiveAccount(session);
    await this.saveCategory(
      { kind: 'carer', staffId: account.staffId, staffAccountId: account.id },
      documentTypeRaw,
      fields,
      uploadedFiles,
    );
    return this.buildDocumentsListForStaff(account);
  }

  async saveCategoryOps(
    staffId: string,
    userId: string,
    documentTypeRaw: string,
    fields: { processedDate?: string; expiryDate?: string; retainFileIds: string[] },
    uploadedFiles: Express.Multer.File[],
  ): Promise<StaffDocumentsOpsListDto> {
    this.assertStorageConfigured();
    await this.assertStaffExists(staffId);
    await this.saveCategory(
      { kind: 'ops_user', staffId, userId },
      documentTypeRaw,
      fields,
      uploadedFiles,
    );
    const account = await this.loadAccountByStaffId(staffId);
    const list = await this.buildDocumentsListForStaffId(staffId, account);
    return { staffId, ...list };
  }

  async clearCategoryCarer(
    session: StaffSessionPayload,
    documentTypeRaw: string,
  ): Promise<StaffDocumentsListDto> {
    const account = await this.loadActiveAccount(session);
    await this.clearCurrentSubmission(
      account.staffId,
      documentTypeRaw,
      { kind: 'carer', staffAccountId: account.id },
    );
    return this.buildDocumentsListForStaff(account);
  }

  async clearCategoryOps(
    staffId: string,
    userId: string,
    documentTypeRaw: string,
  ): Promise<StaffDocumentsOpsListDto> {
    await this.assertStaffExists(staffId);
    await this.clearCurrentSubmission(staffId, documentTypeRaw, {
      kind: 'ops_user',
      userId,
    });
    const account = await this.loadAccountByStaffId(staffId);
    const list = await this.buildDocumentsListForStaffId(staffId, account);
    return { staffId, ...list };
  }

  async streamCarerFile(
    session: StaffSessionPayload,
    documentTypeRaw: string,
    fileId: string,
  ): Promise<StaffDocumentStreamResult> {
    const account = await this.loadActiveAccount(session);
    return this.streamCurrentFile(account.staffId, documentTypeRaw, fileId);
  }

  async streamOpsFile(
    staffId: string,
    documentTypeRaw: string,
    fileId: string,
  ): Promise<StaffDocumentStreamResult> {
    await this.assertStaffExists(staffId);
    return this.streamCurrentFile(staffId, documentTypeRaw, fileId);
  }

  async approveSubmission(
    staffId: string,
    userId: string,
    documentTypeRaw: string,
    submissionId: string,
  ): Promise<StaffDocumentsOpsListDto> {
    const documentType = assertStaffDocumentType(documentTypeRaw);
    await this.assertStaffExists(staffId);

    const ctx = await this.loadSetContext(staffId, documentType);
    if (!ctx.set) throw new NotFoundException('Document set not found.');
    if (!ctx.currentSubmission) throw new NotFoundException('No current submission.');
    if (ctx.set.currentSubmissionId !== submissionId) {
      throw new ConflictException('Submission is no longer current.');
    }
    if (ctx.currentSubmission.id !== submissionId) {
      throw new ConflictException('Submission is no longer current.');
    }
    if (!ctx.files.length) {
      throw new BadRequestException('Submission has no files.');
    }

    this.assertSubmissionDatesValid(documentType, ctx.currentSubmission);

    const now = new Date();
    const accountCtx = await this.loadReminderAccountContext(staffId);
    let scheduledIds: string[] = [];

    await this.db.transaction(async (tx) => {
      await tx
        .update(staffDocumentSubmissions)
        .set({
          reviewStatus: 'approved',
          reviewedAt: now,
          reviewedByUserId: userId,
          issueNote: '',
          updatedAt: now,
        })
        .where(eq(staffDocumentSubmissions.id, submissionId));

      scheduledIds = await this.documentReminders.syncRemindersForSet(
        {
          staffId,
          documentSetId: ctx.set!.id,
          documentType,
          submission: {
            id: submissionId,
            reviewStatus: 'approved',
            expiryDate: ctx.currentSubmission!.expiryDate,
            supersededAt: ctx.currentSubmission!.supersededAt,
          },
          set: ctx.set!,
          ...accountCtx,
        },
        tx,
        now,
      );
    });

    await this.documentReminders.enqueueScheduledIds(scheduledIds);

    await this.audit.record({
      staffId,
      actorUserId: userId,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.opsDocumentApproved,
      detail: { documentType, submissionId, source: 'ops' },
    });

    const account = await this.loadAccountByStaffId(staffId);
    const list = await this.buildDocumentsListForStaffId(staffId, account);
    return { staffId, ...list };
  }

  async flagIssue(
    staffId: string,
    userId: string,
    documentTypeRaw: string,
    submissionId: string,
    issueNoteRaw: string,
  ): Promise<StaffDocumentsOpsListDto> {
    const documentType = assertStaffDocumentType(documentTypeRaw);
    const issueNote = issueNoteRaw.trim();
    if (!issueNote) {
      throw new BadRequestException('issueNote is required.');
    }
    if (issueNote.length > 2000) {
      throw new BadRequestException('issueNote is too long.');
    }

    await this.assertStaffExists(staffId);
    const ctx = await this.loadSetContext(staffId, documentType);
    if (!ctx.set || !ctx.currentSubmission) throw new NotFoundException('No current submission.');
    if (ctx.set.currentSubmissionId !== submissionId) {
      throw new ConflictException('Submission is no longer current.');
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(staffDocumentSubmissions)
        .set({
          reviewStatus: 'issue_flagged',
          issueNote,
          reviewedAt: now,
          reviewedByUserId: userId,
          updatedAt: now,
        })
        .where(eq(staffDocumentSubmissions.id, submissionId));

      await this.documentReminders.cancelPendingForSubmission(submissionId, tx);
    });

    await this.audit.record({
      staffId,
      actorUserId: userId,
      eventType: STAFF_PORTAL_AUDIT_EVENTS.opsDocumentIssueFlagged,
      detail: { documentType, submissionId, source: 'ops' },
    });

    const account = await this.loadAccountByStaffId(staffId);
    const list = await this.buildDocumentsListForStaffId(staffId, account);
    return { staffId, ...list };
  }

  async completeStep2(session: StaffSessionPayload): Promise<StaffDocumentsListDto> {
    const account = await this.loadActiveAccount(session);
    if (!account.profileCompletedAt) {
      throw new BadRequestException('Complete your profile before submitting documents.');
    }

    const gate = await this.loadComplianceGate(account.staffId);
    if (!this.canCompleteStep2(gate.inputs, account)) {
      throw new BadRequestException(
        'Required documents must be submitted with valid dates and must not be expired.',
      );
    }

    const now = new Date();
    if (!account.documentsCompletedAt) {
      await this.db
        .update(staffAccounts)
        .set({
          documentsCompletedAt: now,
          onboardingStep: Math.max(account.onboardingStep, ONBOARDING_STEP.availability),
          updatedAt: now,
        })
        .where(eq(staffAccounts.id, account.id));

      await this.audit.record({
        staffId: account.staffId,
        staffAccountId: account.id,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.onboardingStep2Completed,
        detail: { source: 'carer_portal' },
      });
    }

    const refreshed = await this.loadActiveAccount(session);
    return this.buildDocumentsListForStaff(refreshed);
  }

  private async saveCategory(
    actor: CategorySaveActor,
    documentTypeRaw: string,
    fields: { processedDate?: string; expiryDate?: string; retainFileIds: string[] },
    uploadedFiles: Express.Multer.File[],
  ): Promise<void> {
    const documentType = assertStaffDocumentType(documentTypeRaw);
    this.validateCategoryFields(documentType, fields);

    const newFiles = this.prepareNewFiles(uploadedFiles);
    const ctx = await this.loadSetContext(actor.staffId, documentType);
    const retained = this.resolveRetainedFiles(ctx.files, fields.retainFileIds, actor.staffId);

    if (!ctx.currentSubmission && fields.retainFileIds.length > 0) {
      throw new BadRequestException('retainFileIds must be empty when no current submission exists.');
    }
    if (!ctx.currentSubmission && newFiles.length === 0) {
      throw new BadRequestException('At least one file is required.');
    }

    const combinedCandidates = [
      ...retained.map((f) => ({
        originalFilename: f.originalFilename,
        contentType: f.contentType,
        byteSize: f.byteSize,
      })),
      ...newFiles.map((f) => ({
        originalFilename: f.originalname,
        contentType: f.mimetype,
        byteSize: f.buffer.length,
      })),
    ];
    validateStaffDocumentSubmissionFiles(combinedCandidates);

    const submissionId = randomUUID();
    const hadCurrent = Boolean(ctx.currentSubmission);
    const uploadedKeys: string[] = [];
    const newFileRows: Array<{
      id: string;
      originalFilename: string;
      contentType: string;
      byteSize: number;
      storageKey: string;
      checksumSha256: string;
    }> = [];

    try {
      for (const file of newFiles) {
        const fileId = randomUUID();
        const storageKey = buildStaffDocumentFileKey({
          staffId: actor.staffId,
          submissionId,
          fileId,
          originalFilename: file.originalname,
        });
        await this.storage.uploadObject({
          key: storageKey,
          body: file.buffer,
          contentType: file.mimetype,
        });
        uploadedKeys.push(storageKey);
        newFileRows.push({
          id: fileId,
          originalFilename: file.originalname,
          contentType: file.mimetype,
          byteSize: file.buffer.length,
          storageKey,
          checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
        });
      }

      const dates = this.resolveSubmissionDates(documentType, fields);
      const now = new Date();

      await this.db.transaction(async (tx) => {
        let setId = ctx.set?.id;
        if (!setId) {
          const inserted = await tx
            .insert(staffDocumentSets)
            .values({
              staffId: actor.staffId,
              documentType,
              remindersEnabled: true,
            })
            .returning({ id: staffDocumentSets.id });
          setId = inserted[0]!.id;
        }

        const submissionValues = {
          id: submissionId,
          documentSetId: setId,
          reviewStatus: 'pending_review' as const,
          processedDate: dates.processedDate,
          expiryDate: dates.expiryDate,
          submittedAt: now,
          submittedByActorType: actor.kind,
          submittedByStaffAccountId: actor.kind === 'carer' ? actor.staffAccountId : null,
          submittedByUserId: actor.kind === 'ops_user' ? actor.userId : null,
          issueNote: '',
        };

        await tx.insert(staffDocumentSubmissions).values(submissionValues);

        const allFileRows = [
          ...retained.map((f) => ({
            submissionId,
            originalFilename: f.originalFilename,
            contentType: f.contentType,
            byteSize: f.byteSize,
            storageKey: f.storageKey,
            checksumSha256: f.checksumSha256,
          })),
          ...newFileRows.map((f) => ({
            submissionId,
            id: f.id,
            originalFilename: f.originalFilename,
            contentType: f.contentType,
            byteSize: f.byteSize,
            storageKey: f.storageKey,
            checksumSha256: f.checksumSha256,
          })),
        ];

        if (allFileRows.length) {
          await tx.insert(staffDocumentFiles).values(allFileRows);
        }

        if (ctx.currentSubmission) {
          await tx
            .update(staffDocumentSubmissions)
            .set({ supersededAt: now, updatedAt: now })
            .where(eq(staffDocumentSubmissions.id, ctx.currentSubmission.id));
          await this.documentReminders.cancelPendingForSubmission(ctx.currentSubmission.id, tx);
        }

        await tx
          .update(staffDocumentSets)
          .set({ currentSubmissionId: submissionId, updatedAt: now })
          .where(eq(staffDocumentSets.id, setId));
      });
    } catch (err) {
      await this.compensateUploadedKeys(uploadedKeys);
      throw err;
    }

    const eventType =
      actor.kind === 'carer'
        ? hadCurrent
          ? STAFF_PORTAL_AUDIT_EVENTS.carerDocumentReplaced
          : STAFF_PORTAL_AUDIT_EVENTS.carerDocumentSubmitted
        : hadCurrent
          ? STAFF_PORTAL_AUDIT_EVENTS.opsDocumentReplaced
          : STAFF_PORTAL_AUDIT_EVENTS.opsDocumentSubmitted;

    await this.audit.record({
      staffId: actor.staffId,
      staffAccountId: actor.kind === 'carer' ? actor.staffAccountId : null,
      actorUserId: actor.kind === 'ops_user' ? actor.userId : null,
      eventType,
      detail: {
        documentType,
        submissionId,
        fileCount: combinedCandidates.length,
        byteSize: combinedCandidates.reduce((sum, f) => sum + f.byteSize, 0),
        source: actor.kind === 'carer' ? 'carer_portal' : 'ops',
      },
    });
  }

  private async clearCurrentSubmission(
    staffId: string,
    documentTypeRaw: string,
    actor:
      | { kind: 'carer'; staffAccountId: string }
      | { kind: 'ops_user'; userId: string },
  ): Promise<void> {
    const documentType = assertStaffDocumentType(documentTypeRaw);
    const ctx = await this.loadSetContext(staffId, documentType);
    if (!ctx.set || !ctx.currentSubmission) {
      throw new NotFoundException('No current submission to clear.');
    }

    const now = new Date();
    const submissionId = ctx.currentSubmission!.id;
    await this.db.transaction(async (tx) => {
      await tx
        .update(staffDocumentSubmissions)
        .set({ supersededAt: now, updatedAt: now })
        .where(eq(staffDocumentSubmissions.id, submissionId));

      await tx
        .update(staffDocumentSets)
        .set({ currentSubmissionId: null, updatedAt: now })
        .where(eq(staffDocumentSets.id, ctx.set!.id));

      await this.documentReminders.cancelPendingForSubmission(submissionId, tx);
    });

    const eventType =
      actor.kind === 'carer'
        ? STAFF_PORTAL_AUDIT_EVENTS.carerDocumentCleared
        : STAFF_PORTAL_AUDIT_EVENTS.opsDocumentCleared;

    await this.audit.record({
      staffId,
      staffAccountId: actor.kind === 'carer' ? actor.staffAccountId : null,
      actorUserId: actor.kind === 'ops_user' ? actor.userId : null,
      eventType,
      detail: { documentType, submissionId: ctx.currentSubmission.id, source: actor.kind },
    });
  }

  private async streamCurrentFile(
    staffId: string,
    documentTypeRaw: string,
    fileId: string,
  ): Promise<StaffDocumentStreamResult> {
    const documentType = assertStaffDocumentType(documentTypeRaw);
    const ctx = await this.loadSetContext(staffId, documentType);
    if (!ctx.set?.currentSubmissionId) throw new NotFoundException('File not found.');

    const file = ctx.files.find((f) => f.id === fileId);
    if (!file) throw new NotFoundException('File not found.');

    let streamResult;
    try {
      streamResult = await this.storage.getObjectStream(file.storageKey);
    } catch (err) {
      if (err instanceof StorageNotConfiguredError || err instanceof StorageOperationError) {
        throw new ServiceUnavailableException('Document is temporarily unavailable.');
      }
      throw err;
    }

    const contentType = file.contentType || streamResult.contentType || 'application/octet-stream';
    const inline = isInlinePreviewContentType(contentType, file.originalFilename);

    return {
      body: streamResult.body,
      contentType,
      contentDisposition: buildContentDisposition(file.originalFilename, inline),
    };
  }

  private async buildDocumentsListForStaff(account: StaffAccount): Promise<StaffDocumentsListDto> {
    return this.buildDocumentsListForStaffId(account.staffId, account);
  }

  private async buildDocumentsListForStaffId(
    staffId: string,
    account: StaffAccount | null,
  ): Promise<StaffDocumentsListDto> {
    const [gate, filesByType, issueNotes, staffRow] = await Promise.all([
      this.loadComplianceGate(staffId),
      this.loadCurrentFilesByType(staffId),
      this.loadIssueNotesByType(staffId),
      this.db.select({ role: staff.role }).from(staff).where(eq(staff.id, staffId)).limit(1),
    ]);

    return buildDocumentsListDto({
      staffRole: staffRow[0]?.role ?? '',
      categories: gate.allCategories,
      filesByType,
      issueNotesByType: issueNotes,
      documentsCompletedAt: account?.documentsCompletedAt ?? null,
      onboardingStep: account?.onboardingStep ?? 1,
      canCompleteStep2: account ? this.canCompleteStep2(gate.inputs, account) : false,
      gate,
    });
  }

  private canCompleteStep2(
    inputs: StaffDocumentCategoryComplianceInput[],
    account: StaffAccount,
  ): boolean {
    if (!account.profileCompletedAt) return false;

    const required = complianceForRequiredCategories(inputs);
    for (const category of required) {
      if (!category.isSubmitted || category.fileCount < 1) return false;
      if (category.documentType === 'vulnerable_sector_check' && !category.processedDate) {
        return false;
      }
      if (category.documentType === 'first_aid_cpr' && !category.expiryDate) return false;
      if (
        (category.documentType === 'vulnerable_sector_check' ||
          category.documentType === 'first_aid_cpr') &&
        category.expiryDisplay === 'expired'
      ) {
        return false;
      }
    }
    return true;
  }

  private async loadComplianceGate(staffId: string) {
    const inputs = await this.loadComplianceInputs(staffId);
    const gate = deriveStaffShiftDocumentGate(inputs);
    const map = buildCategoryComplianceMap(inputs);
    const allCategories = STAFF_DOCUMENT_TYPE_VALUES.map((type) => map.get(type)!);
    return { ...gate, allCategories, inputs };
  }

  private async loadComplianceInputs(staffId: string): Promise<StaffDocumentCategoryComplianceInput[]> {
    const sets = await this.db
      .select()
      .from(staffDocumentSets)
      .where(eq(staffDocumentSets.staffId, staffId));

    const currentSubmissionIds = sets
      .map((s) => s.currentSubmissionId)
      .filter((id): id is string => Boolean(id));

    const submissions =
      currentSubmissionIds.length > 0
        ? await this.db
            .select()
            .from(staffDocumentSubmissions)
            .where(inArray(staffDocumentSubmissions.id, currentSubmissionIds))
        : [];

    const submissionById = new Map(submissions.map((s) => [s.id, s]));

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

    return buildComplianceInputsForStaff(sets, submissionById, fileCountBySubmission);
  }

  private async loadCurrentFilesByType(staffId: string): Promise<Map<StaffDocumentType, StaffDocumentFileDto[]>> {
    const sets = await this.db
      .select()
      .from(staffDocumentSets)
      .where(eq(staffDocumentSets.staffId, staffId));

    const result = new Map<StaffDocumentType, StaffDocumentFileDto[]>();
    for (const type of STAFF_DOCUMENT_TYPE_VALUES) {
      result.set(type, []);
    }

    for (const set of sets) {
      if (!set.currentSubmissionId) continue;
      const rows = await this.db
        .select()
        .from(staffDocumentFiles)
        .where(eq(staffDocumentFiles.submissionId, set.currentSubmissionId));
      result.set(set.documentType, rows.map(mapStaffDocumentFile));
    }

    return result;
  }

  private async loadIssueNotesByType(staffId: string): Promise<Map<StaffDocumentType, string>> {
    const sets = await this.db
      .select()
      .from(staffDocumentSets)
      .where(eq(staffDocumentSets.staffId, staffId));

    const notes = new Map<StaffDocumentType, string>();
    for (const set of sets) {
      if (!set.currentSubmissionId) continue;
      const rows = await this.db
        .select({ issueNote: staffDocumentSubmissions.issueNote, reviewStatus: staffDocumentSubmissions.reviewStatus })
        .from(staffDocumentSubmissions)
        .where(eq(staffDocumentSubmissions.id, set.currentSubmissionId))
        .limit(1);
      const row = rows[0];
      if (row?.reviewStatus === 'issue_flagged') {
        notes.set(set.documentType, row.issueNote);
      }
    }
    return notes;
  }

  private async loadSetContext(staffId: string, documentType: StaffDocumentType) {
    const setRows = await this.db
      .select()
      .from(staffDocumentSets)
      .where(
        and(
          eq(staffDocumentSets.staffId, staffId),
          eq(staffDocumentSets.documentType, documentType),
        ),
      )
      .limit(1);
    const set = setRows[0] ?? null;

    let currentSubmission: StaffDocumentSubmission | null = null;
    let files: StaffDocumentFile[] = [];

    if (set?.currentSubmissionId) {
      const subRows = await this.db
        .select()
        .from(staffDocumentSubmissions)
        .where(eq(staffDocumentSubmissions.id, set.currentSubmissionId))
        .limit(1);
      currentSubmission = subRows[0] ?? null;
      if (currentSubmission && !currentSubmission.supersededAt) {
        files = await this.db
          .select()
          .from(staffDocumentFiles)
          .where(eq(staffDocumentFiles.submissionId, currentSubmission.id));
      }
    }

    return { set, currentSubmission, files };
  }

  private resolveRetainedFiles(
    currentFiles: StaffDocumentFile[],
    retainFileIds: string[],
    staffId: string,
  ): RetainedFileRef[] {
    if (!retainFileIds.length) return [];

    const byId = new Map(currentFiles.map((f) => [f.id, f]));
    const retained: RetainedFileRef[] = [];

    for (const id of retainFileIds) {
      const file = byId.get(id);
      if (!file) {
        throw new BadRequestException(
          'retainFileIds may only reference files from the current submission.',
        );
      }
      if (!file.storageKey.startsWith(`staff/${staffId}/`)) {
        throw new BadRequestException('Invalid retained file reference.');
      }
      retained.push(file);
    }

    return retained;
  }

  private prepareNewFiles(uploadedFiles: Express.Multer.File[]): Express.Multer.File[] {
    const files = uploadedFiles.filter((f) => f?.buffer?.length);
    for (const file of files) {
      try {
        validateStaffDocumentFileContent({
          originalFilename: file.originalname,
          contentType: file.mimetype,
          buffer: file.buffer,
        });
      } catch (err) {
        if (err instanceof StaffDocumentValidationError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
    }
    return files;
  }

  private validateCategoryFields(
    documentType: StaffDocumentType,
    fields: { processedDate?: string; expiryDate?: string },
  ): void {
    try {
      if (documentType === 'vulnerable_sector_check') {
        if (!fields.processedDate) {
          throw new StaffDocumentValidationError('processedDate is required.');
        }
        if (fields.expiryDate !== undefined && fields.expiryDate !== '') {
          throw new StaffDocumentValidationError(
            'expiryDate must not be supplied for vulnerable sector check.',
          );
        }
        assertProcessedDateNotInFuture(fields.processedDate);
      } else if (documentType === 'first_aid_cpr') {
        if (!fields.expiryDate) {
          throw new StaffDocumentValidationError('expiryDate is required.');
        }
        parseDateOnly(fields.expiryDate);
        if (fields.processedDate) {
          throw new StaffDocumentValidationError('processedDate must not be supplied for First Aid.');
        }
      } else {
        if (fields.processedDate || fields.expiryDate) {
          throw new StaffDocumentValidationError('Date fields are not allowed for this category.');
        }
      }
    } catch (err) {
      if (err instanceof StaffDocumentValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  private resolveSubmissionDates(
    documentType: StaffDocumentType,
    fields: { processedDate?: string; expiryDate?: string },
  ): { processedDate: string | null; expiryDate: string | null } {
    if (documentType === 'vulnerable_sector_check') {
      return {
        processedDate: fields.processedDate!,
        expiryDate: deriveVscExpiryDate(fields.processedDate!),
      };
    }
    if (documentType === 'first_aid_cpr') {
      return { processedDate: null, expiryDate: fields.expiryDate! };
    }
    return { processedDate: null, expiryDate: null };
  }

  private assertSubmissionDatesValid(
    documentType: StaffDocumentType,
    submission: StaffDocumentSubmission,
  ): void {
    if (documentType === 'vulnerable_sector_check') {
      if (!submission.processedDate || !submission.expiryDate) {
        throw new BadRequestException('Submission dates are incomplete.');
      }
    } else if (documentType === 'first_aid_cpr') {
      if (!submission.expiryDate) {
        throw new BadRequestException('Submission dates are incomplete.');
      }
    }
  }

  private assertStorageConfigured(): void {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException('Document storage is not configured.');
    }
  }

  private async compensateUploadedKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.deleteObject(key);
      } catch (err) {
        this.logger.error(
          `Compensation delete failed for staff document object (internal key length=${key.length}): ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }
    }
  }

  private async loadReminderAccountContext(staffId: string): Promise<{
    accountStatus: string | null;
    hasPortalAccount: boolean;
  }> {
    const account = await this.loadAccountByStaffId(staffId);
    return {
      accountStatus: account?.status ?? null,
      hasPortalAccount: Boolean(account),
    };
  }

  private async loadActiveAccount(session: StaffSessionPayload): Promise<StaffAccount> {
    const rows = await this.db
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.id, session.accountId))
      .limit(1);
    const account = rows[0];
    if (!account || account.status === 'disabled') {
      throw new UnauthorizedException('Not authenticated.');
    }
    if (account.staffId !== session.staffId) {
      throw new UnauthorizedException('Not authenticated.');
    }
    return account;
  }

  private async loadAccountByStaffId(staffId: string): Promise<StaffAccount | null> {
    const rows = await this.db
      .select()
      .from(staffAccounts)
      .where(eq(staffAccounts.staffId, staffId))
      .limit(1);
    return rows[0] ?? null;
  }

  private async assertStaffExists(staffId: string): Promise<void> {
    const rows = await this.db.select({ id: staff.id }).from(staff).where(eq(staff.id, staffId)).limit(1);
    if (!rows[0]) throw new NotFoundException('Staff not found.');
  }
}

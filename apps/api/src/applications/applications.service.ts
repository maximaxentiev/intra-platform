import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { Readable } from 'stream';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  applicationActivity,
  applicationDocuments,
  applications,
  staff,
} from '../db/schema';
import {
  StorageNotConfiguredError,
  StorageOperationError,
  StorageService,
} from '../storage/storage.service';
import {
  buildContentDisposition,
  isInlinePreviewContentType,
} from './application-document-content.util';
import type { ListApplicationsQuery } from './dto/applications.dto';

export interface ApplicationDocumentStreamResult {
  body: Readable;
  contentType: string;
  contentDisposition: string;
  category: string;
  documentId: string;
}

function documentSummary(doc: typeof applicationDocuments.$inferSelect) {
  return {
    id: doc.id,
    applicationId: doc.applicationId,
    category: doc.category,
    originalFilename: doc.originalFilename,
    contentType: doc.contentType,
    byteSize: doc.byteSize,
    uploadedAt: doc.uploadedAt,
  };
}

function listItem(row: typeof applications.$inferSelect) {
  return {
    id: row.id,
    status: row.status,
    role: row.role,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    submittedAt: row.submittedAt,
    hiredStaffId: row.hiredStaffId,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildDetail(row: typeof applications.$inferSelect, docs: typeof applicationDocuments.$inferSelect[]) {
  return {
    id: row.id,
    status: row.status,
    applicant: {
      role: row.role,
      firstName: row.firstName,
      middleName: row.middleName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      gender: row.gender,
    },
    eligibility: {
      gtaEligible: row.gtaEligible,
      statusInCanada: row.statusInCanada,
    },
    experience: {
      duration: row.experienceDuration,
      description: row.childcareExperience,
      nannyExperienceTypes: row.nannyExperienceTypes,
    },
    roleSpecific: {
      qualificationStatus: row.qualificationStatus,
      nannyTrainingCompleted: row.nannyTrainingCompleted,
      nannyTrainingDescription: row.nannyTrainingDescription,
    },
    compliance: {
      vscStatus: row.vscStatus,
      vscIssueOrRequestDate: row.vscIssueOrRequestDate,
      firstAidCprStatus: row.firstAidCprStatus,
      firstAidCprExpiry: row.firstAidCprExpiry,
      immunizationStatus: row.immunizationStatus,
      covidVaccinationStatus: row.covidVaccinationStatus,
    },
    languages: {
      englishProficiency: row.englishProficiency,
      additionalLanguages: row.additionalLanguages,
    },
    metadata: {
      formId: row.formId,
      sourcePage: row.sourcePage,
      sourceUrl: row.sourceUrl,
      consentAccepted: row.consentAccepted,
      consentPolicyVersion: row.consentPolicyVersion,
      consentAcceptedAt: row.consentAcceptedAt,
      submittedAt: row.submittedAt,
      payloadSnapshot: row.payloadSnapshot,
    },
    workflow: {
      contactedAt: row.contactedAt,
      contactedByUserId: row.contactedByUserId,
      hiredAt: row.hiredAt,
      hiredByUserId: row.hiredByUserId,
      hiredStaffId: row.hiredStaffId,
      rejectedAt: row.rejectedAt,
      rejectedByUserId: row.rejectedByUserId,
      rejectionEmailSentAt: row.rejectionEmailSentAt,
      reviewedAt: row.reviewedAt,
      reviewedByUserId: row.reviewedByUserId,
    },
    documents: docs.map(documentSummary),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async list(q: ListApplicationsQuery) {
    const limit = q.limit ?? 25;
    const offset = q.offset ?? 0;
    const filters = [];

    if (q.role) filters.push(eq(applications.role, q.role));
    if (q.status) filters.push(eq(applications.status, q.status));

    const search = q.q?.trim();
    if (search) {
      const pattern = `%${search}%`;
      filters.push(
        or(
          ilike(applications.firstName, pattern),
          ilike(applications.lastName, pattern),
          ilike(applications.email, pattern),
          ilike(applications.phone, pattern),
        )!,
      );
    }

    const where = filters.length ? and(...filters) : undefined;

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(applications)
        .where(where)
        .orderBy(desc(applications.submittedAt), desc(applications.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(applications)
        .where(where),
    ]);

    return {
      items: rows.map(listItem),
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    };
  }

  async get(id: string) {
    const rows = await this.db.select().from(applications).where(eq(applications.id, id));
    const row = rows[0];
    if (!row) throw new NotFoundException('Application not found.');

    const docs = await this.db
      .select()
      .from(applicationDocuments)
      .where(eq(applicationDocuments.applicationId, id))
      .orderBy(applicationDocuments.uploadedAt);

    const detail = buildDetail(row, docs);

    if (row.hiredStaffId) {
      const staffRows = await this.db
        .select({
          id: staff.id,
          legalName: staff.legalName,
          email: staff.email,
          sourceApplicationId: staff.sourceApplicationId,
        })
        .from(staff)
        .where(eq(staff.id, row.hiredStaffId));
      return {
        ...detail,
        hiring: {
          staffId: row.hiredStaffId,
          staff: staffRows[0] ?? null,
        },
      };
    }

    return { ...detail, hiring: null };
  }

  async markReviewed(id: string, actorUserId: string) {
    const rows = await this.db.select().from(applications).where(eq(applications.id, id));
    const row = rows[0];
    if (!row) throw new NotFoundException('Application not found.');
    if (row.reviewedAt) {
      return listItem(row);
    }

    const [updated] = await this.db
      .update(applications)
      .set({
        reviewedAt: sql`now()`,
        reviewedByUserId: actorUserId,
        updatedAt: sql`now()`,
      })
      .where(eq(applications.id, id))
      .returning();

    return listItem(updated);
  }

  async listActivity(applicationId: string) {
    await this.assertExists(applicationId);
    const rows = await this.db
      .select()
      .from(applicationActivity)
      .where(eq(applicationActivity.applicationId, applicationId))
      .orderBy(desc(applicationActivity.createdAt));
    return rows;
  }

  async listDocuments(applicationId: string) {
    await this.assertExists(applicationId);
    const rows = await this.db
      .select()
      .from(applicationDocuments)
      .where(eq(applicationDocuments.applicationId, applicationId))
      .orderBy(applicationDocuments.uploadedAt);
    return rows.map(documentSummary);
  }

  async streamDocumentContent(
    applicationId: string,
    documentId: string,
    actorUserId: string,
  ): Promise<ApplicationDocumentStreamResult> {
    await this.assertExists(applicationId);

    const rows = await this.db
      .select()
      .from(applicationDocuments)
      .where(
        and(
          eq(applicationDocuments.id, documentId),
          eq(applicationDocuments.applicationId, applicationId),
        ),
      )
      .limit(1);
    const doc = rows[0];
    if (!doc) throw new NotFoundException('Document not found.');

    let streamResult;
    try {
      streamResult = await this.storage.getObjectStream(doc.storageKey);
    } catch (err) {
      if (err instanceof StorageNotConfiguredError || err instanceof StorageOperationError) {
        throw new ServiceUnavailableException('Document is temporarily unavailable.');
      }
      throw err;
    }

    const contentType = doc.contentType || streamResult.contentType || 'application/octet-stream';
    const inline = isInlinePreviewContentType(contentType, doc.originalFilename);

    await this.db.insert(applicationActivity).values({
      applicationId,
      actorUserId,
      actorType: 'ops_user',
      eventType: 'document_viewed',
      metadata: {
        documentId: doc.id,
        category: doc.category,
      },
    });

    return {
      body: streamResult.body,
      contentType,
      contentDisposition: buildContentDisposition(doc.originalFilename, inline),
      category: doc.category,
      documentId: doc.id,
    };
  }

  private async assertExists(id: string) {
    const rows = await this.db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.id, id));
    if (!rows[0]) throw new NotFoundException('Application not found.');
  }
}

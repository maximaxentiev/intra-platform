import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  applicationActivity,
  applicationDocuments,
  applications,
  staff,
} from '../db/schema';
import type { ListApplicationsQuery } from './dto/applications.dto';

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
    },
    documents: docs.map(documentSummary),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class ApplicationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

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

  private async assertExists(id: string) {
    const rows = await this.db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.id, id));
    if (!rows[0]) throw new NotFoundException('Application not found.');
  }
}

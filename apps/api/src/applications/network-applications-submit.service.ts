import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  applicationActivity,
  applicationDocuments,
  applications,
} from '../db/schema';
import { StorageService } from '../storage/storage.service';
import { buildApplicationDocumentKey } from '../storage/storage-key.util';
import { mapPublicRoleToDb } from './network-submit.constants';
import { NetworkSubmitRateLimitService } from './network-submit-rate-limit.service';
import { sha256Hex } from './network-submit.util';
import {
  assertRequiredDocumentsPresent,
  complianceToDbFields,
  matchSubmitFiles,
  parseNetworkApplicationJson,
  type NormalizedNetworkApplication,
} from './network-submit.validation';

export interface NetworkSubmitSuccess {
  success: true;
  applicationId: string;
  status: 'received';
}

class DuplicateExternalSubmissionError extends Error {
  constructor() {
    super('Duplicate external submission.');
    this.name = 'DuplicateExternalSubmissionError';
  }
}

@Injectable()
export class NetworkApplicationsSubmitService {
  private readonly logger = new Logger(NetworkApplicationsSubmitService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly storage: StorageService,
    private readonly rateLimit: NetworkSubmitRateLimitService,
  ) {}

  async submit(
    applicationJson: string,
    files: Express.Multer.File[],
    clientIp: string,
  ): Promise<NetworkSubmitSuccess> {
    const payload = parseNetworkApplicationJson(applicationJson);
    assertRequiredDocumentsPresent(payload);
    const matchedFiles = matchSubmitFiles(payload.documents, files);

    await this.rateLimit.assertAllowed(clientIp, payload.applicant.email);

    const existing = await this.findByExternalSubmissionId(
      payload.metadata.externalApplicationId,
    );
    if (existing) {
      return {
        success: true,
        applicationId: existing.id,
        status: 'received',
      };
    }

    if (!this.storage.isConfigured()) {
      throw new InternalServerErrorException('Document storage is not configured.');
    }

    const applicationId = randomUUID();
    const consentAcceptedAt = new Date();
    const submittedAt = payload.metadata.submittedAt
      ? new Date(payload.metadata.submittedAt)
      : new Date();
    if (Number.isNaN(submittedAt.getTime())) {
      throw new HttpException('metadata.submittedAt is invalid.', HttpStatus.BAD_REQUEST);
    }

    const compliance = complianceToDbFields(payload.compliance);
    const uploadedKeys: string[] = [];

    try {
      await this.db.transaction(async (tx) => {
        try {
          await tx.insert(applications).values({
            id: applicationId,
            status: 'new',
            role: mapPublicRoleToDb(payload.role),
            firstName: payload.applicant.firstName,
            middleName: payload.applicant.middleName ?? '',
            lastName: payload.applicant.lastName,
            email: payload.applicant.email,
            phone: payload.applicant.phone,
            gender: payload.applicant.gender,
            gtaEligible: payload.eligibility.gtaEligible,
            statusInCanada: payload.eligibility.statusInCanada,
            experienceDuration: payload.experience.duration,
            childcareExperience: payload.experience.description ?? '',
            nannyExperienceTypes: payload.experience.types ?? [],
            qualificationStatus: payload.roleSpecific.qualification?.status ?? '',
            nannyTrainingCompleted: payload.roleSpecific.training?.completed ?? null,
            nannyTrainingDescription: payload.roleSpecific.training?.description ?? '',
            vscStatus: compliance.vscStatus,
            vscIssueOrRequestDate: compliance.vscIssueOrRequestDate,
            firstAidCprStatus: compliance.firstAidCprStatus,
            firstAidCprExpiry: compliance.firstAidCprExpiry,
            immunizationStatus: compliance.immunizationStatus,
            covidVaccinationStatus: compliance.covidVaccinationStatus,
            englishProficiency: payload.languages.englishProficiency,
            additionalLanguages: payload.languages.additional ?? [],
            formId: payload.metadata.formId,
            externalSubmissionId: payload.metadata.externalApplicationId,
            sourcePage: payload.metadata.sourcePage,
            sourceUrl: payload.metadata.sourceUrl,
            consentAccepted: payload.metadata.consentAccepted,
            consentPolicyVersion: payload.metadata.consentPolicyVersion,
            consentAcceptedAt,
            submittedAt,
            payloadSnapshot: payload as unknown as Record<string, unknown>,
          });
        } catch (err) {
          if (this.isUniqueViolation(err)) {
            throw new DuplicateExternalSubmissionError();
          }
          throw err;
        }

        for (const file of matchedFiles) {
          const documentId = randomUUID();
          const storageKey = buildApplicationDocumentKey({
            applicationId,
            documentId,
            originalFilename: file.meta.originalFilename,
          });

          await this.storage.uploadObject({
            key: storageKey,
            body: file.buffer,
            contentType: file.meta.contentType,
          });
          uploadedKeys.push(storageKey);

          await tx.insert(applicationDocuments).values({
            id: documentId,
            applicationId,
            category: file.meta.category,
            originalFilename: file.meta.originalFilename,
            contentType: file.meta.contentType,
            byteSize: file.meta.size,
            storageKey,
            checksumSha256: sha256Hex(file.buffer),
          });
        }

        await tx.insert(applicationActivity).values({
          applicationId,
          actorType: 'public',
          eventType: 'submitted',
          metadata: {
            formId: payload.metadata.formId,
            sourcePage: payload.metadata.sourcePage,
            consentPolicyVersion: payload.metadata.consentPolicyVersion,
          },
        });
      });
    } catch (err) {
      await this.cleanupUploadedKeys(uploadedKeys);

      if (err instanceof DuplicateExternalSubmissionError) {
        const row = await this.findByExternalSubmissionId(payload.metadata.externalApplicationId);
        if (row) {
          return {
            success: true,
            applicationId: row.id,
            status: 'received',
          };
        }
      }

      if (err instanceof HttpException) throw err;
      this.logger.error(`Network application submission failed: ${String(err)}`);
      throw new InternalServerErrorException('Failed to submit application.');
    }

    return {
      success: true,
      applicationId,
      status: 'received',
    };
  }

  private async findByExternalSubmissionId(externalSubmissionId: string) {
    const rows = await this.db
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.externalSubmissionId, externalSubmissionId))
      .limit(1);
    return rows[0] ?? null;
  }

  private async cleanupUploadedKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.deleteObject(key);
      } catch (err) {
        this.logger.warn(`Failed to cleanup storage key "${key}": ${String(err)}`);
      }
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    );
  }
}

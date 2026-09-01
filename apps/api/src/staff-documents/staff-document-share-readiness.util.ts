import { eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '../db/drizzle.module';
import {
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import {
  buildCategoryComplianceMap,
  buildComplianceInputsForStaff,
} from './staff-document-compliance.util';
import { STAFF_DOCUMENT_TYPE_VALUES, isStaffDocumentPublicShareType } from './staff-document.constants';
import { isPubliclyShareableCategory } from './staff-document-share-public-eligibility.util';

export type StaffDocumentShareReadinessAssessment =
  | { ready: true; mode: 'existing' | 'generatable' }
  | { ready: false; reason: string };

/**
 * Non-mutating probe: whether a Centre-facing document share can be produced now.
 * Does not generate tokens, URLs, or share lifecycle mutations.
 */
export async function assessStaffDocumentShareReadiness(
  executor: Pick<DbExecutor, 'select'>,
  staffId: string,
  hasActiveShare: boolean,
): Promise<StaffDocumentShareReadinessAssessment> {
  const hasShareableDocuments = await staffHasPubliclyShareableDocuments(executor, staffId);
  if (!hasShareableDocuments) {
    return {
      ready: false,
      reason: 'No approved shareable documents are available for this Carer.',
    };
  }

  if (hasActiveShare) {
    return { ready: true, mode: 'existing' };
  }

  return { ready: true, mode: 'generatable' };
}

async function staffHasPubliclyShareableDocuments(
  executor: Pick<DbExecutor, 'select'>,
  staffId: string,
): Promise<boolean> {
  const sets = await executor
    .select()
    .from(staffDocumentSets)
    .where(eq(staffDocumentSets.staffId, staffId));

  const currentSubmissionIds = sets
    .map((set) => set.currentSubmissionId)
    .filter((id): id is string => Boolean(id));

  if (currentSubmissionIds.length === 0) {
    return false;
  }

  const submissions =
    currentSubmissionIds.length > 0
      ? await executor
          .select()
          .from(staffDocumentSubmissions)
          .where(inArray(staffDocumentSubmissions.id, currentSubmissionIds))
      : [];

  const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));

  const files =
    currentSubmissionIds.length > 0
      ? await executor
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

  for (const type of STAFF_DOCUMENT_TYPE_VALUES) {
    if (!isStaffDocumentPublicShareType(type)) continue;
    const category = map.get(type);
    if (category && isPubliclyShareableCategory(category)) {
      return true;
    }
  }

  return false;
}

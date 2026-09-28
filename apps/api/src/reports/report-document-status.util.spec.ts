import { describe, expect, it } from 'vitest';
import {
  buildCategoryComplianceMap,
  type StaffDocumentCategoryComplianceInput,
} from '../staff-documents/staff-document-compliance.util';
import {
  buildDocumentStatusMap,
  deriveDocumentReportStatus,
  deriveOverallComplianceStatus,
  staffMatchesDocumentStatusFilter,
} from './report-document-status.util';

function categoryInput(
  documentType: StaffDocumentCategoryComplianceInput['documentType'],
  overrides: Partial<StaffDocumentCategoryComplianceInput> = {},
): StaffDocumentCategoryComplianceInput {
  return {
    documentType,
    isSubmitted: false,
    reviewStatus: 'not_submitted',
    expiryDate: null,
    processedDate: null,
    fileCount: 0,
    submittedAt: null,
    reviewedAt: null,
    remindersEnabled: true,
    currentSubmissionId: null,
    supersededAt: null,
    ...overrides,
  };
}

function buildMap(inputs: StaffDocumentCategoryComplianceInput[], asOfDate?: Date) {
  return buildCategoryComplianceMap(inputs, asOfDate);
}

describe('report-document-status.util', () => {
  it('derives per-document status priority (issue flagged beats expiry)', () => {
    const category = buildMap([
      categoryInput('vulnerable_sector_check', {
        isSubmitted: true,
        reviewStatus: 'issue_flagged',
        expiryDate: '2020-01-01',
        fileCount: 1,
        currentSubmissionId: 'sub-1',
      }),
    ]).get('vulnerable_sector_check')!;

    expect(deriveDocumentReportStatus(category)).toBe('issue_flagged');
  });

  it('marks approved VSC expiring within 30 days as expiring_soon', () => {
    const today = new Date(Date.UTC(2026, 7, 20));
    const category = buildMap([
      categoryInput('vulnerable_sector_check', {
        isSubmitted: true,
        reviewStatus: 'approved',
        processedDate: '2025-08-01',
        expiryDate: '2026-09-05',
        fileCount: 1,
        currentSubmissionId: 'sub-1',
      }),
    ], today).get('vulnerable_sector_check')!;

    expect(deriveDocumentReportStatus(category)).toBe('expiring_soon');
  });

  it('derives overall compliant when all required approved and COVID missing', () => {
    const categories = buildMap([
      categoryInput('vulnerable_sector_check', {
        isSubmitted: true,
        reviewStatus: 'approved',
        processedDate: '2024-01-01',
        expiryDate: '2027-01-01',
        fileCount: 1,
        currentSubmissionId: 'vsc',
      }),
      categoryInput('first_aid_cpr', {
        isSubmitted: true,
        reviewStatus: 'approved',
        expiryDate: '2027-06-01',
        fileCount: 1,
        currentSubmissionId: 'fa',
      }),
      categoryInput('immunizations', {
        isSubmitted: true,
        reviewStatus: 'approved',
        fileCount: 1,
        currentSubmissionId: 'imm',
      }),
      categoryInput('covid19_vaccination'),
    ]);

    expect(deriveOverallComplianceStatus(categories)).toBe('compliant');
  });

  it('derives needs_attention for zero-document staff', () => {
    const categories = buildMap([
      categoryInput('vulnerable_sector_check'),
      categoryInput('first_aid_cpr'),
      categoryInput('immunizations'),
      categoryInput('covid19_vaccination'),
      categoryInput('eca_diploma'),
      categoryInput('ece_diploma'),
      categoryInput('rece_proof'),
    ]);

    expect(deriveOverallComplianceStatus(categories)).toBe('needs_attention');
    expect(buildDocumentStatusMap(categories).covid19_vaccination).toBe('not_submitted');
  });

  it('filters staff by any required document status', () => {
    const documents = {
      vulnerable_sector_check: 'approved' as const,
      first_aid_cpr: 'expired' as const,
      immunizations: 'approved' as const,
      covid19_vaccination: 'not_submitted' as const,
      eca_diploma: 'not_submitted' as const,
      ece_diploma: 'not_submitted' as const,
      rece_proof: 'not_submitted' as const,
    };

    expect(
      staffMatchesDocumentStatusFilter({
        documents,
        filterStatus: 'expired',
      }),
    ).toBe(true);

    expect(
      staffMatchesDocumentStatusFilter({
        documents,
        filterStatus: 'not_submitted',
      }),
    ).toBe(false);
  });

  it('applies documentType scoping for status filter', () => {
    const documents = {
      vulnerable_sector_check: 'approved' as const,
      first_aid_cpr: 'approved' as const,
      immunizations: 'approved' as const,
      covid19_vaccination: 'not_submitted' as const,
      eca_diploma: 'not_submitted' as const,
      ece_diploma: 'not_submitted' as const,
      rece_proof: 'not_submitted' as const,
    };

    expect(
      staffMatchesDocumentStatusFilter({
        documents,
        filterStatus: 'not_submitted',
        documentType: 'covid19_vaccination',
      }),
    ).toBe(true);

    expect(
      staffMatchesDocumentStatusFilter({
        documents,
        filterStatus: 'expired',
        documentType: 'covid19_vaccination',
      }),
    ).toBe(false);
  });
});

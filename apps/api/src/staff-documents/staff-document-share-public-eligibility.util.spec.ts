import { describe, expect, it } from 'vitest';
import {
  buildCategoryComplianceMap,
  type StaffDocumentCategoryComplianceInput,
} from './staff-document-compliance.util';
import {
  isPubliclyShareableCategory,
  mapPublicShareExpiryDisplay,
} from './staff-document-share-public-eligibility.util';

function category(
  overrides: Partial<StaffDocumentCategoryComplianceInput> = {},
) {
  const input: StaffDocumentCategoryComplianceInput = {
    documentType: 'vulnerable_sector_check',
    isSubmitted: true,
    reviewStatus: 'approved',
    expiryDate: '2029-08-01',
    processedDate: '2026-08-01',
    fileCount: 1,
    submittedAt: '2026-08-01T00:00:00.000Z',
    reviewedAt: '2026-08-02T00:00:00.000Z',
    remindersEnabled: true,
    currentSubmissionId: 'sub-1',
    supersededAt: null,
    ...overrides,
  };
  return buildCategoryComplianceMap([input]).get(input.documentType)!;
}

describe('isPubliclyShareableCategory', () => {
  it('allows approved current VSC, First Aid, Immunizations, and COVID', () => {
    expect(isPubliclyShareableCategory(category())).toBe(true);
    expect(
      isPubliclyShareableCategory(
        category({ documentType: 'first_aid_cpr', processedDate: null }),
      ),
    ).toBe(true);
    expect(
      isPubliclyShareableCategory(
        category({
          documentType: 'immunizations',
          expiryDate: null,
          processedDate: null,
        }),
      ),
    ).toBe(true);
    expect(
      isPubliclyShareableCategory(
        category({
          documentType: 'covid19_vaccination',
          expiryDate: null,
          processedDate: null,
        }),
      ),
    ).toBe(true);
  });

  it('blocks pending, issue flagged, expired, and missing submissions', () => {
    expect(isPubliclyShareableCategory(category({ reviewStatus: 'pending_review' }))).toBe(false);
    expect(isPubliclyShareableCategory(category({ reviewStatus: 'issue_flagged' }))).toBe(false);
    expect(isPubliclyShareableCategory(category({ expiryDate: '2020-01-01' }))).toBe(false);
    expect(isPubliclyShareableCategory(category({ fileCount: 0, isSubmitted: false }))).toBe(false);
    expect(
      isPubliclyShareableCategory(
        category({ documentType: 'immunizations', reviewStatus: 'pending_review', expiryDate: null }),
      ),
    ).toBe(false);
    expect(
      isPubliclyShareableCategory(
        category({ documentType: 'covid19_vaccination', reviewStatus: 'issue_flagged', expiryDate: null }),
      ),
    ).toBe(false);
  });

  it('allows expiring soon for dated categories', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    expect(
      isPubliclyShareableCategory(
        category({ expiryDate: soon.toISOString().slice(0, 10) }),
      ),
    ).toBe(true);
  });
});

describe('mapPublicShareExpiryDisplay', () => {
  it('preserves no_expiry for Immunizations and COVID', () => {
    expect(
      mapPublicShareExpiryDisplay(
        category({ documentType: 'immunizations', expiryDate: null, processedDate: null }),
      ),
    ).toBe('no_expiry');
    expect(
      mapPublicShareExpiryDisplay(
        category({ documentType: 'covid19_vaccination', expiryDate: null, processedDate: null }),
      ),
    ).toBe('no_expiry');
  });
});

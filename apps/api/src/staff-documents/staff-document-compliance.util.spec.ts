import { describe, expect, it } from 'vitest';
import {
  buildComplianceInputsForStaff,
  complianceForRequiredCategories,
  deriveStaffDocumentListStatus,
  deriveStaffShiftDocumentGate,
  isActiveReminderSubmission,
  type StaffDocumentCategoryComplianceInput,
} from './staff-document-compliance.util';
import { startOfUtcDay } from './staff-document-dates.util';

const AS_OF = startOfUtcDay(new Date('2026-08-11T12:00:00Z'));

function cat(
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

function submittedApproved(
  documentType: StaffDocumentCategoryComplianceInput['documentType'],
  expiryDate: string | null = null,
): StaffDocumentCategoryComplianceInput {
  return cat(documentType, {
    isSubmitted: true,
    reviewStatus: 'approved',
    fileCount: 1,
    submittedAt: '2026-01-01T00:00:00Z',
    reviewedAt: '2026-01-02T00:00:00Z',
    currentSubmissionId: 'sub-1',
    expiryDate,
  });
}

describe('deriveStaffDocumentListStatus', () => {
  it('returns no_documents_submitted when nothing submitted', () => {
    const required = complianceForRequiredCategories([], AS_OF);
    expect(deriveStaffDocumentListStatus(required)).toBe('no_documents_submitted');
  });

  it('returns pending_review for partial submission', () => {
    const status = deriveStaffDocumentListStatus(
      complianceForRequiredCategories([submittedApproved('vulnerable_sector_check')], AS_OF),
    );
    expect(status).toBe('pending_review');
  });

  it('returns pending_review when any required is pending review', () => {
    const inputs = [
      submittedApproved('vulnerable_sector_check'),
      submittedApproved('first_aid_cpr'),
      cat('immunizations', {
        isSubmitted: true,
        reviewStatus: 'pending_review',
        fileCount: 1,
        currentSubmissionId: 'x',
      }),
    ];
    expect(deriveStaffDocumentListStatus(complianceForRequiredCategories(inputs, AS_OF))).toBe(
      'pending_review',
    );
  });

  it('returns pending_review when issue flagged', () => {
    const inputs = [
      submittedApproved('vulnerable_sector_check'),
      submittedApproved('first_aid_cpr'),
      cat('immunizations', {
        isSubmitted: true,
        reviewStatus: 'issue_flagged',
        fileCount: 1,
        currentSubmissionId: 'x',
      }),
    ];
    expect(deriveStaffDocumentListStatus(complianceForRequiredCategories(inputs, AS_OF))).toBe(
      'pending_review',
    );
  });

  it('returns approved when all required approved and current', () => {
    const inputs = [
      submittedApproved('vulnerable_sector_check', '2027-01-01'),
      submittedApproved('first_aid_cpr', '2027-01-01'),
      submittedApproved('immunizations'),
    ];
    expect(deriveStaffDocumentListStatus(complianceForRequiredCategories(inputs, AS_OF))).toBe(
      'approved',
    );
  });

  it('returns warning when approved but expiring soon', () => {
    const inputs = [
      submittedApproved('vulnerable_sector_check', '2026-09-10'),
      submittedApproved('first_aid_cpr', '2027-01-01'),
      submittedApproved('immunizations'),
    ];
    const required = complianceForRequiredCategories(inputs, AS_OF);
    expect(deriveStaffDocumentListStatus(required)).toBe('warning');
  });

  it('returns warning when approved but expired', () => {
    const inputs = [
      submittedApproved('vulnerable_sector_check', '2026-08-10'),
      submittedApproved('first_aid_cpr', '2027-01-01'),
      submittedApproved('immunizations'),
    ];
    expect(deriveStaffDocumentListStatus(complianceForRequiredCategories(inputs, AS_OF))).toBe(
      'warning',
    );
  });
});

describe('deriveStaffShiftDocumentGate', () => {
  it('is ineligible when required submission missing', () => {
    const gate = deriveStaffShiftDocumentGate([submittedApproved('vulnerable_sector_check')], AS_OF);
    expect(gate.eligible).toBe(false);
    expect(gate.reasons).toContain('missing_required_submission');
  });

  it('is ineligible when pending review', () => {
    const gate = deriveStaffShiftDocumentGate([
      submittedApproved('vulnerable_sector_check'),
      submittedApproved('first_aid_cpr'),
      cat('immunizations', {
        isSubmitted: true,
        reviewStatus: 'pending_review',
        fileCount: 1,
        currentSubmissionId: 'x',
      }),
    ], AS_OF);
    expect(gate.eligible).toBe(false);
    expect(gate.reasons).toContain('pending_review');
  });

  it('is ineligible when issue flagged', () => {
    const gate = deriveStaffShiftDocumentGate([
      submittedApproved('vulnerable_sector_check'),
      submittedApproved('first_aid_cpr'),
      cat('immunizations', {
        isSubmitted: true,
        reviewStatus: 'issue_flagged',
        fileCount: 1,
        currentSubmissionId: 'x',
      }),
    ], AS_OF);
    expect(gate.eligible).toBe(false);
    expect(gate.reasons).toContain('issue_flagged');
  });

  it('is ineligible when expired', () => {
    const gate = deriveStaffShiftDocumentGate([
      submittedApproved('vulnerable_sector_check', '2026-08-10'),
      submittedApproved('first_aid_cpr', '2027-01-01'),
      submittedApproved('immunizations'),
    ], AS_OF);
    expect(gate.eligible).toBe(false);
    expect(gate.reasons).toContain('expired');
  });

  it('remains eligible when expiring soon and approved', () => {
    const gate = deriveStaffShiftDocumentGate([
      submittedApproved('vulnerable_sector_check', '2026-09-10'),
      submittedApproved('first_aid_cpr', '2027-01-01'),
      submittedApproved('immunizations'),
    ], AS_OF);
    expect(gate.eligible).toBe(true);
    expect(gate.documentStatus).toBe('warning');
  });

  it('is eligible when all required approved and current', () => {
    const gate = deriveStaffShiftDocumentGate([
      submittedApproved('vulnerable_sector_check', '2027-06-01'),
      submittedApproved('first_aid_cpr', '2027-06-01'),
      submittedApproved('immunizations'),
    ], AS_OF);
    expect(gate.eligible).toBe(true);
    expect(gate.reasons).toHaveLength(0);
  });
});

describe('buildComplianceInputsForStaff', () => {
  it('maps preloaded rows for batch staff list aggregation', () => {
    const submittedAt = new Date('2026-01-01T00:00:00Z');
    const inputs = buildComplianceInputsForStaff(
      [
        {
          documentType: 'immunizations',
          currentSubmissionId: 'sub-1',
          remindersEnabled: true,
        },
      ],
      new Map([
        [
          'sub-1',
          {
            id: 'sub-1',
            reviewStatus: 'pending_review' as const,
            expiryDate: null,
            processedDate: null,
            submittedAt,
            reviewedAt: null,
            supersededAt: null,
          },
        ],
      ]),
      new Map([['sub-1', 1]]),
    );

    const immunizations = inputs.find((c) => c.documentType === 'immunizations');
    expect(immunizations?.isSubmitted).toBe(true);
    expect(immunizations?.reviewStatus).toBe('pending_review');
    expect(deriveStaffShiftDocumentGate(inputs).documentStatus).toBe('pending_review');
  });

  it('returns no_documents_submitted when no sets exist', () => {
    const inputs = buildComplianceInputsForStaff([], new Map(), new Map());
    expect(deriveStaffShiftDocumentGate(inputs).documentStatus).toBe('no_documents_submitted');
  });
});

describe('isActiveReminderSubmission', () => {
  it('is active when current and not superseded', () => {
    expect(
      isActiveReminderSubmission(
        { currentSubmissionId: 'sub-1' },
        { id: 'sub-1', supersededAt: null },
      ),
    ).toBe(true);
  });

  it('is inactive when superseded even if id matches stale pointer', () => {
    expect(
      isActiveReminderSubmission(
        { currentSubmissionId: 'sub-2' },
        { id: 'sub-1', supersededAt: '2026-01-01T00:00:00Z' },
      ),
    ).toBe(false);
  });
});

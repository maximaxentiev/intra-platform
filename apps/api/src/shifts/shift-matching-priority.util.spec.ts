import { describe, expect, it } from 'vitest';
import { compareStaffMatchingSort } from '@intra/shared';
import type { StaffDocumentCategoryComplianceInput } from '../staff-documents/staff-document-compliance.util';
import {
  buildStaffMatchingPriority,
  formatStaffMatchingPriorityLine,
  hasApprovedEcaDiploma,
  hasApprovedReceProof,
} from './shift-matching-priority.util';
import { shiftQualificationPreferenceRank } from './shift-qualification-matching.util';

function approved(documentType: StaffDocumentCategoryComplianceInput['documentType']) {
  return {
    documentType,
    isSubmitted: true,
    reviewStatus: 'approved' as const,
    expiryDate: null,
    processedDate: null,
    fileCount: 1,
    submittedAt: '2026-01-01T00:00:00Z',
    reviewedAt: '2026-01-02T00:00:00Z',
    remindersEnabled: true,
    currentSubmissionId: 'sub-1',
    supersededAt: null,
  };
}

function priority(input: {
  shiftRoleNeeded: string;
  isTop: boolean;
  staffCity?: string | null;
  centreCity?: string | null;
  qualificationCategoryInputs?: StaffDocumentCategoryComplianceInput[];
}) {
  return buildStaffMatchingPriority({
    shiftRoleNeeded: input.shiftRoleNeeded,
    isTop: input.isTop,
    staffCity: input.staffCity ?? 'Toronto',
    centreCity: input.centreCity ?? 'Toronto',
    qualificationCategoryInputs: input.qualificationCategoryInputs ?? [],
  });
}

describe('buildStaffMatchingPriority — ECE shifts', () => {
  it('assigns static ECE priority groups', () => {
    expect(
      priority({
        shiftRoleNeeded: 'ECE',
        isTop: true,
        qualificationCategoryInputs: [approved('rece_proof')],
      }).group,
    ).toBe(1);

    expect(priority({ shiftRoleNeeded: 'ECE', isTop: true }).group).toBe(2);

    expect(
      priority({
        shiftRoleNeeded: 'ECE',
        isTop: true,
        staffCity: 'Mississauga',
        qualificationCategoryInputs: [approved('rece_proof')],
      }).group,
    ).toBe(3);

    expect(
      priority({
        shiftRoleNeeded: 'ECE',
        isTop: true,
        staffCity: 'Mississauga',
      }).group,
    ).toBe(4);

    expect(
      priority({
        shiftRoleNeeded: 'ECE',
        isTop: false,
        qualificationCategoryInputs: [approved('rece_proof')],
      }).group,
    ).toBe(9);
  });

  it('uses RECE qualification type only with approved rece_proof', () => {
    const withProof = priority({
      shiftRoleNeeded: 'ECE',
      isTop: true,
      qualificationCategoryInputs: [approved('rece_proof')],
    });
    expect(withProof.qualificationType).toBe('RECE');
    expect(withProof.label).toContain('RECE + Top + Same city');

    const ordinary = priority({ shiftRoleNeeded: 'ECE', isTop: true });
    expect(ordinary.qualificationType).toBe('ECE');
    expect(ordinary.label).toContain('ECE + Top + Same city');
  });
});

describe('buildStaffMatchingPriority — ECA shifts', () => {
  it('assigns static ECA priority groups', () => {
    expect(
      priority({
        shiftRoleNeeded: 'ECA',
        isTop: true,
        qualificationCategoryInputs: [approved('eca_diploma')],
      }).group,
    ).toBe(1);

    expect(priority({ shiftRoleNeeded: 'ECA', isTop: true }).group).toBe(2);

    expect(
      priority({
        shiftRoleNeeded: 'ECA',
        isTop: false,
        qualificationCategoryInputs: [approved('eca_diploma')],
      }).group,
    ).toBe(9);
  });

  it('labels approved diploma preference distinctly', () => {
    const qualified = priority({
      shiftRoleNeeded: 'ECA',
      isTop: true,
      qualificationCategoryInputs: [approved('eca_diploma')],
    });
    expect(qualified.qualificationType).toBe('ECA (approved diploma)');

    const unqualified = priority({ shiftRoleNeeded: 'ECA', isTop: true });
    expect(unqualified.qualificationType).toBe('ECA');
  });
});

describe('buildStaffMatchingPriority — RECE shifts', () => {
  it('assigns RECE shift priority groups', () => {
    expect(
      priority({
        shiftRoleNeeded: 'RECE',
        isTop: true,
        qualificationCategoryInputs: [approved('rece_proof')],
      }).group,
    ).toBe(1);

    expect(
      priority({
        shiftRoleNeeded: 'RECE',
        isTop: true,
        staffCity: 'Mississauga',
        qualificationCategoryInputs: [approved('rece_proof')],
      }).group,
    ).toBe(2);

    expect(
      priority({
        shiftRoleNeeded: 'RECE',
        isTop: false,
        qualificationCategoryInputs: [approved('rece_proof')],
      }).group,
    ).toBe(5);
  });
});

describe('buildStaffMatchingPriority — geographic labels', () => {
  it('maps tier 3 to Other/unknown city', () => {
    const result = priority({
      shiftRoleNeeded: 'ECE',
      isTop: true,
      staffCity: 'London',
      centreCity: 'Toronto',
    });

    expect(result.geographicTier).toBe(3);
    expect(result.geographicLabel).toBe('Other/unknown city');
    expect(result.label).toContain('Other/unknown city');
  });
});

describe('buildStaffMatchingPriority — alignment with sort order', () => {
  it('orders eligible staff the same way as compareStaffMatchingSort', () => {
    const centreCity = 'Toronto';
    const rows = [
      {
        legalName: 'Charlie',
        isTop: false,
        city: 'Toronto',
        shiftRoleNeeded: 'ECE',
        inputs: [approved('rece_proof')],
      },
      {
        legalName: 'Alice',
        isTop: true,
        city: 'Toronto',
        shiftRoleNeeded: 'ECE',
        inputs: [],
      },
      {
        legalName: 'Bob',
        isTop: true,
        city: 'Toronto',
        shiftRoleNeeded: 'ECE',
        inputs: [approved('rece_proof')],
      },
    ];

    const enriched = rows.map((row) => ({
      ...row,
      qualificationPreferenceRank: shiftQualificationPreferenceRank(row.shiftRoleNeeded, row.inputs),
      matchingPriority: buildStaffMatchingPriority({
        shiftRoleNeeded: row.shiftRoleNeeded,
        isTop: row.isTop,
        staffCity: row.city,
        centreCity,
        qualificationCategoryInputs: row.inputs,
      }),
    }));

    const sortedByMatching = [...enriched].sort((a, b) =>
      compareStaffMatchingSort(
        {
          isTop: a.isTop,
          legalName: a.legalName,
          city: a.city,
          qualificationPreferenceRank: a.qualificationPreferenceRank,
        },
        {
          isTop: b.isTop,
          legalName: b.legalName,
          city: b.city,
          qualificationPreferenceRank: b.qualificationPreferenceRank,
        },
        centreCity,
      ),
    );

    expect(sortedByMatching.map((row) => row.legalName)).toEqual(['Bob', 'Alice', 'Charlie']);
    expect(sortedByMatching.map((row) => row.matchingPriority.group)).toEqual([1, 2, 9]);
  });

  it('keeps alphabetical order within the same priority group', () => {
    const centreCity = 'Toronto';
    const rows = [
      { legalName: 'Zed', isTop: true, city: 'Toronto', inputs: [approved('rece_proof')] },
      { legalName: 'Amy', isTop: true, city: 'Toronto', inputs: [approved('rece_proof')] },
    ];

    const sorted = [...rows].sort((a, b) =>
      compareStaffMatchingSort(
        {
          isTop: a.isTop,
          legalName: a.legalName,
          city: a.city,
          qualificationPreferenceRank: shiftQualificationPreferenceRank('ECE', a.inputs),
        },
        {
          isTop: b.isTop,
          legalName: b.legalName,
          city: b.city,
          qualificationPreferenceRank: shiftQualificationPreferenceRank('ECE', b.inputs),
        },
        centreCity,
      ),
    );

    const groups = sorted.map((row) =>
      buildStaffMatchingPriority({
        shiftRoleNeeded: 'ECE',
        isTop: row.isTop,
        staffCity: row.city,
        centreCity,
        qualificationCategoryInputs: row.inputs,
      }),
    );

    expect(sorted.map((row) => row.legalName)).toEqual(['Amy', 'Zed']);
    expect(groups.every((entry) => entry.group === 1)).toBe(true);
    expect(new Set(groups.map((entry) => entry.label)).size).toBe(1);
  });
});

describe('formatStaffMatchingPriorityLine', () => {
  it('formats the Ops priority line', () => {
    const line = formatStaffMatchingPriorityLine(
      priority({
        shiftRoleNeeded: 'ECE',
        isTop: true,
        staffCity: 'Mississauga',
        qualificationCategoryInputs: [approved('rece_proof')],
      }),
    );

    expect(line).toBe('Priority 3 · RECE + Top + Adjacent city');
  });
});

describe('qualification document helpers used by priority metadata', () => {
  it('requires approved review state only', () => {
    expect(hasApprovedReceProof([approved('rece_proof')])).toBe(true);
    expect(
      hasApprovedReceProof([
        {
          ...approved('rece_proof'),
          reviewStatus: 'pending_review',
        },
      ]),
    ).toBe(false);
    expect(hasApprovedEcaDiploma([approved('eca_diploma')])).toBe(true);
  });
});

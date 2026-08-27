import { geographicTier, normalizeShiftRole } from '@intra/shared';
import type { StaffDocumentCategoryComplianceInput } from '../staff-documents/staff-document-compliance.util';
import {
  hasApprovedEcaDiploma,
  hasApprovedReceProof,
  shiftQualificationPreferenceRank,
} from './shift-qualification-matching.util';

export type StaffMatchingPriority = {
  group: number;
  label: string;
  isTop: boolean;
  geographicTier: number;
  geographicLabel: string;
  qualificationType: string;
};

const GEOGRAPHIC_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: 'Same city',
  1: 'Adjacent city',
  2: '2nd-degree adjacent city',
  3: 'Other/unknown city',
};

function topLabel(isTop: boolean): string {
  return isTop ? 'Top' : 'Non-Top';
}

function buildLabel(
  qualificationType: string,
  isTop: boolean,
  geographicLabel: string,
): string {
  return `${qualificationType} + ${topLabel(isTop)} + ${geographicLabel}`;
}

/** ECE and ECA shifts: Top/Non-Top blocks of 8 groups by geo × qualification preference. */
function eceEcaPriorityGroup(
  isTop: boolean,
  geoTier: 0 | 1 | 2 | 3,
  qualificationPreferenceRank: number,
): number {
  const base = isTop ? 0 : 8;
  const qualOffset = qualificationPreferenceRank === 1 ? 1 : 2;
  return base + geoTier * 2 + qualOffset;
}

/** RECE shifts: eligible staff always have approved RECE Proof; 4 Top + 4 Non-Top geo groups. */
function receShiftPriorityGroup(isTop: boolean, geoTier: 0 | 1 | 2 | 3): number {
  const base = isTop ? 0 : 4;
  return base + geoTier + 1;
}

function qualificationTypeLabel(
  shiftRole: string | null,
  qualificationPreferenceRank: number,
): string {
  if (shiftRole === 'ECA') {
    return qualificationPreferenceRank === 1 ? 'ECA (approved diploma)' : 'ECA';
  }

  if (shiftRole === 'ECE') {
    return qualificationPreferenceRank === 1 ? 'RECE' : 'ECE';
  }

  if (shiftRole === 'RECE') {
    return 'RECE';
  }

  return shiftRole ?? 'Staff';
}

export function buildStaffMatchingPriority(input: {
  shiftRoleNeeded: string;
  isTop: boolean;
  staffCity: string | null;
  centreCity: string | null;
  qualificationCategoryInputs: readonly StaffDocumentCategoryComplianceInput[];
}): StaffMatchingPriority {
  const shiftRole = normalizeShiftRole(input.shiftRoleNeeded);
  const geoTier = geographicTier(input.staffCity, input.centreCity);
  const geographicLabel = GEOGRAPHIC_LABELS[geoTier];
  const qualificationPreferenceRank = shiftQualificationPreferenceRank(
    input.shiftRoleNeeded,
    input.qualificationCategoryInputs,
  );

  const qualificationType = qualificationTypeLabel(shiftRole, qualificationPreferenceRank);

  let group: number;
  if (shiftRole === 'RECE') {
    group = receShiftPriorityGroup(input.isTop, geoTier);
  } else if (shiftRole === 'ECA' || shiftRole === 'ECE') {
    group = eceEcaPriorityGroup(input.isTop, geoTier, qualificationPreferenceRank);
  } else {
    group = eceEcaPriorityGroup(input.isTop, geoTier, qualificationPreferenceRank);
  }

  return {
    group,
    label: buildLabel(qualificationType, input.isTop, geographicLabel),
    isTop: input.isTop,
    geographicTier: geoTier,
    geographicLabel,
    qualificationType,
  };
}

/** Ops-facing single-line priority summary for available-staff results. */
export function formatStaffMatchingPriorityLine(priority: StaffMatchingPriority): string {
  return `Priority ${priority.group} · ${priority.label}`;
}

export { hasApprovedEcaDiploma, hasApprovedReceProof };

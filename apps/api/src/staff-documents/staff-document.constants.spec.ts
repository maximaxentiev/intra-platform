import { describe, expect, it } from 'vitest';
import {
  OPTIONAL_STAFF_DOCUMENT_TYPES,
  QUALIFICATION_STAFF_DOCUMENT_TYPES,
  REQUIRED_STAFF_DOCUMENT_TYPES,
  STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE,
  STAFF_DOCUMENT_REMINDER_TYPES,
  STAFF_DOCUMENT_TYPE_VALUES,
  isQualificationStaffDocumentType,
  isStaffDocumentPublicShareType,
  isStaffDocumentReminderType,
  qualificationTypesForStaffRole,
} from './staff-document.constants';

describe('staff document schema constants', () => {
  it('defines all seven document types', () => {
    expect(STAFF_DOCUMENT_TYPE_VALUES).toHaveLength(7);
    expect(STAFF_DOCUMENT_TYPE_VALUES).toEqual([
      'vulnerable_sector_check',
      'first_aid_cpr',
      'immunizations',
      'covid19_vaccination',
      'eca_diploma',
      'ece_diploma',
      'rece_proof',
    ]);
  });

  it('defines exactly three required categories', () => {
    expect(REQUIRED_STAFF_DOCUMENT_TYPES).toHaveLength(3);
    expect(REQUIRED_STAFF_DOCUMENT_TYPES).not.toContain('covid19_vaccination');
    expect(REQUIRED_STAFF_DOCUMENT_TYPES).not.toContain('eca_diploma');
  });

  it('treats COVID and qualifications as optional', () => {
    expect(OPTIONAL_STAFF_DOCUMENT_TYPES).toEqual([
      'covid19_vaccination',
      'eca_diploma',
      'ece_diploma',
      'rece_proof',
    ]);
    expect(QUALIFICATION_STAFF_DOCUMENT_TYPES).toEqual([
      'eca_diploma',
      'ece_diploma',
      'rece_proof',
    ]);
  });

  it('allows all categories for public share policy', () => {
    expect(STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE).toEqual({
      vulnerable_sector_check: true,
      first_aid_cpr: true,
      immunizations: true,
      covid19_vaccination: true,
      eca_diploma: true,
      ece_diploma: true,
      rece_proof: true,
    });
    for (const type of STAFF_DOCUMENT_TYPE_VALUES) {
      expect(isStaffDocumentPublicShareType(type)).toBe(true);
    }
  });

  it('keeps compliance required/optional rules separate from public sharing', () => {
    expect(REQUIRED_STAFF_DOCUMENT_TYPES).toEqual([
      'vulnerable_sector_check',
      'first_aid_cpr',
      'immunizations',
    ]);
    expect(OPTIONAL_STAFF_DOCUMENT_TYPES).toEqual([
      'covid19_vaccination',
      'eca_diploma',
      'ece_diploma',
      'rece_proof',
    ]);
  });

  it('allows expiry reminders only for VSC and First Aid', () => {
    expect(STAFF_DOCUMENT_REMINDER_TYPES).toEqual(['vulnerable_sector_check', 'first_aid_cpr']);
    expect(isStaffDocumentReminderType('vulnerable_sector_check')).toBe(true);
    expect(isStaffDocumentReminderType('first_aid_cpr')).toBe(true);
    expect(isStaffDocumentReminderType('immunizations')).toBe(false);
    expect(isStaffDocumentReminderType('covid19_vaccination')).toBe(false);
    for (const type of QUALIFICATION_STAFF_DOCUMENT_TYPES) {
      expect(isStaffDocumentReminderType(type)).toBe(false);
      expect(isQualificationStaffDocumentType(type)).toBe(true);
    }
  });

  it('maps qualification visibility by staff role for the Carer portal', () => {
    expect(qualificationTypesForStaffRole('ECA')).toEqual(['eca_diploma']);
    expect(qualificationTypesForStaffRole('ECE')).toEqual(['ece_diploma', 'rece_proof']);
    expect(qualificationTypesForStaffRole('Nanny')).toEqual([]);
  });
});

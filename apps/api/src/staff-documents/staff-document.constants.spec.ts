import { describe, expect, it } from 'vitest';
import {
  OPTIONAL_STAFF_DOCUMENT_TYPES,
  REQUIRED_STAFF_DOCUMENT_TYPES,
  STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE,
  STAFF_DOCUMENT_REMINDER_TYPES,
  STAFF_DOCUMENT_TYPE_VALUES,
  isStaffDocumentPublicShareType,
  isStaffDocumentReminderType,
} from './staff-document.constants';

describe('staff document schema constants', () => {
  it('defines exactly four document types', () => {
    expect(STAFF_DOCUMENT_TYPE_VALUES).toHaveLength(4);
    expect(STAFF_DOCUMENT_TYPE_VALUES).toEqual([
      'vulnerable_sector_check',
      'first_aid_cpr',
      'immunizations',
      'covid19_vaccination',
    ]);
  });

  it('defines exactly three required categories', () => {
    expect(REQUIRED_STAFF_DOCUMENT_TYPES).toHaveLength(3);
    expect(REQUIRED_STAFF_DOCUMENT_TYPES).not.toContain('covid19_vaccination');
  });

  it('treats COVID as optional', () => {
    expect(OPTIONAL_STAFF_DOCUMENT_TYPES).toEqual(['covid19_vaccination']);
  });

  it('allows all four categories for public share policy', () => {
    expect(STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE).toEqual({
      vulnerable_sector_check: true,
      first_aid_cpr: true,
      immunizations: true,
      covid19_vaccination: true,
    });
    expect(isStaffDocumentPublicShareType('vulnerable_sector_check')).toBe(true);
    expect(isStaffDocumentPublicShareType('first_aid_cpr')).toBe(true);
    expect(isStaffDocumentPublicShareType('immunizations')).toBe(true);
    expect(isStaffDocumentPublicShareType('covid19_vaccination')).toBe(true);
  });

  it('keeps compliance required/optional rules separate from public sharing', () => {
    expect(REQUIRED_STAFF_DOCUMENT_TYPES).toEqual([
      'vulnerable_sector_check',
      'first_aid_cpr',
      'immunizations',
    ]);
    expect(OPTIONAL_STAFF_DOCUMENT_TYPES).toEqual(['covid19_vaccination']);
  });

  it('allows expiry reminders only for VSC and First Aid', () => {
    expect(STAFF_DOCUMENT_REMINDER_TYPES).toEqual(['vulnerable_sector_check', 'first_aid_cpr']);
    expect(isStaffDocumentReminderType('vulnerable_sector_check')).toBe(true);
    expect(isStaffDocumentReminderType('first_aid_cpr')).toBe(true);
    expect(isStaffDocumentReminderType('immunizations')).toBe(false);
    expect(isStaffDocumentReminderType('covid19_vaccination')).toBe(false);
  });
});

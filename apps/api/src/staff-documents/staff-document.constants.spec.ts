import { describe, expect, it } from 'vitest';
import {
  OPTIONAL_STAFF_DOCUMENT_TYPES,
  REQUIRED_STAFF_DOCUMENT_TYPES,
  STAFF_DOCUMENT_TYPE_VALUES,
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
});

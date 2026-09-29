import { describe, expect, it } from 'vitest';
import {
  classifyDocumentReference,
  normalizeEmail,
  normalizeSpokenEnglish,
  parseMultiSelect,
  trimToNull,
} from './nanny-applicants-csv.normalize';

describe('nanny-applicants-csv.normalize', () => {
  it('trimToNull treats blank as null', () => {
    expect(trimToNull('  ')).toBeNull();
    expect(trimToNull('x')).toBe('x');
  });

  it('normalizeEmail rejects malformed addresses', () => {
    expect(normalizeEmail('bad').malformed).toBe(true);
    expect(normalizeEmail('a@b.co').email).toBe('a@b.co');
  });

  it('parseMultiSelect splits comma lists', () => {
    expect(parseMultiSelect('A, B ,C')).toEqual(['A', 'B', 'C']);
  });

  it('normalizeSpokenEnglish enforces 1–10', () => {
    expect(normalizeSpokenEnglish('10').rating).toBe(10);
    expect(normalizeSpokenEnglish('0').invalid).toBe(true);
  });

  it('classifies document references', () => {
    expect(classifyDocumentReference('')).toBe('empty');
    expect(classifyDocumentReference('[object Object]')).toBe('object_object');
    expect(classifyDocumentReference('https://example.test/f.pdf')).toBe('https_url');
  });
});

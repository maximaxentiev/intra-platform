import { describe, expect, it } from 'vitest';
import { STAFF_DOCUMENT_SLUG_MAX_LENGTH } from './staff-document-share.constants';
import {
  normalizeStaffDocumentSlug,
  resolveStaffPublicDisplayName,
  staffDocumentSlugCandidate,
} from './staff-document-slug.util';

describe('resolveStaffPublicDisplayName', () => {
  it('prefers display name when useDisplayName is true', () => {
    expect(
      resolveStaffPublicDisplayName({
        displayName: 'Jane Doe',
        useDisplayName: true,
        legalName: 'Janet Doe',
      }),
    ).toBe('Jane Doe');
  });

  it('falls back to legal name when not using display name', () => {
    expect(
      resolveStaffPublicDisplayName({
        displayName: 'Jane Doe',
        useDisplayName: false,
        legalName: 'Janet Doe',
      }),
    ).toBe('Janet Doe');
  });
});

describe('normalizeStaffDocumentSlug', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(normalizeStaffDocumentSlug('Jane Doe')).toBe('jane-doe');
  });

  it('strips punctuation and apostrophes', () => {
    expect(normalizeStaffDocumentSlug("O'Connor, RN.")).toBe('o-connor-rn');
  });

  it('transliterates accented characters', () => {
    expect(normalizeStaffDocumentSlug('Renée François')).toBe('renee-francois');
  });

  it('collapses repeated hyphens and trims edges', () => {
    expect(normalizeStaffDocumentSlug('  --Jane---Doe--  ')).toBe('jane-doe');
  });

  it('uses fallback when name normalizes to empty', () => {
    expect(normalizeStaffDocumentSlug('   !!!   ')).toBe('staff');
  });

  it('truncates very long names', () => {
    const longName = 'a'.repeat(200);
    expect(normalizeStaffDocumentSlug(longName)).toHaveLength(STAFF_DOCUMENT_SLUG_MAX_LENGTH);
  });
});

describe('staffDocumentSlugCandidate', () => {
  it('returns base slug on first attempt', () => {
    expect(staffDocumentSlugCandidate('jane-doe', 1)).toBe('jane-doe');
  });

  it('appends numeric suffix on later attempts without exceeding max length', () => {
    const base = 'a'.repeat(STAFF_DOCUMENT_SLUG_MAX_LENGTH);
    expect(staffDocumentSlugCandidate(base, 3)).toBe(`${'a'.repeat(STAFF_DOCUMENT_SLUG_MAX_LENGTH - 2)}-3`);
  });
});

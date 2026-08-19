import { describe, expect, it } from 'vitest';
import { validateCategoryDateFields } from './dto/staff-documents.dto';

describe('validateCategoryDateFields', () => {
  it('requires VSC processedDate and rejects client expiryDate', () => {
    expect(() =>
      validateCategoryDateFields('vulnerable_sector_check', { processedDate: '2026-08-19' }),
    ).not.toThrow();

    expect(() =>
      validateCategoryDateFields('vulnerable_sector_check', {
        processedDate: '2026-08-19',
        expiryDate: '2027-08-19',
      }),
    ).toThrow(/expiryDate must not be supplied/i);
  });

  it('requires First Aid expiryDate and rejects processedDate', () => {
    expect(() =>
      validateCategoryDateFields('first_aid_cpr', { expiryDate: '2028-06-01' }),
    ).not.toThrow();

    expect(() =>
      validateCategoryDateFields('first_aid_cpr', {
        expiryDate: '2028-06-01',
        processedDate: '2026-01-01',
      }),
    ).toThrow(/processedDate must not be supplied/i);
  });
});

import { describe, expect, it } from 'vitest';
import { mapPublicStaffDocumentShareMetadata } from './staff-document-share-public.mapper';
import {
  buildCategoryComplianceMap,
  type StaffDocumentCategoryComplianceInput,
} from './staff-document-compliance.util';

function category(overrides: Partial<StaffDocumentCategoryComplianceInput>) {
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

describe('mapPublicStaffDocumentShareMetadata', () => {
  it('returns all shareable approved categories with canonical labels', () => {
    const metadata = mapPublicStaffDocumentShareMetadata({
      staff: {
        displayName: 'Jane Doe',
        useDisplayName: true,
        legalName: 'Janet Doe',
        role: 'ECE',
      },
      categories: [
        category({ documentType: 'vulnerable_sector_check' }),
        category({ documentType: 'first_aid_cpr', processedDate: null }),
        category({ documentType: 'immunizations', expiryDate: null, processedDate: null }),
        category({ documentType: 'covid19_vaccination', expiryDate: null, processedDate: null }),
      ],
      filesByType: new Map([
        [
          'vulnerable_sector_check',
          [
            {
              id: 'file-vsc',
              originalFilename: 'vsc.pdf',
              contentType: 'application/pdf',
              byteSize: 100,
              storageKey: 'secret',
              checksumSha256: 'abc',
              submissionId: 'sub-1',
              createdAt: new Date(),
            } as never,
          ],
        ],
        [
          'first_aid_cpr',
          [
            {
              id: 'file-fa',
              originalFilename: 'fa.pdf',
              contentType: 'application/pdf',
              byteSize: 100,
              storageKey: 'secret2',
              checksumSha256: 'def',
              submissionId: 'sub-2',
              createdAt: new Date(),
            } as never,
          ],
        ],
        [
          'immunizations',
          [
            {
              id: 'file-imm',
              originalFilename: 'imm.pdf',
              contentType: 'application/pdf',
              byteSize: 100,
              storageKey: 'secret3',
              checksumSha256: 'ghi',
              submissionId: 'sub-3',
              createdAt: new Date(),
            } as never,
          ],
        ],
        [
          'covid19_vaccination',
          [
            {
              id: 'file-covid',
              originalFilename: 'covid.pdf',
              contentType: 'application/pdf',
              byteSize: 100,
              storageKey: 'secret4',
              checksumSha256: 'jkl',
              submissionId: 'sub-4',
              createdAt: new Date(),
            } as never,
          ],
        ],
      ]),
    });

    expect(metadata.staff).toEqual({ displayName: 'Jane Doe', role: 'ECE' });
    expect(metadata.documents).toHaveLength(4);
    expect(metadata.documents.map((doc) => doc.label)).toEqual([
      'Vulnerable Sector Check',
      'First Aid & CPR Certification',
      'Immunizations',
      'COVID-19 Vaccination',
    ]);
    expect(metadata.documents.find((doc) => doc.documentType === 'immunizations')).toMatchObject({
      processedDate: null,
      expiryDate: null,
      expiryDisplay: 'no_expiry',
    });
    expect(metadata.documents.find((doc) => doc.documentType === 'covid19_vaccination')).toMatchObject({
      processedDate: null,
      expiryDate: null,
      expiryDisplay: 'no_expiry',
    });
    expect(JSON.stringify(metadata)).not.toMatch(
      /staffId|storageKey|checksum|reviewStatus|issueNote|submissionId|email|secret/i,
    );
  });

  it('omits missing or non-approved COVID without placeholder entries', () => {
    const metadata = mapPublicStaffDocumentShareMetadata({
      staff: {
        displayName: 'Jane Doe',
        useDisplayName: false,
        legalName: 'Jane Doe',
        role: 'ECA',
      },
      categories: [
        category({ documentType: 'covid19_vaccination', reviewStatus: 'pending_review', expiryDate: null }),
      ],
      filesByType: new Map(),
    });
    expect(metadata.documents).toEqual([]);
  });

  it('returns empty documents array when nothing is shareable', () => {
    const metadata = mapPublicStaffDocumentShareMetadata({
      staff: {
        displayName: 'Jane Doe',
        useDisplayName: false,
        legalName: 'Jane Doe',
        role: 'ECA',
      },
      categories: [category({ reviewStatus: 'pending_review' })],
      filesByType: new Map(),
    });
    expect(metadata.documents).toEqual([]);
  });
});

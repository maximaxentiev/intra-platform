import { describe, expect, it, vi } from 'vitest';
import {
  assessStaffDocumentShareReadiness,
} from './staff-document-share-readiness.util';

describe('assessStaffDocumentShareReadiness', () => {
  it('returns existing when an active share is present', async () => {
    const result = await assessStaffDocumentShareReadiness({ select: vi.fn() } as never, 'staff-1', true);
    expect(result).toEqual({ ready: true, mode: 'existing' });
  });

  it('returns generatable when shareable approved documents exist', async () => {
    const executor = {
      select: vi
        .fn()
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  id: 'set-1',
                  staffId: 'staff-1',
                  documentType: 'vulnerable_sector_check',
                  currentSubmissionId: 'sub-1',
                },
              ]),
          }),
        }))
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  id: 'sub-1',
                  documentSetId: 'set-1',
                  reviewStatus: 'approved',
                  supersededAt: null,
                  reviewedAt: new Date('2026-01-01'),
                  submittedAt: new Date('2026-01-01'),
                },
              ]),
          }),
        }))
        .mockImplementationOnce(() => ({
          from: () => ({
            where: () => Promise.resolve([{ submissionId: 'sub-1' }]),
          }),
        })),
    };

    const result = await assessStaffDocumentShareReadiness(executor as never, 'staff-1', false);
    expect(result).toEqual({ ready: true, mode: 'generatable' });
  });

  it('returns blocked when no shareable approved documents exist', async () => {
    const executor = {
      select: vi.fn().mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      })),
    };

    const result = await assessStaffDocumentShareReadiness(executor as never, 'staff-1', false);
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.reason).toContain('No approved shareable documents');
    }
  });
});

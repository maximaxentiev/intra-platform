import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ensureFreshStaffDocumentShareUrlForCentreEmail } from './staff-document-share-email.util';
import { StaffDocumentShareLifecycleService } from './staff-document-share-lifecycle.service';

vi.mock('./staff-document-share-lifecycle.service', () => ({
  StaffDocumentShareLifecycleService: vi.fn(),
}));

vi.mock('./staff-document-share.service', () => ({
  StaffDocumentShareService: vi.fn(),
}));

describe('ensureFreshStaffDocumentShareUrlForCentreEmail', () => {
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'DOCUMENT_SHARE_SIGNING_SECRET') return 'test-document-share-signing-secret-32chars-min';
      if (key === 'APP_PUBLIC_URL') return 'https://platform.intra.ca';
      return undefined;
    }),
    getOrThrow: vi.fn((key: string) => {
      if (key === 'DOCUMENT_SHARE_SIGNING_SECRET') return 'test-document-share-signing-secret-32chars-min';
      throw new Error(`missing ${key}`);
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses an existing valid share URL', async () => {
    const assessDocumentShareReadiness = vi.fn().mockResolvedValue({ ready: true, mode: 'existing' });
    vi.mocked(StaffDocumentShareLifecycleService).mockImplementation(
      () =>
        ({
          assessDocumentShareReadiness,
        }) as never,
    );

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'staff-1',
                documentSlug: 'carer-one',
                documentShareTokenHash: 'hash',
                documentShareTokenCreatedAt: new Date('2026-01-01T00:00:00Z'),
                documentShareTokenRevokedAt: null,
              },
            ]),
          }),
        }),
      }),
    };

    const url = await ensureFreshStaffDocumentShareUrlForCentreEmail(
      db as never,
      config as never,
      'staff-1',
    );

    expect(url).toContain('https://platform.intra.ca/documents/carer-one#');
    expect(assessDocumentShareReadiness).toHaveBeenCalledWith('staff-1');
  });

  it('generates a share when none is active but documents are shareable', async () => {
    const generateShareLink = vi.fn().mockResolvedValue({
      shareUrl: 'https://platform.intra.ca/documents/new-carer#token',
    });
    vi.mocked(StaffDocumentShareLifecycleService).mockImplementation(
      () =>
        ({
          assessDocumentShareReadiness: vi
            .fn()
            .mockResolvedValue({ ready: true, mode: 'generatable' }),
          generateShareLink,
        }) as never,
    );

    const url = await ensureFreshStaffDocumentShareUrlForCentreEmail(
      { select: vi.fn() } as never,
      config as never,
      'staff-1',
      'ops-1',
    );

    expect(generateShareLink).toHaveBeenCalledWith('staff-1', 'ops-1', expect.anything());
    expect(url).toBe('https://platform.intra.ca/documents/new-carer#token');
  });
});

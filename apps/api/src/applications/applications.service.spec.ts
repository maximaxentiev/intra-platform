import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from './applications.service';

const sampleApplication = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'new' as const,
  role: 'eca' as const,
  firstName: 'Jane',
  middleName: '',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '4165550100',
  gender: '',
  gtaEligible: true,
  statusInCanada: 'citizen',
  experienceDuration: '2 years',
  nannyExperienceTypes: [],
  qualificationStatus: 'registered',
  nannyTrainingCompleted: null,
  nannyTrainingDescription: '',
  vscStatus: 'clear',
  vscIssueOrRequestDate: null,
  firstAidCprStatus: 'current',
  firstAidCprExpiry: null,
  immunizationStatus: 'complete',
  covidVaccinationStatus: 'yes',
  englishProficiency: 'fluent',
  additionalLanguages: [],
  formId: 'network',
  externalSubmissionId: '22222222-2222-4222-8222-222222222222',
  sourcePage: '/join',
  sourceUrl: 'https://intra.ca/join',
  consentAccepted: true,
  consentPolicyVersion: '2026-07-01',
  consentAcceptedAt: new Date('2026-07-28T12:00:00Z'),
  submittedAt: new Date('2026-07-28T12:00:00Z'),
  contactedAt: null,
  contactedByUserId: null,
  hiredAt: null,
  hiredByUserId: null,
  hiredStaffId: null,
  rejectedAt: null,
  rejectedByUserId: null,
  rejectionEmailSentAt: null,
  payloadSnapshot: { source: 'test' },
  createdAt: new Date('2026-07-28T12:00:00Z'),
  updatedAt: new Date('2026-07-28T12:00:00Z'),
};

function createMockDb() {
  const chain = {
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    from: vi.fn(),
  };
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockResolvedValue([sampleApplication]);
  chain.from.mockReturnValue(chain);

  const countChain = {
    where: vi.fn(),
    from: vi.fn(),
  };
  countChain.where.mockResolvedValue([{ count: 1 }]);
  countChain.from.mockReturnValue(countChain);

  let selectCall = 0;
  const db = {
    select: vi.fn(() => {
      selectCall += 1;
      return selectCall === 1 ? chain : countChain;
    }),
  };

  return { db, chain, countChain };
}

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let db: ReturnType<typeof createMockDb>['db'];
  let chain: ReturnType<typeof createMockDb>['chain'];

  beforeEach(() => {
    const mock = createMockDb();
    db = mock.db;
    chain = mock.chain;
    service = new ApplicationsService(db as never, { getObjectStream: vi.fn() } as never);
  });

  it('lists applications with pagination defaults', async () => {
    const result = await service.list({});
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.limit).toBe(25);
    expect(result.offset).toBe(0);
    expect(result.items[0]?.email).toBe('jane@example.com');
    expect(chain.limit).toHaveBeenCalledWith(25);
    expect(chain.offset).toHaveBeenCalledWith(0);
  });

  it('applies role, status, and search filters', async () => {
    await service.list({ role: 'nanny', status: 'contacted', q: 'jane', limit: 10, offset: 5 });
    expect(chain.where).toHaveBeenCalled();
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(chain.offset).toHaveBeenCalledWith(5);
  });

  it('returns structured application detail without storage keys', async () => {
    const appChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([sampleApplication]),
    };
    const docsChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    db.select = vi.fn().mockReturnValueOnce(appChain).mockReturnValueOnce(docsChain);

    const result = await service.get(sampleApplication.id);
    expect(result.applicant.firstName).toBe('Jane');
    expect(result.compliance.vscStatus).toBe('clear');
    expect(result.metadata.formId).toBe('network');
    expect(result.documents).toEqual([]);
    expect(result.hiring).toBeNull();
    expect(JSON.stringify(result)).not.toContain('storageKey');
  });

  it('throws when application is missing', async () => {
    const emptyChain = {
      where: vi.fn().mockResolvedValue([]),
      from: vi.fn().mockReturnThis(),
    };
    emptyChain.from.mockReturnValue(emptyChain);
    db.select = vi.fn().mockReturnValue(emptyChain);

    await expect(service.get('00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

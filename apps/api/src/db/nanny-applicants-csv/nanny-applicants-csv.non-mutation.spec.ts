import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NANNY_CSV_COLUMNS } from './nanny-applicants-csv.constants';

const poolMock = vi.fn();
vi.mock('pg', () => ({
  Pool: class MockPool {
    constructor(...args: unknown[]) {
      poolMock(...args);
    }

    end = vi.fn(async () => undefined);

    query = vi.fn(async () => ({ rows: [] }));
  },
}));

const storageCtor = vi.fn();
const uploadObjectMock = vi.fn();
const deleteObjectMock = vi.fn();
vi.mock('../../storage/storage.service', () => ({
  StorageService: class MockStorageService {
    constructor() {
      storageCtor();
    }

    uploadObject = uploadObjectMock;

    deleteObject = deleteObjectMock;
  },
}));

const migrateMock = vi.fn();
vi.mock('./nanny-applicants-csv.migrate-documents', () => ({
  migrateHistoricalDocumentsForApplication: (...args: unknown[]) => migrateMock(...args),
  findHistoricalImportApplicationId: vi.fn(),
}));

function csvHeaderLine(): string {
  return Object.values(NANNY_CSV_COLUMNS)
    .map((h) => `"${h.replace(/"/g, '""')}"`)
    .join(',');
}

/** One importable row without document URLs (preflight/dry-run wiring only). */
function minimalImportableCsv(): string {
  const row = `${randomUuid()},Import,Test,,import@example.test,+15555550100,Toronto,M1M1M1,Woman,Yes,Citizen,Yes,,,,,,Yes,1 to 2 years,Nanny,Preschool: 3 to 5 years,Infants,,ECE,Program,Yes,2027-01-01,No,,,10,,[object Object]`;
  return `${csvHeaderLine()}\n${row}\n`;
}

function randomUuid(): string {
  return '9beeaa87-cd42-4f83-ac09-5a1be7ef8396';
}

describe('nanny import preflight and dry-run safety', () => {
  beforeEach(() => {
    poolMock.mockClear();
    storageCtor.mockClear();
    uploadObjectMock.mockClear();
    deleteObjectMock.mockClear();
    migrateMock.mockClear();
    migrateMock.mockResolvedValue({
      resume: 'not_applicable',
      vsc: 'not_applicable',
      resumeError: null,
      vscError: null,
    });
  });

  it('document preflight does not open DB write path, storage, or document migration', async () => {
    const { runNannyApplicantCsvImport } = await import('./nanny-applicants-csv.runner');
    const preflightModule = await import('./nanny-applicants-csv.document-preflight');
    const preflightSpy = vi.spyOn(preflightModule, 'runDocumentPreflight').mockResolvedValue({
      report: {
        importableApplicationRows: 1,
        blockedApplicationRows: 0,
        resumeReferencesExpected: 0,
        resumeRetrievalSuccesses: 0,
        resumeRetrievalFailures: 0,
        resumeInvalidUnsupported: 0,
        resumeFormatCounts: {},
        vscReferencesExpected: 0,
        vscRetrievalSuccesses: 0,
        vscRetrievalFailures: 0,
        vscInvalidUnsupported: 0,
        vscFormatCounts: {},
        totalBytesRetrieved: 0,
        oversizedCount: 0,
        htmlMasqueradeCount: 0,
        rowsFullyReady: 1,
        rowsReadyExceptOptionalVsc: 1,
        rowsBlockedMissingResume: 0,
        rowsManualDocumentRecovery: 0,
        httpStatusCounts: {},
      },
      rowResults: [],
    });

    const result = await runNannyApplicantCsvImport(
      ['node', 'script', '--file', 'C:\\fake.csv', '--preflight-documents'],
      { DATABASE_URL: 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra' },
      { readFile: () => minimalImportableCsv() },
    );

    expect(result.mode).toBe('preflight');
    expect(poolMock).not.toHaveBeenCalled();
    expect(storageCtor).not.toHaveBeenCalled();
    expect(uploadObjectMock).not.toHaveBeenCalled();
    expect(deleteObjectMock).not.toHaveBeenCalled();
    expect(migrateMock).not.toHaveBeenCalled();
    expect(preflightSpy).toHaveBeenCalled();
    preflightSpy.mockRestore();
  });

  it('dry-run does not upload storage objects or run document migration', async () => {
    const { runNannyApplicantCsvImport } = await import('./nanny-applicants-csv.runner');

    const result = await runNannyApplicantCsvImport(
      ['node', 'script', '--file', 'C:\\fake.csv'],
      {},
      { readFile: () => minimalImportableCsv() },
    );

    expect(result.mode).toBe('dry_run');
    expect(storageCtor).not.toHaveBeenCalled();
    expect(uploadObjectMock).not.toHaveBeenCalled();
    expect(deleteObjectMock).not.toHaveBeenCalled();
    expect(migrateMock).not.toHaveBeenCalled();
  });
});

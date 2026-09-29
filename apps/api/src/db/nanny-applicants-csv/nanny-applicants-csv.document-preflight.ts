import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { MappedHistoricalRow } from './nanny-applicants-csv.map';
import {
  fetchHistoricalDocument,
  type HistoricalDocumentFetcher,
} from './nanny-applicants-csv.document-fetch';

export interface DocumentPreflightRowResult {
  sourceRowId: string;
  rowNumber: number;
  blocked: boolean;
  resumeExpected: boolean;
  resumeOk: boolean;
  resumeError: string | null;
  resumeFormat: string | null;
  resumeBytes: number;
  vscExpected: boolean;
  vscOk: boolean;
  vscError: string | null;
  vscFormat: string | null;
  vscBytes: number;
  fullyReady: boolean;
  readyExceptOptionalVsc: boolean;
  blockedMissingResume: boolean;
  manualRecovery: boolean;
}

export interface DocumentPreflightReport {
  importableApplicationRows: number;
  blockedApplicationRows: number;
  resumeReferencesExpected: number;
  resumeRetrievalSuccesses: number;
  resumeRetrievalFailures: number;
  resumeInvalidUnsupported: number;
  resumeFormatCounts: Record<string, number>;
  vscReferencesExpected: number;
  vscRetrievalSuccesses: number;
  vscRetrievalFailures: number;
  vscInvalidUnsupported: number;
  vscFormatCounts: Record<string, number>;
  totalBytesRetrieved: number;
  oversizedCount: number;
  htmlMasqueradeCount: number;
  rowsFullyReady: number;
  rowsReadyExceptOptionalVsc: number;
  rowsBlockedMissingResume: number;
  rowsManualDocumentRecovery: number;
  httpStatusCounts: Record<string, number>;
}

function increment(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

export async function runDocumentPreflight(
  rows: MappedHistoricalRow[],
  options: {
    fetchImpl?: HistoricalDocumentFetcher;
    saveValidationDir?: string;
  } = {},
): Promise<{ report: DocumentPreflightReport; rowResults: DocumentPreflightRowResult[] }> {
  const rowResults: DocumentPreflightRowResult[] = [];
  const report: DocumentPreflightReport = {
    importableApplicationRows: 0,
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
    rowsFullyReady: 0,
    rowsReadyExceptOptionalVsc: 0,
    rowsBlockedMissingResume: 0,
    rowsManualDocumentRecovery: 0,
    httpStatusCounts: {},
  };

  for (const row of rows) {
    if (row.blocked) {
      report.blockedApplicationRows += 1;
      rowResults.push({
        sourceRowId: row.sourceRowId,
        rowNumber: row.rowNumber,
        blocked: true,
        resumeExpected: false,
        resumeOk: false,
        resumeError: null,
        resumeFormat: null,
        resumeBytes: 0,
        vscExpected: false,
        vscOk: false,
        vscError: null,
        vscFormat: null,
        vscBytes: 0,
        fullyReady: false,
        readyExceptOptionalVsc: false,
        blockedMissingResume: false,
        manualRecovery: true,
      });
      continue;
    }

    report.importableApplicationRows += 1;
    const resumeUrl = row.payload.documents.resume.sourceUrl;
    const vscUrl = row.payload.documents.vsc.sourceUrl;
    const resumeExpected = row.payload.documents.resume.referenceKind === 'https_url' && !!resumeUrl;
    const vscExpected = row.payload.documents.vsc.referenceKind === 'https_url' && !!vscUrl;

    let resumeOk = false;
    let resumeError: string | null = null;
    let resumeFormat: string | null = null;
    let resumeBytes = 0;

    let vscOk = false;
    let vscError: string | null = null;
    let vscFormat: string | null = null;
    let vscBytes = 0;

    if (resumeExpected) {
      report.resumeReferencesExpected += 1;
      const fetched = await fetchHistoricalDocument(resumeUrl!, 'resume', options.fetchImpl);
      if (fetched.httpStatus != null) increment(report.httpStatusCounts, String(fetched.httpStatus));
      if (fetched.errorCode === 'too_large') report.oversizedCount += 1;
      if (fetched.errorCode === 'html_error') report.htmlMasqueradeCount += 1;
      if (fetched.ok && fetched.buffer) {
        report.resumeRetrievalSuccesses += 1;
        resumeOk = true;
        resumeFormat = fetched.detectedFormat;
        resumeBytes = fetched.byteSize;
        report.totalBytesRetrieved += fetched.byteSize;
        increment(report.resumeFormatCounts, fetched.detectedFormat ?? 'unknown');
        if (options.saveValidationDir) {
          mkdirSync(join(options.saveValidationDir, row.sourceRowId), { recursive: true });
          writeFileSync(join(options.saveValidationDir, row.sourceRowId, 'resume.bin'), fetched.buffer);
        }
      } else {
        report.resumeRetrievalFailures += 1;
        if (fetched.errorCode === 'unsupported_type') report.resumeInvalidUnsupported += 1;
        resumeError = fetched.errorCode ?? 'http_error';
      }
    } else {
      resumeError = 'missing_reference';
    }

    if (vscExpected) {
      report.vscReferencesExpected += 1;
      const fetched = await fetchHistoricalDocument(vscUrl!, 'vsc', options.fetchImpl);
      if (fetched.httpStatus != null) increment(report.httpStatusCounts, String(fetched.httpStatus));
      if (fetched.errorCode === 'too_large') report.oversizedCount += 1;
      if (fetched.errorCode === 'html_error') report.htmlMasqueradeCount += 1;
      if (fetched.ok && fetched.buffer) {
        report.vscRetrievalSuccesses += 1;
        vscOk = true;
        vscFormat = fetched.detectedFormat;
        vscBytes = fetched.byteSize;
        report.totalBytesRetrieved += fetched.byteSize;
        increment(report.vscFormatCounts, fetched.detectedFormat ?? 'unknown');
        if (options.saveValidationDir) {
          mkdirSync(join(options.saveValidationDir, row.sourceRowId), { recursive: true });
          writeFileSync(join(options.saveValidationDir, row.sourceRowId, 'vsc.bin'), fetched.buffer);
        }
      } else {
        report.vscRetrievalFailures += 1;
        if (fetched.errorCode === 'unsupported_type') report.vscInvalidUnsupported += 1;
        vscError = fetched.errorCode ?? 'http_error';
      }
    }

    const blockedMissingResume = resumeExpected && !resumeOk;
    const fullyReady = resumeOk && (!vscExpected || vscOk);
    const readyExceptOptionalVsc = resumeOk && !blockedMissingResume;
    const manualRecovery = blockedMissingResume || (vscExpected && !vscOk);

    if (fullyReady) report.rowsFullyReady += 1;
    if (readyExceptOptionalVsc) report.rowsReadyExceptOptionalVsc += 1;
    if (blockedMissingResume) report.rowsBlockedMissingResume += 1;
    if (manualRecovery) report.rowsManualDocumentRecovery += 1;

    rowResults.push({
      sourceRowId: row.sourceRowId,
      rowNumber: row.rowNumber,
      blocked: false,
      resumeExpected,
      resumeOk,
      resumeError,
      resumeFormat,
      resumeBytes,
      vscExpected,
      vscOk,
      vscError,
      vscFormat,
      vscBytes,
      fullyReady,
      readyExceptOptionalVsc,
      blockedMissingResume,
      manualRecovery,
    });
  }

  return { report, rowResults };
}

import { NANNY_CSV_COLUMN_LIST } from './nanny-applicants-csv.constants';
import { mapCsvRecord, type MappedHistoricalRow } from './nanny-applicants-csv.map';
import { isValidCsvId, normalizeEmail, trimToNull } from './nanny-applicants-csv.normalize';
import { parseCsv, rowToRecord } from './nanny-applicants-csv.parse';

export interface NannyCsvAuditReport {
  totalRows: number;
  columnCount: number;
  headerMatchesExpected: boolean;
  unexpectedHeaders: string[];
  missingExpectedHeaders: string[];
  duplicateSourceIds: number;
  duplicateEmails: number;
  missingFirstName: number;
  missingLastName: number;
  missingEmail: number;
  malformedEmails: number;
  invalidSourceIds: number;
  resumePresent: number;
  resumeMissing: number;
  resumeHttps: number;
  resumeMalformed: number;
  vscPresent: number;
  vscMissing: number;
  vscHttps: number;
  vscMalformed: number;
  sourceObjectObject: number;
  blockedRows: number;
  importableRows: number;
  normalizationFlagCounts: Record<string, number>;
  blockReasonCounts: Record<string, number>;
  uniqueCanadaStatusCount: number;
  uniqueCityCount: number;
  uniqueGenderCount: number;
  mapped: MappedHistoricalRow[];
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function auditNannyApplicantsCsv(csvText: string): NannyCsvAuditReport {
  const { headers, rows } = parseCsv(csvText);
  const expected = new Set(NANNY_CSV_COLUMN_LIST);
  const headerSet = new Set(headers);
  const unexpectedHeaders = headers.filter((h) => !expected.has(h as (typeof NANNY_CSV_COLUMN_LIST)[number]));
  const missingExpectedHeaders = NANNY_CSV_COLUMN_LIST.filter((h) => !headerSet.has(h));

  const idCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();
  const canadaStatuses = new Set<string>();
  const cities = new Set<string>();
  const genders = new Set<string>();
  const normalizationFlagCounts: Record<string, number> = {};
  const blockReasonCounts: Record<string, number> = {};
  const mapped: MappedHistoricalRow[] = [];

  let missingFirstName = 0;
  let missingLastName = 0;
  let missingEmail = 0;
  let malformedEmails = 0;
  let invalidSourceIds = 0;
  let resumePresent = 0;
  let resumeMissing = 0;
  let resumeHttps = 0;
  let resumeMalformed = 0;
  let vscPresent = 0;
  let vscMissing = 0;
  let vscHttps = 0;
  let vscMalformed = 0;
  let sourceObjectObject = 0;
  let blockedRows = 0;

  rows.forEach((row, index) => {
    const record = rowToRecord(headers, row);
    const rowNumber = index + 2;
    const mappedRow = mapCsvRecord(record, rowNumber);

    const id = trimToNull(record.ID);
    if (!isValidCsvId(id)) invalidSourceIds += 1;
    if (id) {
      const seen = idCounts.get(id) ?? 0;
      idCounts.set(id, seen + 1);
      if (seen > 0) {
        mappedRow.blocked = true;
        mappedRow.blockReasons.push('duplicate_source_id_in_csv');
      }
    }

    mapped.push(mappedRow);

    const emailNorm = normalizeEmail(trimToNull(record['Email Address']));
    if (!trimToNull(record['First Name'])) missingFirstName += 1;
    if (!trimToNull(record['Last Name'])) missingLastName += 1;
    if (!emailNorm.email) missingEmail += 1;
    if (emailNorm.malformed) malformedEmails += 1;
    if (emailNorm.email) emailCounts.set(emailNorm.email, (emailCounts.get(emailNorm.email) ?? 0) + 1);

    const city = trimToNull(record['What city or city do you currently live in?']);
    if (city) cities.add(city);
    const gender = trimToNull(record.Gender);
    if (gender) genders.add(gender);
    const status = trimToNull(record['What is your current status in Canada?']);
    if (status) canadaStatuses.add(status);

    const resumeKind = mappedRow.payload.documents.resume.referenceKind;
    if (resumeKind === 'empty') resumeMissing += 1;
    else {
      resumePresent += 1;
      if (resumeKind === 'https_url') resumeHttps += 1;
      else resumeMalformed += 1;
    }

    const vscKind = mappedRow.payload.documents.vsc.referenceKind;
    if (vscKind === 'empty') vscMissing += 1;
    else {
      vscPresent += 1;
      if (vscKind === 'https_url') vscHttps += 1;
      else vscMalformed += 1;
    }

    if (trimToNull(record.Source) === '[object Object]') sourceObjectObject += 1;

    for (const flag of mappedRow.normalizationFlags) increment(normalizationFlagCounts, flag);
  });

  for (const mappedRow of mapped) {
    if (mappedRow.blocked) {
      blockedRows += 1;
      for (const reason of mappedRow.blockReasons) increment(blockReasonCounts, reason);
    }
  }

  let duplicateSourceIds = 0;
  for (const count of idCounts.values()) {
    if (count > 1) duplicateSourceIds += count - 1;
  }
  let duplicateEmails = 0;
  for (const count of emailCounts.values()) {
    if (count > 1) duplicateEmails += count - 1;
  }

  const importableRows = mapped.filter((m) => !m.blocked).length;

  return {
    totalRows: rows.length,
    columnCount: headers.length,
    headerMatchesExpected: unexpectedHeaders.length === 0 && missingExpectedHeaders.length === 0,
    unexpectedHeaders,
    missingExpectedHeaders,
    duplicateSourceIds,
    duplicateEmails,
    missingFirstName,
    missingLastName,
    missingEmail,
    malformedEmails,
    invalidSourceIds,
    resumePresent,
    resumeMissing,
    resumeHttps,
    resumeMalformed,
    vscPresent,
    vscMissing,
    vscHttps,
    vscMalformed,
    sourceObjectObject,
    blockedRows,
    importableRows,
    normalizationFlagCounts,
    blockReasonCounts,
    uniqueCanadaStatusCount: canadaStatuses.size,
    uniqueCityCount: cities.size,
    uniqueGenderCount: genders.size,
    mapped,
  };
}

export interface DryRunImportReport {
  wouldInsert: number;
  wouldSkipExisting: number;
  blocked: number;
  blockReasonCounts: Record<string, number>;
  duplicateExternalIdsInCsv: number;
  duplicateEmailsInCsv: number;
}

export function dryRunImportReport(
  audit: NannyCsvAuditReport,
  existingExternalIds: Set<string>,
): DryRunImportReport {
  let wouldInsert = 0;
  let wouldSkipExisting = 0;
  let blocked = 0;
  const blockReasonCounts: Record<string, number> = { ...audit.blockReasonCounts };

  for (const row of audit.mapped) {
    if (row.blocked) {
      blocked += 1;
      continue;
    }
    if (existingExternalIds.has(row.externalSubmissionId)) {
      wouldSkipExisting += 1;
      continue;
    }
    wouldInsert += 1;
  }

  return {
    wouldInsert,
    wouldSkipExisting,
    blocked,
    blockReasonCounts,
    duplicateExternalIdsInCsv: audit.duplicateSourceIds,
    duplicateEmailsInCsv: audit.duplicateEmails,
  };
}

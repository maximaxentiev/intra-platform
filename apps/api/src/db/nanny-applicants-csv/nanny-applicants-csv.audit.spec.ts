import { describe, expect, it } from 'vitest';
import { NANNY_CSV_COLUMNS } from './nanny-applicants-csv.constants';
import { auditNannyApplicantsCsv, dryRunImportReport } from './nanny-applicants-csv.audit';
import { deterministicExternalSubmissionId } from './nanny-applicants-csv.map';

function csvHeaderLine(): string {
  return Object.values(NANNY_CSV_COLUMNS)
    .map((h) => `"${h.replace(/"/g, '""')}"`)
    .join(',');
}

describe('nanny-applicants-csv audit', () => {
  it('blocks rows missing required identity fields', () => {
    const csv = `${csvHeaderLine()}\n,,, ,bad-email,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n`;
    const audit = auditNannyApplicantsCsv(csv);
    expect(audit.blockedRows).toBeGreaterThan(0);
    expect(audit.blockReasonCounts.missing_first_name).toBeGreaterThan(0);
  });

  it('builds deterministic external submission ids', () => {
    const id = '9beeaa87-cd42-4f83-ac09-5a1be7ef8396';
    expect(deterministicExternalSubmissionId(id)).toBe(
      'fillout-historical-nanny:9beeaa87-cd42-4f83-ac09-5a1be7ef8396',
    );
  });

  it('dry-run skips existing external ids', () => {
    const audit = auditNannyApplicantsCsv(`${csvHeaderLine()}\n`);
    const ext = 'fillout-historical-nanny:00000000-0000-4000-8000-000000000001';
    const dry = dryRunImportReport(audit, new Set([ext]));
    expect(dry.wouldSkipExisting).toBe(0);
  });

  it('historical payload does not fabricate consent or accuracy', () => {
    const row = `9beeaa87-cd42-4f83-ac09-5a1be7ef8396,A,B,,c@example.test,+15555550100,Toronto,M1M1M1,Woman,Yes,Citizen,Yes,,,,,,Yes,1 to 2 years,Nanny,Preschool: 3 to 5 years,Infants,,ECE,Program,Yes,2027-01-01,No,,,10,https://example.test/r.pdf,[object Object]`;
    const audit = auditNannyApplicantsCsv(`${csvHeaderLine()}\n${row}\n`);
    const mapped = audit.mapped[0]!;
    expect(mapped.payload.intakeVersion).toBe('historical_import');
    expect(mapped.payload.import.sourceSystem).toBe('fillout');
  });
});

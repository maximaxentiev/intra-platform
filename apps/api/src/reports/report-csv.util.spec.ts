import { describe, expect, it } from 'vitest';
import {
  buildCsvContent,
  csvNumberCell,
  csvTextCell,
  formatTorontoTimestampForCsv,
  minutesToCsvHours,
  reportCsvFilename,
} from './report-csv.util';

describe('report-csv.util', () => {
  it('escapes commas and quotes', () => {
    expect(csvTextCell('Centre, North')).toBe('"Centre, North"');
    expect(csvTextCell('Say "hello"')).toBe('"Say ""hello"""');
  });

  it('escapes newlines', () => {
    expect(csvTextCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('prefixes formula injection characters', () => {
    expect(csvTextCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvTextCell('+1234')).toBe("'+1234");
    expect(csvTextCell('-evil')).toBe("'-evil");
    expect(csvTextCell('@cmd')).toBe("'@cmd");
  });

  it('preserves Unicode text', () => {
    expect(csvTextCell('Montréal')).toBe('Montréal');
  });

  it('builds CSV with BOM and headers', () => {
    const csv = buildCsvContent(['Name', 'Count'], [[csvTextCell('Alpha'), csvNumberCell(5)]]);
    expect(csv.startsWith('\uFEFFName,Count')).toBe(true);
    expect(csv).toContain('Alpha,5');
  });

  it('converts minutes to decimal hours', () => {
    expect(minutesToCsvHours(480)).toBe(8);
    expect(minutesToCsvHours(450)).toBe(7.5);
  });

  it('formats descriptive filenames', () => {
    expect(reportCsvFilename('shift-fulfillment', '2026-08-01', '2026-08-31')).toBe(
      'shift-fulfillment-2026-08-01-to-2026-08-31.csv',
    );
  });

  it('formats Toronto timestamps deterministically', () => {
    const formatted = formatTorontoTimestampForCsv('2026-08-15T14:30:00.000Z');
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

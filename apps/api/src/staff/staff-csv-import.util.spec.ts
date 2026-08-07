import { describe, expect, it } from 'vitest';
import {
  buildPreviewRows,
  mapCsvHeaders,
  normalizeImportedCsvCell,
  parseCsvRows,
  summarizePreview,
} from './staff-csv-import.util';
import { STAFF_CSV_MAX_ROWS } from './staff-csv-import.config';

const HEADER =
  'Display Name,Legal First Name,Legal Last Name,Email Address,Phone Number,Home Address,City';

function csv(...dataRows: string[]) {
  return [HEADER, ...dataRows].join('\n');
}

describe('normalizeImportedCsvCell', () => {
  it('trims whitespace and BOM without stripping formula-like prefixes', () => {
    expect(normalizeImportedCsvCell('  +1 416 555 0123  ')).toBe('+1 416 555 0123');
    expect(normalizeImportedCsvCell('-123 Example Road')).toBe('-123 Example Road');
    expect(normalizeImportedCsvCell('+Plus Childcare')).toBe('+Plus Childcare');
    expect(normalizeImportedCsvCell('@Example')).toBe('@Example');
    expect(normalizeImportedCsvCell('=SUM(1,2)')).toBe('=SUM(1,2)');
  });
});

describe('mapCsvHeaders', () => {
  it('accepts canonical and alias headers', () => {
    const { missing, mapping } = mapCsvHeaders(
      'Display Name,Legal First Name,Legal Last Name,Email,Phone,Home Address,City'.split(','),
    );
    expect(missing).toEqual([]);
    expect(mapping.email_address).toBe(3);
  });

  it('reports missing required headers', () => {
    const { missing } = mapCsvHeaders(['Email', 'City']);
    expect(missing.length).toBeGreaterThan(0);
  });
});

describe('buildPreviewRows preserved field values', () => {
  const empty = new Set<string>();

  it('preserves phone numbers beginning with +', () => {
    const { rows } = buildPreviewRows(
      csv('+Plus Childcare,@Example,Carer,ok@example.test,+1 416 555 0123,-123 Example Road,Toronto'),
      empty,
      empty,
    );
    expect(rows[0]!.phone).toBe('+1 416 555 0123');
    expect(rows[0]!.address).toBe('-123 Example Road');
    expect(rows[0]!.displayName).toBe('+Plus Childcare');
    expect(rows[0]!.legalFirstName).toBe('@Example');
  });

  it('stores formula-like display names as literal text without execution', () => {
    const { rows } = buildPreviewRows(
      csv('"=SUM(1,2)",Alex,Carer,formula@example.test,555,1 Main,Toronto'),
      empty,
      empty,
    );
    expect(rows[0]!.displayName).toBe('=SUM(1,2)');
    expect(rows[0]!.status).toBe('valid');
  });

  it('validates a valid row', () => {
    const { rows } = buildPreviewRows(
      csv('Alex C,Alex,Carer,carer@example.test,555,1 Main,Toronto'),
      empty,
      empty,
    );
    expect(rows[0]!.status).toBe('valid');
    expect(rows[0]!.email).toBe('carer@example.test');
  });

  it('lowercases and trims email only', () => {
    const { rows } = buildPreviewRows(
      csv('Alex C,Alex,Carer,  Carer@Example.TEST ,555,1 Main,Toronto'),
      empty,
      empty,
    );
    expect(rows[0]!.email).toBe('carer@example.test');
  });

  it('flags missing required values', () => {
    const { rows } = buildPreviewRows(csv('Alex C,,Carer,carer@example.test,555,1 Main,'), empty, empty);
    expect(rows[0]!.status).toBe('invalid');
    expect(rows[0]!.issues.length).toBeGreaterThan(0);
  });

  it('flags invalid email', () => {
    const { rows } = buildPreviewRows(
      csv('Alex C,Alex,Carer,not-an-email,555,1 Main,Toronto'),
      empty,
      empty,
    );
    expect(rows[0]!.status).toBe('invalid');
  });

  it('flags duplicate emails within CSV', () => {
    const content = csv(
      'Alex C,Alex,Carer,dup@example.test,555,1 Main,Toronto',
      'Bob,B,B,dup@example.test,555,2 Main,Toronto',
    );
    const { rows } = buildPreviewRows(content, empty, empty);
    expect(rows[1]!.status).toBe('duplicate');
  });

  it('flags duplicate existing staff email', () => {
    const existing = new Set(['taken@example.test']);
    const { rows } = buildPreviewRows(
      csv('Alex C,Alex,Carer,taken@example.test,555,1 Main,Toronto'),
      existing,
      empty,
    );
    expect(rows[0]!.status).toBe('duplicate');
  });

  it('flags duplicate portal account email', () => {
    const portal = new Set(['portal@example.test']);
    const { rows } = buildPreviewRows(
      csv('Alex C,Alex,Carer,portal@example.test,555,1 Main,Toronto'),
      empty,
      portal,
    );
    expect(rows[0]!.status).toBe('duplicate');
  });

  it('summarizes preview counts', () => {
    const content = csv(
      'Alex C,Alex,Carer,ok@example.test,555,1 Main,Toronto',
      'Bad,,X,bad,555,1 Main,Toronto',
    );
    const { rows } = buildPreviewRows(content, empty, empty);
    const summary = summarizePreview(rows);
    expect(summary.total).toBe(2);
    expect(summary.valid).toBe(1);
    expect(summary.invalid).toBe(1);
  });
});

describe('parseCsvRows row limit', () => {
  it('detects row limit in buildPreviewRows', () => {
    const lines = [HEADER];
    for (let i = 0; i < STAFF_CSV_MAX_ROWS + 1; i++) {
      lines.push(`Name${i},A,B,e${i}@example.test,555,Addr,City`);
    }
    const { rowLimitExceeded } = buildPreviewRows(lines.join('\n'), new Set(), new Set());
    expect(rowLimitExceeded).toBe(true);
  });
});

describe('parseCsvRows', () => {
  it('parses quoted commas', () => {
    const rows = parseCsvRows('a,b\n"hello, world",c');
    expect(rows[1]![0]).toBe('hello, world');
  });
});

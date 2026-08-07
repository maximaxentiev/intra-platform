import { describe, expect, it } from 'vitest';
import {
  buildPreviewRows,
  mapCsvHeaders,
  normalizeImportedCsvCell,
  parseCsvRows,
  summarizePreview,
} from './staff-csv-import.util';
import { STAFF_CSV_MAX_ROWS } from './staff-csv-import.config';
import { STAFF_ROLE_ERROR_MESSAGE } from './staff-role.util';

const HEADER =
  'Display Name,Legal First Name,Legal Last Name,Role,Email Address,Phone Number,Home Address,City';

function csv(...dataRows: string[]) {
  return [HEADER, ...dataRows].join('\n');
}

function validRow(
  email: string,
  role = 'ECA',
  rest = 'Alex C,Alex,Carer',
) {
  return `${rest},${role},${email},555,1 Main,Toronto`;
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
      'Display Name,Legal First Name,Legal Last Name,Role,Email,Phone,Home Address,City'.split(
        ',',
      ),
    );
    expect(missing).toEqual([]);
    expect(mapping.role).toBe(3);
    expect(mapping.email_address).toBe(4);
  });

  it('accepts Staff Role header alias', () => {
    const headers =
      'Display Name,Legal First Name,Legal Last Name,Staff Role,Email Address,Phone Number,Home Address,City'.split(
        ',',
      );
    const { missing, mapping } = mapCsvHeaders(headers);
    expect(missing).toEqual([]);
    expect(mapping.role).toBe(3);
  });

  it('accepts Staff Type header alias', () => {
    const headers =
      'Display Name,Legal First Name,Legal Last Name,Staff Type,Email Address,Phone Number,Home Address,City'.split(
        ',',
      );
    const { missing, mapping } = mapCsvHeaders(headers);
    expect(missing).toEqual([]);
    expect(mapping.role).toBe(3);
  });

  it('reports missing required headers including role', () => {
    const { missing } = mapCsvHeaders(['Email', 'City']);
    expect(missing).toContain('role');
    expect(missing.length).toBeGreaterThan(0);
  });
});

describe('buildPreviewRows role', () => {
  const empty = new Set<string>();

  it.each([
    ['ECA', 'ECA'],
    ['eca', 'ECA'],
    ['ECE', 'ECE'],
    ['ece', 'ECE'],
    ['RECE', 'ECE'],
    ['ECE/RECE', 'ECE'],
    ['ECE / RECE', 'ECE'],
    ['Nanny', 'Nanny'],
    ['nanny', 'Nanny'],
  ] as const)('normalizes CSV role %s to %s in preview', (input, expected) => {
    const { rows } = buildPreviewRows(csv(validRow('role@example.test', input)), empty, empty);
    expect(rows[0]!.role).toBe(expected);
    expect(rows[0]!.status).toBe('valid');
  });

  it('flags missing role value', () => {
    const { rows } = buildPreviewRows(
      csv('Alex C,Alex,Carer,,bad@example.test,555,1 Main,Toronto'),
      empty,
      empty,
    );
    expect(rows[0]!.status).toBe('invalid');
    expect(rows[0]!.issues.some((i) => i.includes('Role is required'))).toBe(true);
  });

  it('flags unknown role', () => {
    const { rows } = buildPreviewRows(csv(validRow('bad@example.test', 'Teacher')), empty, empty);
    expect(rows[0]!.status).toBe('invalid');
    expect(rows[0]!.issues).toContain(STAFF_ROLE_ERROR_MESSAGE);
  });

  it('rejects CSV without a role column', () => {
    const legacyHeader =
      'Display Name,Legal First Name,Legal Last Name,Email Address,Phone Number,Home Address,City';
    const { headerError, rows } = buildPreviewRows(
      `${legacyHeader}\nAlex C,Alex,Carer,a@example.test,555,1 Main,Toronto`,
      empty,
      empty,
    );
    expect(rows).toEqual([]);
    expect(headerError).toMatch(/Role/);
  });
});

describe('buildPreviewRows preserved field values', () => {
  const empty = new Set<string>();

  it('preserves phone numbers beginning with +', () => {
    const { rows } = buildPreviewRows(
      csv(
        '+Plus Childcare,@Example,Carer,ECA,ok@example.test,+1 416 555 0123,-123 Example Road,Toronto',
      ),
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
      csv('"=SUM(1,2)",Alex,Carer,ECA,formula@example.test,555,1 Main,Toronto'),
      empty,
      empty,
    );
    expect(rows[0]!.displayName).toBe('=SUM(1,2)');
    expect(rows[0]!.status).toBe('valid');
  });

  it('validates a valid row', () => {
    const { rows } = buildPreviewRows(csv(validRow('carer@example.test')), empty, empty);
    expect(rows[0]!.status).toBe('valid');
    expect(rows[0]!.email).toBe('carer@example.test');
  });

  it('lowercases and trims email only', () => {
    const { rows } = buildPreviewRows(
      csv(validRow('  Carer@Example.TEST  ')),
      empty,
      empty,
    );
    expect(rows[0]!.email).toBe('carer@example.test');
  });

  it('flags missing required values', () => {
    const { rows } = buildPreviewRows(
      csv('Alex C,,Carer,ECA,carer@example.test,555,1 Main,'),
      empty,
      empty,
    );
    expect(rows[0]!.status).toBe('invalid');
    expect(rows[0]!.issues.length).toBeGreaterThan(0);
  });

  it('flags invalid email', () => {
    const { rows } = buildPreviewRows(csv(validRow('not-an-email')), empty, empty);
    expect(rows[0]!.status).toBe('invalid');
  });

  it('flags duplicate emails within CSV', () => {
    const content = csv(
      validRow('dup@example.test'),
      validRow('dup@example.test', 'ECE', 'Bob,B,B'),
    );
    const { rows } = buildPreviewRows(content, empty, empty);
    expect(rows[1]!.status).toBe('duplicate');
  });

  it('flags duplicate existing staff email', () => {
    const existing = new Set(['taken@example.test']);
    const { rows } = buildPreviewRows(csv(validRow('taken@example.test')), existing, empty);
    expect(rows[0]!.status).toBe('duplicate');
  });

  it('flags duplicate portal account email', () => {
    const portal = new Set(['portal@example.test']);
    const { rows } = buildPreviewRows(csv(validRow('portal@example.test')), empty, portal);
    expect(rows[0]!.status).toBe('duplicate');
  });

  it('summarizes preview counts', () => {
    const content = csv(validRow('ok@example.test'), 'Bad,,X,ECA,bad,555,1 Main,Toronto');
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
      lines.push(`Name${i},A,B,ECA,e${i}@example.test,555,Addr,City`);
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

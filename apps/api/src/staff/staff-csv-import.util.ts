import {
  STAFF_CSV_CANONICAL_HEADERS,
  STAFF_CSV_MAX_ROWS,
  type StaffCsvCanonicalField,
} from './staff-csv-import.config';
import { normalizeStaffEmail } from '../staff-portal/portal-account-status.util';

/** Normalize imported CSV cell text: BOM removal and trim only (preserve +, -, @, =, etc.). */
export function normalizeImportedCsvCell(raw: string): string {
  return raw.replace(/^\uFEFF/, '').trim();
}

const HEADER_ALIASES: Record<StaffCsvCanonicalField, readonly string[]> = {
  display_name: ['display name', 'display_name', 'displayname'],
  legal_first_name: ['legal first name', 'legal_first_name', 'legal firstname'],
  legal_last_name: ['legal last name', 'legal_last_name', 'legal lastname'],
  email_address: ['email address', 'email_address', 'email', 'e-mail'],
  phone_number: ['phone number', 'phone_number', 'phone', 'mobile', 'telephone'],
  home_address: ['home address', 'home_address', 'address', 'street address'],
  city: ['city'],
};

function normalizeHeaderToken(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function mapCsvHeaders(rawHeaders: string[]): {
  mapping: Partial<Record<StaffCsvCanonicalField, number>>;
  missing: StaffCsvCanonicalField[];
  unknown: string[];
} {
  const mapping: Partial<Record<StaffCsvCanonicalField, number>> = {};
  const unknown: string[] = [];

  for (let i = 0; i < rawHeaders.length; i++) {
    const token = normalizeHeaderToken(rawHeaders[i] ?? '');
    if (!token) continue;
    let matched: StaffCsvCanonicalField | null = null;
    for (const field of STAFF_CSV_CANONICAL_HEADERS) {
      if (mapping[field] !== undefined) continue;
      if (HEADER_ALIASES[field].includes(token)) {
        matched = field;
        break;
      }
    }
    if (matched) {
      mapping[matched] = i;
    } else {
      unknown.push(rawHeaders[i]!.trim());
    }
  }

  const missing = STAFF_CSV_CANONICAL_HEADERS.filter((f) => mapping[f] === undefined);
  return { mapping, missing, unknown };
}

/** Minimal RFC4180-style CSV parser (no formula execution). */
export function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!;
    const next = content[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '') || rows.length === 0) {
        rows.push(row.map(normalizeImportedCsvCell));
      }
      row = [];
      if (ch === '\r') i++;
      continue;
    }
    if (ch === '\r') {
      row.push(field);
      field = '';
      rows.push(row.map(normalizeImportedCsvCell));
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '') || rows.length === 0) {
    rows.push(row.map(normalizeImportedCsvCell));
  }
  return rows;
}

export type StaffCsvRowDraft = {
  rowNumber: number;
  displayName: string;
  legalFirstName: string;
  legalLastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
};

export type StaffCsvPreviewRowStatus = 'valid' | 'invalid' | 'duplicate';

export type StaffCsvPreviewRow = StaffCsvRowDraft & {
  status: StaffCsvPreviewRowStatus;
  issues: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldFromRow(
  cells: string[],
  mapping: Partial<Record<StaffCsvCanonicalField, number>>,
  field: StaffCsvCanonicalField,
): string {
  const idx = mapping[field];
  if (idx === undefined) return '';
  return normalizeImportedCsvCell(cells[idx] ?? '');
}

export function buildPreviewRows(
  content: string,
  existingStaffEmails: Set<string>,
  existingPortalEmails: Set<string>,
): {
  rows: StaffCsvPreviewRow[];
  headerError: string | null;
  rowLimitExceeded: boolean;
} {
  const parsed = parseCsvRows(content);
  if (parsed.length === 0) {
    return { rows: [], headerError: 'The file is empty.', rowLimitExceeded: false };
  }

  const { mapping, missing } = mapCsvHeaders(parsed[0]!);
  if (missing.length) {
    return {
      rows: [],
      headerError: `Missing required column(s): ${missing.map((m) => m.replace(/_/g, ' ')).join(', ')}.`,
      rowLimitExceeded: false,
    };
  }

  const dataRows = parsed.slice(1).filter((cells) => cells.some((c) => c.trim() !== ''));
  if (dataRows.length > STAFF_CSV_MAX_ROWS) {
    return { rows: [], headerError: null, rowLimitExceeded: true };
  }

  const seenCsvEmails = new Map<string, number>();
  const rows: StaffCsvPreviewRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i]!;
    const rowNumber = i + 2;
    const draft: StaffCsvRowDraft = {
      rowNumber,
      displayName: fieldFromRow(cells, mapping, 'display_name').trim(),
      legalFirstName: fieldFromRow(cells, mapping, 'legal_first_name').trim(),
      legalLastName: fieldFromRow(cells, mapping, 'legal_last_name').trim(),
      email: normalizeStaffEmail(fieldFromRow(cells, mapping, 'email_address')),
      phone: fieldFromRow(cells, mapping, 'phone_number').trim(),
      address: fieldFromRow(cells, mapping, 'home_address').trim(),
      city: fieldFromRow(cells, mapping, 'city').trim(),
    };

    const issues: string[] = [];
    if (!draft.displayName) issues.push('Display name is required.');
    if (!draft.legalFirstName) issues.push('Legal first name is required.');
    if (!draft.legalLastName) issues.push('Legal last name is required.');
    if (!draft.email) issues.push('Email address is required.');
    else if (!EMAIL_RE.test(draft.email)) issues.push('Email address is invalid.');
    if (!draft.phone) issues.push('Phone number is required.');
    if (!draft.address) issues.push('Home address is required.');
    if (!draft.city) issues.push('City is required.');

    let isDuplicate = false;
    if (draft.email && seenCsvEmails.has(draft.email)) {
      issues.push(`Duplicate email in CSV (also on row ${seenCsvEmails.get(draft.email)}).`);
      isDuplicate = true;
    }
    if (draft.email && existingStaffEmails.has(draft.email)) {
      issues.push('A staff member with this email already exists.');
      isDuplicate = true;
    }
    if (draft.email && existingPortalEmails.has(draft.email)) {
      issues.push('This email is already used by a portal account.');
      isDuplicate = true;
    }

    if (draft.email) {
      seenCsvEmails.set(draft.email, rowNumber);
    }

    let status: StaffCsvPreviewRowStatus = 'valid';
    if (isDuplicate) status = 'duplicate';
    else if (issues.length) status = 'invalid';

    rows.push({ ...draft, status, issues });
  }

  return { rows, headerError: null, rowLimitExceeded: false };
}

export function summarizePreview(rows: StaffCsvPreviewRow[]) {
  const valid = rows.filter((r) => r.status === 'valid').length;
  const invalid = rows.filter((r) => r.status === 'invalid').length;
  const duplicate = rows.filter((r) => r.status === 'duplicate').length;
  return { total: rows.length, valid, invalid, duplicate };
}

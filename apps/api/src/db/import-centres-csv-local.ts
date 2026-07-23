/**
 * Safe local-dev import: CSV files → local Docker Postgres (centres only).
 *
 * Reads three local CSV exports only (does not modify the source files):
 *   - centres.csv
 *   - centre_contacts.csv
 *   - centre_secondary_channels.csv
 *
 * No Supabase, Lovable Cloud, staging, or production access.
 * Does not touch the `users` table.
 *
 * Target (real import only):
 *   DATABASE_URL — must resolve to localhost or 127.0.0.1
 *
 * Usage (from repo root):
 *   npm run db:import:centres-csv-local -- --dir "C:\path\to\csv-folder" --dry-run
 *   npm run db:import:centres-csv-local -- --dir "C:\path\to\csv-folder"
 *
 * Idempotent: INSERT … ON CONFLICT DO NOTHING. No truncates. Transaction with rollback on failure.
 */
import { readFileSync, existsSync } from 'fs';
import { join, isAbsolute } from 'path';
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import { findRepoRootEnvFile } from '../config/root-env';
import { assertLocalDatabaseUrl } from './local-db-guard';

const VALID_CHANNELS = new Set(['whatsapp', 'goto', 'email']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED_FILES = ['centres.csv', 'centre_contacts.csv', 'centre_secondary_channels.csv'] as const;

interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

interface ValidationReport {
  centres: number;
  centreContacts: number;
  centreSecondaryChannels: number;
  invalidCentreIds: number;
  missingCentreNames: number;
  invalidCentreChannels: number;
  invalidContactIds: number;
  invalidContactCentreIds: number;
  orphanContacts: number;
  invalidChannelCentreIds: number;
  orphanChannels: number;
  invalidChannelValues: number;
  duplicateChannelKeys: number;
}

function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\n' || (c === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      if (c === '\r') i++;
      continue;
    }
    if (c === '\r') continue;
    field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) throw new Error('CSV file is empty.');
  const headers = rows[0];
  const data = rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== ''));
  return { headers, rows: data };
}

function headerIndex(headers: string[], name: string): number {
  const idx = headers.indexOf(name);
  if (idx === -1) throw new Error(`CSV missing required column: ${name}`);
  return idx;
}

function loadCsvDir(dir: string) {
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(dir, file))) {
      throw new Error(`Missing required CSV file: ${join(dir, file)}`);
    }
  }

  const centres = parseCsv(readFileSync(join(dir, 'centres.csv'), 'utf8'));
  const contacts = parseCsv(readFileSync(join(dir, 'centre_contacts.csv'), 'utf8'));
  const channels = parseCsv(readFileSync(join(dir, 'centre_secondary_channels.csv'), 'utf8'));

  return { centres, contacts, channels };
}

function looksLikeCsvDir(arg: string): boolean {
  if (!arg || arg.startsWith('-')) return false;
  return existsSync(join(arg, 'centres.csv'));
}

function resolveCsvDir(): string {
  const args = process.argv.slice(2);

  const dirFlagIdx = args.indexOf('--dir');
  if (dirFlagIdx !== -1) {
    const value = args[dirFlagIdx + 1];
    if (!value || value.startsWith('-')) {
      throw new Error('--dir requires a directory path.');
    }
    return value;
  }

  for (const arg of args) {
    if (arg === '--dry-run' || arg.startsWith('-')) continue;
    if (looksLikeCsvDir(arg)) return arg;
    if (isAbsolute(arg) || arg.includes('\\') || arg.includes('/')) return arg;
  }

  const fromEnv = process.env.IMPORT_CENTRES_CSV_DIR?.trim();
  if (fromEnv) return fromEnv;

  throw new Error(
    'CSV directory required. Pass --dir "C:\\path\\to\\folder" or set IMPORT_CENTRES_CSV_DIR.',
  );
}

function validateCsvData(data: ReturnType<typeof loadCsvDir>): ValidationReport {
  const cIdx = Object.fromEntries(data.centres.headers.map((h, i) => [h, i]));
  const ctIdx = Object.fromEntries(data.contacts.headers.map((h, i) => [h, i]));
  const chIdx = Object.fromEntries(data.channels.headers.map((h, i) => [h, i]));

  headerIndex(data.centres.headers, 'id');
  headerIndex(data.centres.headers, 'name');
  headerIndex(data.contacts.headers, 'id');
  headerIndex(data.contacts.headers, 'centre_id');
  headerIndex(data.channels.headers, 'centre_id');
  headerIndex(data.channels.headers, 'channel');

  const centreIds = new Set<string>();
  let invalidCentreIds = 0;
  let missingCentreNames = 0;
  let invalidCentreChannels = 0;

  for (const r of data.centres.rows) {
    const id = r[cIdx.id]?.trim();
    if (!UUID_RE.test(id)) invalidCentreIds++;
    else centreIds.add(id.toLowerCase());
    if (!r[cIdx.name]?.trim()) missingCentreNames++;
    const ch = (r[cIdx.primary_channel]?.trim() || r[cIdx.preferred_channel]?.trim() || 'email');
    if (!VALID_CHANNELS.has(ch)) invalidCentreChannels++;
  }

  const contactIds = new Set<string>();
  let invalidContactIds = 0;
  let invalidContactCentreIds = 0;
  let orphanContacts = 0;

  for (const r of data.contacts.rows) {
    const id = r[ctIdx.id]?.trim();
    const centreId = r[ctIdx.centre_id]?.trim();
    if (!UUID_RE.test(id) || contactIds.has(id.toLowerCase())) invalidContactIds++;
    else contactIds.add(id.toLowerCase());
    if (!UUID_RE.test(centreId)) invalidContactCentreIds++;
    else if (!centreIds.has(centreId.toLowerCase())) orphanContacts++;
    const sortOrder = r[ctIdx.sort_order]?.trim();
    if (sortOrder !== undefined && sortOrder !== '' && Number.isNaN(Number(sortOrder))) {
      invalidContactIds++;
    }
  }

  const channelKeys = new Set<string>();
  let invalidChannelCentreIds = 0;
  let orphanChannels = 0;
  let invalidChannelValues = 0;
  let duplicateChannelKeys = 0;

  for (const r of data.channels.rows) {
    const centreId = r[chIdx.centre_id]?.trim();
    const channel = r[chIdx.channel]?.trim();
    if (!UUID_RE.test(centreId)) invalidChannelCentreIds++;
    else if (!centreIds.has(centreId.toLowerCase())) orphanChannels++;
    if (!VALID_CHANNELS.has(channel)) invalidChannelValues++;
    const key = `${centreId?.toLowerCase()}|${channel}`;
    if (channelKeys.has(key)) duplicateChannelKeys++;
    else channelKeys.add(key);
  }

  const report: ValidationReport = {
    centres: data.centres.rows.length,
    centreContacts: data.contacts.rows.length,
    centreSecondaryChannels: data.channels.rows.length,
    invalidCentreIds,
    missingCentreNames,
    invalidCentreChannels,
    invalidContactIds,
    invalidContactCentreIds,
    orphanContacts,
    invalidChannelCentreIds,
    orphanChannels,
    invalidChannelValues,
    duplicateChannelKeys,
  };

  const issues =
    invalidCentreIds +
    missingCentreNames +
    invalidCentreChannels +
    invalidContactIds +
    invalidContactCentreIds +
    orphanContacts +
    invalidChannelCentreIds +
    orphanChannels +
    invalidChannelValues +
    duplicateChannelKeys;

  if (issues > 0) {
    throw new Error(
      `CSV validation failed (${issues} issue(s)). Re-run with --dry-run after fixing source files.`,
    );
  }

  return report;
}

function printDryRunReport(dir: string, report: ValidationReport) {
  console.log('[import:centres-csv-local] dry-run');
  console.log(`  csv directory: ${dir}`);
  console.log(`  centres: ${report.centres}`);
  console.log(`  centre_contacts: ${report.centreContacts}`);
  console.log(`  centre_secondary_channels: ${report.centreSecondaryChannels}`);
  console.log('  uuid validation: ok');
  console.log('  channel enum validation: ok');
  console.log('  fk integrity: ok');
  console.log('  local database: not connected');
  console.log('  supabase: not used');
}

async function runImport(dir: string, data: ReturnType<typeof loadCsvDir>) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('Missing DATABASE_URL');
  assertLocalDatabaseUrl(databaseUrl);

  validateCsvData(data);

  const cIdx = Object.fromEntries(data.centres.headers.map((h, i) => [h, i]));
  const ctIdx = Object.fromEntries(data.contacts.headers.map((h, i) => [h, i]));
  const chIdx = Object.fromEntries(data.channels.headers.map((h, i) => [h, i]));

  const target = new Pool({ connectionString: databaseUrl, max: 2 });
  const client = await target.connect();

  try {
    await client.query('BEGIN');

    let centresInserted = 0;
    for (const r of data.centres.rows) {
      const primaryChannel =
        r[cIdx.primary_channel]?.trim() || r[cIdx.preferred_channel]?.trim() || 'email';
      const result = await client.query(
        `INSERT INTO centres (id, name, address, primary_channel, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [
          r[cIdx.id].trim(),
          r[cIdx.name].trim(),
          r[cIdx.address]?.trim() ?? '',
          primaryChannel,
          r[cIdx.notes]?.trim() ?? '',
          r[cIdx.created_at].trim(),
          r[cIdx.updated_at].trim(),
        ],
      );
      centresInserted += result.rowCount ?? 0;
    }

    let contactsInserted = 0;
    let contactsSkippedNoCentre = 0;
    for (const r of data.contacts.rows) {
      const centreId = r[ctIdx.centre_id].trim();
      const { rows: centreExists } = await client.query(`SELECT 1 FROM centres WHERE id = $1`, [
        centreId,
      ]);
      if (!centreExists[0]) {
        contactsSkippedNoCentre++;
        continue;
      }
      const result = await client.query(
        `INSERT INTO centre_contacts (id, centre_id, name, title, email, phone, sort_order, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [
          r[ctIdx.id].trim(),
          centreId,
          r[ctIdx.name]?.trim() ?? '',
          r[ctIdx.title]?.trim() ?? '',
          r[ctIdx.email]?.trim() ?? '',
          r[ctIdx.phone]?.trim() ?? '',
          Number(r[ctIdx.sort_order]?.trim() || 0),
          r[ctIdx.created_at].trim(),
          r[ctIdx.updated_at].trim(),
        ],
      );
      contactsInserted += result.rowCount ?? 0;
    }

    let channelsInserted = 0;
    let channelsSkippedNoCentre = 0;
    for (const r of data.channels.rows) {
      const centreId = r[chIdx.centre_id].trim();
      const channel = r[chIdx.channel].trim();
      const { rows: centreExists } = await client.query(`SELECT 1 FROM centres WHERE id = $1`, [
        centreId,
      ]);
      if (!centreExists[0]) {
        channelsSkippedNoCentre++;
        continue;
      }
      const result = await client.query(
        `INSERT INTO centre_secondary_channels (centre_id, channel, created_at)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [centreId, channel, r[chIdx.created_at].trim()],
      );
      channelsInserted += result.rowCount ?? 0;
    }

    await client.query('COMMIT');

    console.log('[import:centres-csv-local] done');
    console.log(
      `  centres inserted: ${centresInserted} (${data.centres.rows.length - centresInserted} already existed)`,
    );
    console.log(
      `  centre_contacts inserted: ${contactsInserted} (${data.contacts.rows.length - contactsInserted - contactsSkippedNoCentre} already existed, ${contactsSkippedNoCentre} skipped)`,
    );
    console.log(
      `  centre_secondary_channels inserted: ${channelsInserted} (${data.channels.rows.length - channelsInserted - channelsSkippedNoCentre} already existed, ${channelsSkippedNoCentre} skipped)`,
    );
    console.log('  local users table was not modified.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await target.end();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dir = resolveCsvDir();
  const data = loadCsvDir(dir);
  const report = validateCsvData(data);

  if (dryRun) {
    printDryRunReport(dir, report);
    return;
  }

  const rootEnvFile = findRepoRootEnvFile();
  if (rootEnvFile) loadDotenv({ path: rootEnvFile });

  await runImport(dir, data);
}

void main().catch((err) => {
  console.error('[import:centres-csv-local] failed:', (err as Error).message);
  process.exit(1);
});

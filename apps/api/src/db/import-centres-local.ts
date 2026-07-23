/**
 * Safe local-dev import: Supabase → local Docker Postgres (centres only).
 *
 * Copies READ-ONLY from Supabase:
 *   - centres
 *   - centre_contacts
 *   - centre_secondary_channels
 *
 * Does NOT import users, staff, shifts, availability, or any other tables.
 * Does NOT truncate, update, or delete existing local rows (including the
 * bootstrap admin in `users`).
 *
 * Source (pick one):
 *   SOURCE_DATABASE_URL — Supabase direct Postgres (SELECT only)
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — PostgREST (GET only)
 *
 * Target (real import only):
 *   DATABASE_URL — must resolve to localhost or 127.0.0.1 (refuses otherwise)
 *
 * Usage (from repo root):
 *   npm run db:import:centres-local -- --dry-run   # read-only source preview
 *   npm run db:import:centres-local                # import into local Postgres
 *
 * Idempotent: INSERT … ON CONFLICT DO NOTHING on all tables.
 */
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import { findRepoRootEnvFile } from '../config/root-env';
import { assertLocalDatabaseUrl } from './local-db-guard';

interface CentreRow {
  id: string;
  name: string;
  address: string | null;
  primary_channel: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CentreContactRow {
  id: string;
  centre_id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CentreSecondaryChannelRow {
  centre_id: string;
  channel: string;
  created_at: string;
}

interface SourceCounts {
  centres: number;
  centreContacts: number;
  centreSecondaryChannels: number;
  orphanContacts: number;
  orphanSecondaryChannels: number;
}

type SourceMethod = 'SOURCE_DATABASE_URL' | 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Missing ${name}`);
  return v.trim();
}

function resolveSourceMethod(): {
  method: SourceMethod;
  sourceUrl?: string;
  supabaseUrl?: string;
  serviceKey?: string;
} {
  const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (sourceUrl) {
    return { method: 'SOURCE_DATABASE_URL', sourceUrl };
  }
  if (supabaseUrl && serviceKey) {
    return { method: 'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY', supabaseUrl, serviceKey };
  }
  throw new Error(
    'Missing Supabase source credentials. Set SOURCE_DATABASE_URL or ' +
      'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.',
  );
}

async function sbFetch(base: string, key: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${path} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res;
}

async function sbCount(base: string, key: string, table: string): Promise<number> {
  const res = await sbFetch(base, key, `/rest/v1/${table}?select=id`, {
    headers: { Prefer: 'count=exact', Range: '0-0' },
  });
  const range = res.headers.get('content-range') ?? '';
  const match = range.match(/\/(\d+)$/);
  if (!match) throw new Error(`Supabase count unavailable for ${table}.`);
  return Number(match[1]);
}

async function sbSelectIds(base: string, key: string, table: string, column: string): Promise<string[]> {
  const ids: string[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const res = await sbFetch(
      base,
      key,
      `/rest/v1/${table}?select=${column}&limit=${pageSize}&offset=${offset}`,
    );
    const batch = (await res.json()) as Array<Record<string, unknown>>;
    for (const row of batch) {
      ids.push(String(row[column]));
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
    if (offset > 50000) break;
  }
  return ids;
}

async function sbSelect<T>(base: string, key: string, table: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const res = await sbFetch(base, key, `/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`);
    const batch = (await res.json()) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
    if (offset > 50000) break;
  }
  return rows;
}

function countOrphans(centreIds: Set<string>, contactCentreIds: string[], channelCentreIds: string[]) {
  let orphanContacts = 0;
  for (const id of contactCentreIds) {
    if (!centreIds.has(id)) orphanContacts++;
  }
  let orphanSecondaryChannels = 0;
  for (const id of channelCentreIds) {
    if (!centreIds.has(id)) orphanSecondaryChannels++;
  }
  return { orphanContacts, orphanSecondaryChannels };
}

async function dryRunFromPostgres(source: Pool): Promise<SourceCounts> {
  const [{ rows: centreCountRows }, { rows: contactCountRows }, { rows: channelCountRows }] =
    await Promise.all([
      source.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.centres`),
      source.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.centre_contacts`),
      source.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM public.centre_secondary_channels`,
      ),
    ]);

  const [{ rows: centreIdRows }, { rows: contactCentreIdRows }, { rows: channelCentreIdRows }] =
    await Promise.all([
      source.query<{ id: string }>(`SELECT id FROM public.centres`),
      source.query<{ centre_id: string }>(`SELECT centre_id FROM public.centre_contacts`),
      source.query<{ centre_id: string }>(`SELECT centre_id FROM public.centre_secondary_channels`),
    ]);

  const centreIds = new Set(centreIdRows.map((r) => r.id));
  const { orphanContacts, orphanSecondaryChannels } = countOrphans(
    centreIds,
    contactCentreIdRows.map((r) => r.centre_id),
    channelCentreIdRows.map((r) => r.centre_id),
  );

  return {
    centres: Number(centreCountRows[0]?.n ?? 0),
    centreContacts: Number(contactCountRows[0]?.n ?? 0),
    centreSecondaryChannels: Number(channelCountRows[0]?.n ?? 0),
    orphanContacts,
    orphanSecondaryChannels,
  };
}

async function dryRunFromSupabaseApi(supabaseUrl: string, serviceKey: string): Promise<SourceCounts> {
  const [centres, centreContacts, centreSecondaryChannels] = await Promise.all([
    sbCount(supabaseUrl, serviceKey, 'centres'),
    sbCount(supabaseUrl, serviceKey, 'centre_contacts'),
    sbCount(supabaseUrl, serviceKey, 'centre_secondary_channels'),
  ]);

  const [centreIds, contactCentreIds, channelCentreIds] = await Promise.all([
    sbSelectIds(supabaseUrl, serviceKey, 'centres', 'id'),
    sbSelectIds(supabaseUrl, serviceKey, 'centre_contacts', 'centre_id'),
    sbSelectIds(supabaseUrl, serviceKey, 'centre_secondary_channels', 'centre_id'),
  ]);

  const centreIdSet = new Set(centreIds);
  const { orphanContacts, orphanSecondaryChannels } = countOrphans(
    centreIdSet,
    contactCentreIds,
    channelCentreIds,
  );

  return {
    centres,
    centreContacts,
    centreSecondaryChannels,
    orphanContacts,
    orphanSecondaryChannels,
  };
}

async function readFromPostgres(source: Pool): Promise<{
  centres: CentreRow[];
  contacts: CentreContactRow[];
  secondaryChannels: CentreSecondaryChannelRow[];
}> {
  const { rows: centres } = await source.query<CentreRow>(`
    SELECT id, name, address,
           COALESCE(primary_channel, preferred_channel, 'email') AS primary_channel,
           notes, created_at, updated_at
    FROM public.centres ORDER BY created_at
  `);
  const { rows: contacts } = await source.query<CentreContactRow>(
    `SELECT * FROM public.centre_contacts ORDER BY sort_order`,
  );
  const { rows: secondaryChannels } = await source.query<CentreSecondaryChannelRow>(
    `SELECT * FROM public.centre_secondary_channels`,
  );
  return { centres, contacts, secondaryChannels };
}

async function readFromSupabaseApi(
  supabaseUrl: string,
  serviceKey: string,
): Promise<{
  centres: CentreRow[];
  contacts: CentreContactRow[];
  secondaryChannels: CentreSecondaryChannelRow[];
}> {
  const rawCentres = await sbSelect<Record<string, unknown>>(supabaseUrl, serviceKey, 'centres');
  const centres: CentreRow[] = rawCentres.map((c) => ({
    id: String(c.id),
    name: String(c.name),
    address: (c.address as string | null) ?? '',
    primary_channel: String(c.primary_channel ?? c.preferred_channel ?? 'email'),
    notes: (c.notes as string | null) ?? '',
    created_at: String(c.created_at),
    updated_at: String(c.updated_at),
  }));
  const contacts = await sbSelect<CentreContactRow>(supabaseUrl, serviceKey, 'centre_contacts');
  const secondaryChannels = await sbSelect<CentreSecondaryChannelRow>(
    supabaseUrl,
    serviceKey,
    'centre_secondary_channels',
  );
  return { centres, contacts, secondaryChannels };
}

function printDryRunReport(method: SourceMethod, counts: SourceCounts) {
  console.log('[import:centres-local] dry-run');
  console.log(`  source method: ${method}`);
  console.log(`  centres: ${counts.centres}`);
  console.log(`  centre_contacts: ${counts.centreContacts}`);
  console.log(`  centre_secondary_channels: ${counts.centreSecondaryChannels}`);
  console.log(
    `  all centre_contacts reference a source centre: ${counts.orphanContacts === 0 ? 'yes' : 'no'} (${counts.orphanContacts} orphan(s))`,
  );
  console.log(
    `  all centre_secondary_channels reference a source centre: ${counts.orphanSecondaryChannels === 0 ? 'yes' : 'no'} (${counts.orphanSecondaryChannels} orphan(s))`,
  );
  console.log('  local database: not connected (dry-run)');
}

async function runDryRun(source: { method: SourceMethod; sourceUrl?: string; supabaseUrl?: string; serviceKey?: string }) {
  const pool = source.sourceUrl ? new Pool({ connectionString: source.sourceUrl, max: 2 }) : null;
  try {
    const counts = pool
      ? await dryRunFromPostgres(pool)
      : await dryRunFromSupabaseApi(source.supabaseUrl!, source.serviceKey!);
    printDryRunReport(source.method, counts);
  } finally {
    await pool?.end();
  }
}

async function runImport(source: {
  method: SourceMethod;
  sourceUrl?: string;
  supabaseUrl?: string;
  serviceKey?: string;
}) {
  const databaseUrl = requireEnv('DATABASE_URL');
  assertLocalDatabaseUrl(databaseUrl);

  const target = new Pool({ connectionString: databaseUrl, max: 2 });
  const sourcePool = source.sourceUrl ? new Pool({ connectionString: source.sourceUrl, max: 2 }) : null;

  try {
    const data = sourcePool
      ? await readFromPostgres(sourcePool)
      : await readFromSupabaseApi(source.supabaseUrl!, source.serviceKey!);

    console.log('[import:centres-local] source (read-only):');
    console.log(`  source method: ${source.method}`);
    console.log(`  centres: ${data.centres.length}`);
    console.log(`  centre_contacts: ${data.contacts.length}`);
    console.log(`  centre_secondary_channels: ${data.secondaryChannels.length}`);

    const client = await target.connect();
    try {
      await client.query('BEGIN');

      let centresInserted = 0;
      for (const c of data.centres) {
        const result = await client.query(
          `INSERT INTO centres (id, name, address, primary_channel, notes, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          [c.id, c.name, c.address ?? '', c.primary_channel, c.notes ?? '', c.created_at, c.updated_at],
        );
        centresInserted += result.rowCount ?? 0;
      }

      let contactsInserted = 0;
      let contactsSkippedNoCentre = 0;
      for (const r of data.contacts) {
        const { rows: centreExists } = await client.query(`SELECT 1 FROM centres WHERE id = $1`, [
          r.centre_id,
        ]);
        if (!centreExists[0]) {
          contactsSkippedNoCentre++;
          continue;
        }
        const result = await client.query(
          `INSERT INTO centre_contacts (id, centre_id, name, title, email, phone, sort_order, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
          [
            r.id,
            r.centre_id,
            r.name,
            r.title,
            r.email,
            r.phone,
            r.sort_order,
            r.created_at,
            r.updated_at,
          ],
        );
        contactsInserted += result.rowCount ?? 0;
      }

      let channelsInserted = 0;
      let channelsSkippedNoCentre = 0;
      for (const r of data.secondaryChannels) {
        const { rows: centreExists } = await client.query(`SELECT 1 FROM centres WHERE id = $1`, [
          r.centre_id,
        ]);
        if (!centreExists[0]) {
          channelsSkippedNoCentre++;
          continue;
        }
        const result = await client.query(
          `INSERT INTO centre_secondary_channels (centre_id, channel, created_at)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [r.centre_id, r.channel, r.created_at],
        );
        channelsInserted += result.rowCount ?? 0;
      }

      await client.query('COMMIT');

      console.log('[import:centres-local] target (local only):');
      console.log(`  centres inserted: ${centresInserted} (${data.centres.length - centresInserted} already existed)`);
      console.log(
        `  centre_contacts inserted: ${contactsInserted} (${data.contacts.length - contactsInserted - contactsSkippedNoCentre} already existed, ${contactsSkippedNoCentre} skipped — missing centre)`,
      );
      console.log(
        `  centre_secondary_channels inserted: ${channelsInserted} (${data.secondaryChannels.length - channelsInserted - channelsSkippedNoCentre} already existed, ${channelsSkippedNoCentre} skipped — missing centre)`,
      );
      console.log('[import:centres-local] done. Local users table was not modified.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await sourcePool?.end();
    await target.end();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const rootEnvFile = findRepoRootEnvFile();
  if (rootEnvFile) loadDotenv({ path: rootEnvFile });

  const source = resolveSourceMethod();

  if (dryRun) {
    await runDryRun(source);
    return;
  }

  await runImport(source);
}

void main().catch((err) => {
  console.error('[import:centres-local] failed:', (err as Error).message);
  process.exit(1);
});

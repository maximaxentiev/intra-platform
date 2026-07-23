/**
 * Import legacy Supabase data via PostgREST + Auth Admin API (no direct Postgres URL).
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (server-side only).
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... npm run db:import:api
 */
import { Pool } from 'pg';

const PLACEHOLDER_HASH = '$2a$12$0000000000000000000000000000000000000000000000000000';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function sbFetch<T>(base: string, key: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
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
  return res.json() as Promise<T>;
}

async function sbSelect<T>(base: string, key: string, table: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const batch = await sbFetch<T[]>(
      base,
      key,
      `/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`,
    );
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
    if (offset > 50000) break;
  }
  return rows;
}

async function listAuthUsers(base: string, key: string) {
  const users: any[] = [];
  let page = 1;
  while (page <= 20) {
    const data = await sbFetch<{ users: any[] }>(
      base,
      key,
      `/auth/v1/admin/users?page=${page}&per_page=200`,
    );
    users.push(...data.users);
    if (data.users.length < 200) break;
    page++;
  }
  return users;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const target = new Pool({ connectionString: requireEnv('DATABASE_URL') });
  const force = process.argv.includes('--force');

  try {
    const { rows: existing } = await target.query<{ n: string }>('SELECT count(*)::text AS n FROM users');
    const count = Number(existing[0]?.n ?? 0);
    if (count > 0 && !force) {
      throw new Error(`Target DB already has ${count} user(s). Pass --force to re-import.`);
    }
    if (force && count > 0) {
      await target.query(`
        TRUNCATE shift_comments, shift_contacted, shifts, availability,
          staff_centre_banned, staff_centre_top, staff,
          centre_secondary_channels, centre_contacts, centres, users
        CASCADE
      `);
    }

    const client = await target.connect();
    try {
      await client.query('BEGIN');

      const authUsers = await listAuthUsers(supabaseUrl, serviceKey);
      const profiles = await sbSelect<any>(supabaseUrl, serviceKey, 'profiles');
      const profileById = new Map(profiles.map((p) => [p.id, p]));

      let usersWithoutHash = 0;
      for (const u of authUsers) {
        const p = profileById.get(u.id);
        const email = (u.email ?? p?.email ?? '').toLowerCase();
        if (!email) continue;
        const passwordHash = u.encrypted_password ?? PLACEHOLDER_HASH;
        if (!u.encrypted_password) usersWithoutHash++;
        const isActive = !u.deleted_at && !(u.banned_until && new Date(u.banned_until) > new Date());
        await client.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
           VALUES ($1,$2,$3,$4,'ops',$5,COALESCE($6::timestamptz, now()), now()) ON CONFLICT (id) DO NOTHING`,
          [u.id, email, passwordHash, p?.full_name ?? u.user_metadata?.full_name ?? '', isActive, u.created_at],
        );
      }
      console.log(`[import:api] users: ${authUsers.length} (${usersWithoutHash} without password hash)`);

      const centres = await sbSelect<any>(supabaseUrl, serviceKey, 'centres');
      for (const c of centres) {
        const primaryChannel = c.primary_channel ?? c.preferred_channel ?? 'email';
        await client.query(
          `INSERT INTO centres (id, name, address, primary_channel, notes, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          [c.id, c.name, c.address ?? '', primaryChannel, c.notes ?? '', c.created_at, c.updated_at],
        );
      }
      console.log(`[import:api] centres: ${centres.length}`);

      for (const table of ['centre_contacts', 'centre_secondary_channels'] as const) {
        const rows = await sbSelect<any>(supabaseUrl, serviceKey, table);
        for (const r of rows) {
          if (table === 'centre_contacts') {
            await client.query(
              `INSERT INTO centre_contacts (id, centre_id, name, title, email, phone, sort_order, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
              [r.id, r.centre_id, r.name, r.title, r.email, r.phone, r.sort_order, r.created_at, r.updated_at],
            );
          } else {
            await client.query(
              `INSERT INTO centre_secondary_channels (centre_id, channel, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
              [r.centre_id, r.channel, r.created_at],
            );
          }
        }
        console.log(`[import:api] ${table}: ${rows.length}`);
      }

      const staffRows = await sbSelect<any>(supabaseUrl, serviceKey, 'staff');
      for (const s of staffRows) {
        await client.query(
          `INSERT INTO staff (id, legal_name, display_name, use_display_name, phone, email, role, status, notes, documents_url, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
          [s.id, s.legal_name, s.display_name, s.use_display_name, s.phone, s.email, s.role, s.status, s.notes, s.documents_url, s.created_at, s.updated_at],
        );
      }
      console.log(`[import:api] staff: ${staffRows.length}`);

      for (const table of ['staff_centre_top', 'staff_centre_banned'] as const) {
        const rows = await sbSelect<any>(supabaseUrl, serviceKey, table);
        for (const r of rows) {
          await client.query(
            `INSERT INTO ${table} (staff_id, centre_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [r.staff_id, r.centre_id, r.created_at],
          );
        }
        console.log(`[import:api] ${table}: ${rows.length}`);
      }

      const avail = await sbSelect<any>(supabaseUrl, serviceKey, 'availability');
      for (const r of avail) {
        await client.query(
          `INSERT INTO availability (id, staff_id, week_start_date, day_of_week, start_time, end_time, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          [r.id, r.staff_id, r.week_start_date, r.day_of_week, r.start_time, r.end_time, r.created_at],
        );
      }
      console.log(`[import:api] availability: ${avail.length}`);

      const shiftRows = await sbSelect<any>(supabaseUrl, serviceKey, 'shifts');
      for (const s of shiftRows) {
        await client.query(
          `INSERT INTO shifts (id, centre_id, shift_date, start_time, end_time, role_needed, notes, status,
            assigned_staff_id, cancellation_reason, added_to_staffpoint, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
          [s.id, s.centre_id, s.shift_date, s.start_time, s.end_time, s.role_needed, s.notes, s.status,
            s.assigned_staff_id, s.cancellation_reason, s.added_to_staffpoint ?? false, s.created_at, s.updated_at],
        );
      }
      console.log(`[import:api] shifts: ${shiftRows.length}`);

      const contacted = await sbSelect<any>(supabaseUrl, serviceKey, 'shift_contacted');
      for (const r of contacted) {
        await client.query(
          `INSERT INTO shift_contacted (shift_id, staff_id, contacted_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [r.shift_id, r.staff_id, r.contacted_at],
        );
      }
      console.log(`[import:api] shift_contacted: ${contacted.length}`);

      const comments = await sbSelect<any>(supabaseUrl, serviceKey, 'shift_comments');
      let skipped = 0;
      for (const r of comments) {
        const { rows: author } = await client.query('SELECT 1 FROM users WHERE id = $1', [r.author_id]);
        if (!author[0]) { skipped++; continue; }
        await client.query(
          `INSERT INTO shift_comments (id, shift_id, author_id, body, created_at)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
          [r.id, r.shift_id, r.author_id, r.body, r.created_at],
        );
      }
      console.log(`[import:api] shift_comments: ${comments.length - skipped} (${skipped} skipped)`);

      await client.query('COMMIT');
      console.log('[import:api] done.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await target.end();
  }
}

void main().catch((err) => {
  console.error('[import:api] failed:', err);
  process.exit(1);
});

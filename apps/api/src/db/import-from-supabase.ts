/**
 * One-shot Supabase Postgres → droplet Postgres import (Phase 3 cutover).
 *
 * Prerequisites:
 *   1. Drizzle migrations applied to the target DB (npm run db:migrate).
 *   2. SOURCE_DATABASE_URL — Supabase *direct* Postgres connection string
 *      (Dashboard → Project Settings → Database → Connection string, session mode).
 *   3. DATABASE_URL — target droplet Postgres (same as the API uses).
 *
 * Usage:
 *   SOURCE_DATABASE_URL=postgres://... DATABASE_URL=postgres://... npm run db:import
 *
 * Users: copies auth.users.encrypted_password when present (bcrypt, compatible with
 * our verifier). Rows without a hash get a random unusable hash — re-invite those ops.
 *
 * Idempotent: skips if target already has rows unless --force is passed.
 */
import { Pool } from 'pg';

const PLACEHOLDER_HASH = '$2a$12$0000000000000000000000000000000000000000000000000000';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function count(pool: Pool, table: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`);
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  const force = process.argv.includes('--force');
  const source = new Pool({ connectionString: requireEnv('SOURCE_DATABASE_URL') });
  const target = new Pool({ connectionString: requireEnv('DATABASE_URL') });

  try {
    const existing = await count(target, 'users');
    if (existing > 0 && !force) {
      throw new Error(
        `Target DB already has ${existing} user(s). Apply migrations to a fresh DB or pass --force.`,
      );
    }

    if (force && existing > 0) {
      console.warn('[import] --force: truncating target tables…');
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

      // --- Users (auth.users + profiles → users) --------------------------------
      const { rows: authUsers } = await source.query<{
        id: string;
        email: string | null;
        encrypted_password: string | null;
        banned_until: string | null;
        deleted_at: string | null;
        full_name: string | null;
        profile_email: string | null;
      }>(`
        SELECT
          u.id,
          u.email,
          u.encrypted_password,
          u.banned_until,
          u.deleted_at,
          p.full_name,
          p.email AS profile_email
        FROM auth.users u
        LEFT JOIN public.profiles p ON p.id = u.id
        ORDER BY u.created_at
      `);

      let usersWithoutHash = 0;
      for (const u of authUsers) {
        const email = (u.email ?? u.profile_email ?? '').toLowerCase();
        if (!email) {
          console.warn(`[import] skip user ${u.id}: no email`);
          continue;
        }
        const passwordHash = u.encrypted_password ?? PLACEHOLDER_HASH;
        if (!u.encrypted_password) usersWithoutHash++;
        const isActive = !u.deleted_at && !u.banned_until;
        await client.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'ops', $5, now(), now())
           ON CONFLICT (id) DO NOTHING`,
          [u.id, email, passwordHash, u.full_name ?? '', isActive],
        );
      }
      console.log(`[import] users: ${authUsers.length} (${usersWithoutHash} need re-invite — no password hash)`);

      // --- Centres --------------------------------------------------------------
      const { rows: centreRows } = await source.query(`
        SELECT id, name, address,
               COALESCE(primary_channel, preferred_channel, 'email') AS primary_channel,
               notes, created_at, updated_at
        FROM public.centres ORDER BY created_at
      `);
      for (const c of centreRows) {
        await client.query(
          `INSERT INTO centres (id, name, address, primary_channel, notes, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          [c.id, c.name, c.address ?? '', c.primary_channel, c.notes ?? '', c.created_at, c.updated_at],
        );
      }
      console.log(`[import] centres: ${centreRows.length}`);

      // --- Centre contacts & secondary channels ---------------------------------
      const { rows: contacts } = await source.query(`SELECT * FROM public.centre_contacts ORDER BY sort_order`);
      for (const r of contacts) {
        await client.query(
          `INSERT INTO centre_contacts (id, centre_id, name, title, email, phone, sort_order, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
          [r.id, r.centre_id, r.name, r.title, r.email, r.phone, r.sort_order, r.created_at, r.updated_at],
        );
      }
      console.log(`[import] centre_contacts: ${contacts.length}`);

      const { rows: secCh } = await source.query(`SELECT * FROM public.centre_secondary_channels`);
      for (const r of secCh) {
        await client.query(
          `INSERT INTO centre_secondary_channels (centre_id, channel, created_at)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [r.centre_id, r.channel, r.created_at],
        );
      }
      console.log(`[import] centre_secondary_channels: ${secCh.length}`);

      // --- Staff ----------------------------------------------------------------
      const { rows: staffRows } = await source.query(`SELECT * FROM public.staff ORDER BY created_at`);
      for (const s of staffRows) {
        await client.query(
          `INSERT INTO staff (id, legal_name, display_name, use_display_name, phone, email, role, status, notes, documents_url, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
          [
            s.id, s.legal_name, s.display_name, s.use_display_name, s.phone, s.email, s.role,
            s.status, s.notes, s.documents_url, s.created_at, s.updated_at,
          ],
        );
      }
      console.log(`[import] staff: ${staffRows.length}`);

      for (const table of ['staff_centre_top', 'staff_centre_banned'] as const) {
        const { rows } = await source.query(`SELECT * FROM public.${table}`);
        for (const r of rows) {
          await client.query(
            `INSERT INTO ${table} (staff_id, centre_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [r.staff_id, r.centre_id, r.created_at],
          );
        }
        console.log(`[import] ${table}: ${rows.length}`);
      }

      // --- Availability, shifts, contacted, comments --------------------------
      const { rows: avail } = await source.query(`SELECT * FROM public.availability ORDER BY created_at`);
      for (const r of avail) {
        await client.query(
          `INSERT INTO availability (id, staff_id, week_start_date, day_of_week, start_time, end_time, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          [r.id, r.staff_id, r.week_start_date, r.day_of_week, r.start_time, r.end_time, r.created_at],
        );
      }
      console.log(`[import] availability: ${avail.length}`);

      const { rows: shiftRows } = await source.query(`SELECT * FROM public.shifts ORDER BY created_at`);
      for (const s of shiftRows) {
        await client.query(
          `INSERT INTO shifts (id, centre_id, shift_date, start_time, end_time, role_needed, notes, status,
            assigned_staff_id, cancellation_reason, added_to_staffpoint, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
          [
            s.id, s.centre_id, s.shift_date, s.start_time, s.end_time, s.role_needed, s.notes, s.status,
            s.assigned_staff_id, s.cancellation_reason, s.added_to_staffpoint ?? false, s.created_at, s.updated_at,
          ],
        );
      }
      console.log(`[import] shifts: ${shiftRows.length}`);

      const { rows: contacted } = await source.query(`SELECT * FROM public.shift_contacted`);
      for (const r of contacted) {
        await client.query(
          `INSERT INTO shift_contacted (shift_id, staff_id, contacted_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [r.shift_id, r.staff_id, r.contacted_at],
        );
      }
      console.log(`[import] shift_contacted: ${contacted.length}`);

      const { rows: comments } = await source.query(`SELECT * FROM public.shift_comments ORDER BY created_at`);
      let skippedComments = 0;
      for (const r of comments) {
        const { rows: author } = await client.query(`SELECT 1 FROM users WHERE id = $1`, [r.author_id]);
        if (!author[0]) {
          skippedComments++;
          continue;
        }
        await client.query(
          `INSERT INTO shift_comments (id, shift_id, author_id, body, created_at)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
          [r.id, r.shift_id, r.author_id, r.body, r.created_at],
        );
      }
      console.log(`[import] shift_comments: ${comments.length - skippedComments} (${skippedComments} skipped — missing author)`);

      await client.query('COMMIT');
      console.log('[import] done.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await source.end();
    await target.end();
  }
}

void main().catch((err) => {
  console.error('[import] failed:', err);
  process.exit(1);
});

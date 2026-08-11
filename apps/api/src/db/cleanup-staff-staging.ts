/**
 * STAGING-ONLY maintenance: remove all Staff + Carer Portal lifecycle data.
 *
 * Preserves: ops users, centres, centre contacts/channels, shifts (rows kept;
 * assigned/contacted staff links cleared), applications (+ documents/activity).
 *
 * Run ONLY inside the intra-ops-test API container on the staging droplet,
 * after a fresh Postgres backup.
 *
 * Usage:
 *   node dist/db/cleanup-staff-staging.js --dry-run
 *   STAGING_STAFF_CLEANUP_CONFIRM=YES node dist/db/cleanup-staff-staging.js --execute
 *
 * Local verification (dev Postgres on 127.0.0.1:5434 only):
 *   LOCAL_STAFF_CLEANUP_TEST=YES node --import tsx src/db/cleanup-staff-staging.ts --dry-run --allow-local-test-db
 *
 * Before --execute on staging:
 *   1. Backup (self-contained; env vars read inside postgres container):
 *      mkdir -p /var/backups
 *      BACKUP="/var/backups/intra-platform-pre-staff-cleanup-$(date -u +%Y%m%dT%H%M%S).dump"
 *      docker compose -p intra-ops-test exec -T postgres \
 *        sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP"
 *      test -s "$BACKUP" && ls -lh "$BACKUP"
 *   2. Run --dry-run and review counts
 *   3. Set STAGING_STAFF_CLEANUP_CONFIRM=YES
 *   4. Post-cleanup health: curl -fsS https://platform.intra.ca/api/health
 *      (internal: fetch http://127.0.0.1:8000/api/health from api container)
 */
import { config as loadDotenv } from 'dotenv';
import { Pool, type PoolClient } from 'pg';
import Redis from 'ioredis';
import { findRepoRootEnvFile } from '../config/root-env';
import { assertLocalDatabaseUrl } from './local-db-guard';
import {
  assertStagingCleanupConfirmation,
  assertStagingMaintenanceEnvironment,
} from './staging-db-guard';
import {
  assertStaffDocumentStorageDeleteSucceeded,
  deleteStaffDocumentStorageKeys,
} from '../storage/staff-document-storage-cleanup.util';
import { isStaffDocumentStorageKey } from '../storage/storage-key.util';

const STAFF_SESSION_PREFIX = 'staffsess:';

export interface StaffCleanupCounts {
  staff: number;
  staffAccounts: number;
  staffPortalAuditEvents: number;
  availability: number;
  staffCentreTop: number;
  staffCentreBanned: number;
  shiftContacted: number;
  shiftsAssigned: number;
  applicationsHiredStaff: number;
  staffSourceApplicationLinks: number;
  staffDocumentSets: number;
  staffDocumentSubmissions: number;
  staffDocumentFiles: number;
  staffDocumentStorageKeys: number;
}

export interface PreservedCounts {
  users: number;
  centres: number;
  centreContacts: number;
  centreSecondaryChannels: number;
  shifts: number;
  shiftComments: number;
  applications: number;
  applicationDocuments: number;
  applicationActivity: number;
}

export interface CleanupEnvironmentOptions {
  execute: boolean;
  allowLocalTestDb: boolean;
  databaseUrl: string;
}

export function assertCleanupEnvironment(options: CleanupEnvironmentOptions): void {
  assertStagingCleanupConfirmation(options.execute);
  if (options.allowLocalTestDb) {
    if (process.env.LOCAL_STAFF_CLEANUP_TEST?.trim() !== 'YES') {
      throw new Error(
        'Refusing to run: --allow-local-test-db requires LOCAL_STAFF_CLEANUP_TEST=YES.',
      );
    }
    assertLocalDatabaseUrl(options.databaseUrl);
    return;
  }
  assertStagingMaintenanceEnvironment(options.databaseUrl);
}

function parseTableCount(value: unknown, label: string): number {
  if (value === null || value === undefined) {
    throw new Error(`Could not determine count for ${label}.`);
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid count for ${label}: ${String(value)}.`);
  }
  return n;
}

export async function readStaffCleanupCounts(client: PoolClient): Promise<StaffCleanupCounts> {
  const { rows } = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM staff) AS staff,
      (SELECT COUNT(*)::int FROM staff_accounts) AS staff_accounts,
      (SELECT COUNT(*)::int FROM staff_portal_audit_events) AS staff_portal_audit_events,
      (SELECT COUNT(*)::int FROM availability) AS availability,
      (SELECT COUNT(*)::int FROM staff_centre_top) AS staff_centre_top,
      (SELECT COUNT(*)::int FROM staff_centre_banned) AS staff_centre_banned,
      (SELECT COUNT(*)::int FROM shift_contacted) AS shift_contacted,
      (SELECT COUNT(*)::int FROM shifts WHERE assigned_staff_id IS NOT NULL) AS shifts_assigned,
      (SELECT COUNT(*)::int FROM applications WHERE hired_staff_id IS NOT NULL) AS applications_hired_staff,
      (SELECT COUNT(*)::int FROM staff WHERE source_application_id IS NOT NULL) AS staff_source_application_links,
      (SELECT COUNT(*)::int FROM staff_document_sets) AS staff_document_sets,
      (SELECT COUNT(*)::int FROM staff_document_submissions) AS staff_document_submissions,
      (SELECT COUNT(*)::int FROM staff_document_files) AS staff_document_files,
      (SELECT COUNT(*)::int FROM staff_document_files) AS staff_document_storage_keys
  `);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('Could not read staff cleanup counts.');

  return {
    staff: parseTableCount(row.staff, 'staff'),
    staffAccounts: parseTableCount(row.staff_accounts, 'staff_accounts'),
    staffPortalAuditEvents: parseTableCount(row.staff_portal_audit_events, 'staff_portal_audit_events'),
    availability: parseTableCount(row.availability, 'availability'),
    staffCentreTop: parseTableCount(row.staff_centre_top, 'staff_centre_top'),
    staffCentreBanned: parseTableCount(row.staff_centre_banned, 'staff_centre_banned'),
    shiftContacted: parseTableCount(row.shift_contacted, 'shift_contacted'),
    shiftsAssigned: parseTableCount(row.shifts_assigned, 'shifts_assigned'),
    applicationsHiredStaff: parseTableCount(row.applications_hired_staff, 'applications_hired_staff'),
    staffSourceApplicationLinks: parseTableCount(
      row.staff_source_application_links,
      'staff_source_application_links',
    ),
    staffDocumentSets: parseTableCount(row.staff_document_sets, 'staff_document_sets'),
    staffDocumentSubmissions: parseTableCount(
      row.staff_document_submissions,
      'staff_document_submissions',
    ),
    staffDocumentFiles: parseTableCount(row.staff_document_files, 'staff_document_files'),
    staffDocumentStorageKeys: parseTableCount(
      row.staff_document_storage_keys,
      'staff_document_storage_keys',
    ),
  };
}

/** Lists staff/ object keys only — application documents are never included. */
export async function readStaffDocumentStorageKeys(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ storage_key: string }>(`
    SELECT f.storage_key
    FROM staff_document_files f
    ORDER BY f.storage_key
  `);
  return rows.map((row) => row.storage_key).filter((key) => isStaffDocumentStorageKey(key));
}

export async function purgeStaffDocumentStorage(
  keys: string[],
  env: Record<string, unknown>,
): Promise<void> {
  if (keys.length === 0) return;
  const result = await deleteStaffDocumentStorageKeys(keys, env);
  assertStaffDocumentStorageDeleteSucceeded(result, keys.length);
}

export async function readPreservedCounts(client: PoolClient): Promise<PreservedCounts> {
  const { rows } = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM centres) AS centres,
      (SELECT COUNT(*)::int FROM centre_contacts) AS centre_contacts,
      (SELECT COUNT(*)::int FROM centre_secondary_channels) AS centre_secondary_channels,
      (SELECT COUNT(*)::int FROM shifts) AS shifts,
      (SELECT COUNT(*)::int FROM shift_comments) AS shift_comments,
      (SELECT COUNT(*)::int FROM applications) AS applications,
      (SELECT COUNT(*)::int FROM application_documents) AS application_documents,
      (SELECT COUNT(*)::int FROM application_activity) AS application_activity
  `);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('Could not read preserved table counts.');

  return {
    users: parseTableCount(row.users, 'users'),
    centres: parseTableCount(row.centres, 'centres'),
    centreContacts: parseTableCount(row.centre_contacts, 'centre_contacts'),
    centreSecondaryChannels: parseTableCount(row.centre_secondary_channels, 'centre_secondary_channels'),
    shifts: parseTableCount(row.shifts, 'shifts'),
    shiftComments: parseTableCount(row.shift_comments, 'shift_comments'),
    applications: parseTableCount(row.applications, 'applications'),
    applicationDocuments: parseTableCount(row.application_documents, 'application_documents'),
    applicationActivity: parseTableCount(row.application_activity, 'application_activity'),
  };
}

export function printDryRunReport(
  staffCounts: StaffCleanupCounts,
  preservedBefore: PreservedCounts,
  options: { allowLocalTestDb: boolean },
) {
  console.log('[cleanup:staff-staging] dry-run (no writes)');
  console.log(`  target: ${options.allowLocalTestDb ? 'local test Postgres' : 'staging intra-ops-test'}`);
  console.log('  staff records:', staffCounts.staff);
  console.log('  staff accounts:', staffCounts.staffAccounts);
  console.log('  portal audit events:', staffCounts.staffPortalAuditEvents);
  console.log('  availability records:', staffCounts.availability);
  console.log('  staff centre top links:', staffCounts.staffCentreTop);
  console.log('  staff centre banned links:', staffCounts.staffCentreBanned);
  console.log('  shift contacted links (will be removed):', staffCounts.shiftContacted);
  console.log('  shifts with assigned staff (will be detached):', staffCounts.shiftsAssigned);
  console.log('  applications with hired staff (will be detached):', staffCounts.applicationsHiredStaff);
  console.log('  staff source-application links (will be cleared):', staffCounts.staffSourceApplicationLinks);
  console.log('  staff document sets:', staffCounts.staffDocumentSets);
  console.log('  staff document submissions:', staffCounts.staffDocumentSubmissions);
  console.log('  staff document files:', staffCounts.staffDocumentFiles);
  console.log('  staff document storage keys (staff/ only):', staffCounts.staffDocumentStorageKeys);
  console.log('  preserved users:', preservedBefore.users);
  console.log('  preserved centres:', preservedBefore.centres);
  console.log('  preserved shifts:', preservedBefore.shifts);
  console.log('  preserved applications:', preservedBefore.applications);
  console.log('  write: skipped (dry-run)');
}

export function printExecuteReport(
  staffCountsBefore: StaffCleanupCounts,
  preservedBefore: PreservedCounts,
  preservedAfter: PreservedCounts,
  redisStaffSessionsRemoved: number | null,
) {
  console.log('[cleanup:staff-staging] execute complete');
  console.log('  removed staff records:', staffCountsBefore.staff);
  console.log('  removed staff accounts:', staffCountsBefore.staffAccounts);
  console.log('  removed portal audit events:', staffCountsBefore.staffPortalAuditEvents);
  console.log('  removed availability records:', staffCountsBefore.availability);
  console.log('  removed shift contacted links:', staffCountsBefore.shiftContacted);
  console.log('  detached shift assignments:', staffCountsBefore.shiftsAssigned);
  console.log('  detached application hire links:', staffCountsBefore.applicationsHiredStaff);
  console.log('  removed staff document files:', staffCountsBefore.staffDocumentFiles);
  console.log('  removed staff document storage keys:', staffCountsBefore.staffDocumentStorageKeys);
  if (redisStaffSessionsRemoved !== null) {
    console.log('  redis staff portal sessions removed:', redisStaffSessionsRemoved);
  }
  console.log('  users unchanged:', preservedBefore.users, '→', preservedAfter.users);
  console.log('  centres unchanged:', preservedBefore.centres, '→', preservedAfter.centres);
  console.log('  shifts unchanged:', preservedBefore.shifts, '→', preservedAfter.shifts);
  console.log('  applications unchanged:', preservedBefore.applications, '→', preservedAfter.applications);
}

/**
 * Detach staff from preserved entities, then delete staff lifecycle rows.
 * Single Postgres transaction — rolls back on any failure.
 */
export async function runStaffCleanup(client: PoolClient): Promise<void> {
  await client.query('BEGIN');

  try {
    await client.query(`
      UPDATE applications SET hired_staff_id = NULL WHERE hired_staff_id IS NOT NULL
    `);
    await client.query(`
      UPDATE shifts SET assigned_staff_id = NULL WHERE assigned_staff_id IS NOT NULL
    `);
    await client.query(`
      UPDATE staff SET source_application_id = NULL WHERE source_application_id IS NOT NULL
    `);

    await client.query(`DELETE FROM shift_contacted`);
    await client.query(`DELETE FROM availability`);
    await client.query(`DELETE FROM staff_portal_audit_events`);
    await client.query(`DELETE FROM staff_accounts`);
    await client.query(`DELETE FROM staff_centre_top`);
    await client.query(`DELETE FROM staff_centre_banned`);
    await client.query(`DELETE FROM staff`);

    const remaining = await readStaffCleanupCounts(client);
    if (remaining.staff !== 0 || remaining.staffAccounts !== 0) {
      throw new Error(
        `Cleanup incomplete: staff=${remaining.staff}, staff_accounts=${remaining.staffAccounts}.`,
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

export async function purgeStaffPortalRedisSessions(redisUrl: string): Promise<number> {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
  await redis.connect();

  try {
    let removed = 0;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${STAFF_SESSION_PREFIX}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) {
        removed += await redis.del(...keys);
      }
    } while (cursor !== '0');
    return removed;
  } finally {
    redis.disconnect();
  }
}

function printUsage() {
  console.log(`Usage:
  node dist/db/cleanup-staff-staging.js --dry-run
  STAGING_STAFF_CLEANUP_CONFIRM=YES node dist/db/cleanup-staff-staging.js --execute

Local test only (127.0.0.1 / localhost Postgres):
  LOCAL_STAFF_CLEANUP_TEST=YES node --import tsx src/db/cleanup-staff-staging.ts --dry-run --allow-local-test-db

Before --execute on staging:
  1. Backup (self-contained; env vars read inside postgres container):
     mkdir -p /var/backups
     BACKUP="/var/backups/intra-platform-pre-staff-cleanup-$(date -u +%Y%m%dT%H%M%S).dump"
     docker compose -p intra-ops-test exec -T postgres \\
       sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP"
     test -s "$BACKUP" && ls -lh "$BACKUP"
  2. Run --dry-run and review counts
  3. Set STAGING_STAFF_CLEANUP_CONFIRM=YES
  4. Post-cleanup: curl -fsS https://platform.intra.ca/api/health`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const execute = args.includes('--execute');
  const allowLocalTestDb = args.includes('--allow-local-test-db');

  if (args.includes('--help') || args.length === 0 || (dryRun && execute) || (!dryRun && !execute)) {
    printUsage();
    process.exit(args.includes('--help') ? 0 : 1);
  }

  const rootEnvFile = findRepoRootEnvFile();
  if (rootEnvFile) loadDotenv({ path: rootEnvFile });

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('Missing DATABASE_URL.');

  assertCleanupEnvironment({ execute, allowLocalTestDb, databaseUrl });

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const client = await pool.connect();

  try {
    const staffBefore = await readStaffCleanupCounts(client);
    const preservedBefore = await readPreservedCounts(client);

    if (dryRun) {
      printDryRunReport(staffBefore, preservedBefore, { allowLocalTestDb });
      return;
    }

    const storageKeys = await readStaffDocumentStorageKeys(client);
    await purgeStaffDocumentStorage(storageKeys, process.env as Record<string, unknown>);

    await runStaffCleanup(client);

    const staffAfter = await readStaffCleanupCounts(client);
    const preservedAfter = await readPreservedCounts(client);

    let redisRemoved: number | null = null;
    const redisUrl = process.env.REDIS_URL?.trim();
    if (redisUrl) {
      redisRemoved = await purgeStaffPortalRedisSessions(redisUrl);
    }

    printExecuteReport(staffBefore, preservedBefore, preservedAfter, redisRemoved);

    if (staffAfter.staff !== 0 || staffAfter.staffAccounts !== 0) {
      throw new Error('Post-cleanup verification failed: staff data remains.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.env.VITEST !== 'true') {
  void main().catch((err) => {
    console.error('[cleanup:staff-staging] failed:', (err as Error).message);
    process.exit(1);
  });
}

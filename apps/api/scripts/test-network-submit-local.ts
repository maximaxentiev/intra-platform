/**
 * Local end-to-end smoke test for POST /api/v1/public/applications/network.
 * Usage (from apps/api): node --import tsx scripts/test-network-submit-local.ts
 */
import { config as loadDotenv } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRootEnvFile } from '../src/config/root-env';

const envPath = findRepoRootEnvFile();
if (envPath) loadDotenv({ path: envPath });

const API_BASE = process.env.VITE_API_URL ?? 'http://localhost:8000';
const API_KEY = process.env.NETWORK_APPLICATION_API_KEY ?? '';

if (!API_KEY) {
  console.error('NETWORK_APPLICATION_API_KEY is not set in root .env');
  process.exit(1);
}

function fakePdf(path: string, label: string) {
  writeFileSync(path, `%PDF-1.4 fake ${label}\n`.padEnd(128, '0'));
}

function fakePng(path: string) {
  writeFileSync(path, Buffer.alloc(64, 0x89));
}

async function submitMultipart(
  label: string,
  payload: Record<string, unknown>,
  files: Array<{ field: string; path: string; mime: string }>,
  auth = true,
) {
  const form = new FormData();
  form.append('application', JSON.stringify(payload));
  for (const file of files) {
    const blob = new Blob([readFileSync(file.path)], { type: file.mime });
    form.append(file.field, blob, file.path.split(/[/\\]/).pop());
  }

  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = `Bearer ${API_KEY}`;

  const res = await fetch(`${API_BASE}/api/v1/public/applications/network`, {
    method: 'POST',
    headers,
    body: form,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  console.log(`\n[${label}] ${res.status}`, json);
  return { status: res.status, json };
}

function buildPayload(role: 'ECA' | 'Nanny', externalApplicationId: string) {
  const vscId = randomUUID();
  const cprId = randomUUID();
  const immId = randomUUID();
  const qualOrTrainingId = randomUUID();

  const documents =
    role === 'Nanny'
      ? [
          { id: vscId, category: 'vulnerable_sector_check', originalFilename: 'vsc.pdf', contentType: 'application/pdf', size: 128 },
          { id: cprId, category: 'first_aid_cpr', originalFilename: 'cpr.pdf', contentType: 'application/pdf', size: 128 },
          { id: immId, category: 'immunization_records', originalFilename: 'imm.pdf', contentType: 'application/pdf', size: 128 },
          { id: qualOrTrainingId, category: 'training_proof', originalFilename: 'training.png', contentType: 'image/png', size: 64 },
        ]
      : [
          { id: vscId, category: 'vulnerable_sector_check', originalFilename: 'vsc.pdf', contentType: 'application/pdf', size: 128 },
          { id: cprId, category: 'first_aid_cpr', originalFilename: 'cpr.pdf', contentType: 'application/pdf', size: 128 },
          { id: immId, category: 'immunization_records', originalFilename: 'imm.pdf', contentType: 'application/pdf', size: 128 },
          { id: qualOrTrainingId, category: 'qualification_certificate', originalFilename: 'qual.pdf', contentType: 'application/pdf', size: 128 },
        ];

  return {
    payload: {
      metadata: {
        formId: 'join-network-local-test',
        externalApplicationId,
        submittedAt: new Date().toISOString(),
        sourcePage: '/join-the-network',
        sourceUrl: 'http://localhost/join-the-network',
        consentAccepted: true,
        consentPolicyVersion: '2026-07-01',
      },
      role,
      applicant: {
        firstName: 'Local',
        middleName: '',
        lastName: 'TestApplicant',
        email: `local-test-${externalApplicationId.slice(0, 8)}@example.test`,
        phone: '4165550199',
        gender: 'prefer_not_to_say',
      },
      eligibility: { gtaEligible: true, statusInCanada: 'permanent_resident' },
      experience: { duration: '1_year', types: role === 'Nanny' ? ['infant'] : undefined },
      roleSpecific:
        role === 'Nanny'
          ? { training: { completed: true, description: 'Local test training' } }
          : { qualification: { status: 'registered' } },
      compliance: {
        vulnerableSectorCheck: { hasDocument: true, issueDate: '2026-01-01' },
        firstAidCpr: { hasDocument: true, expiryDate: '2027-01-01' },
        immunizations: { hasRequiredImmunizations: true },
        covid19: { vaccinated: true, proofProvided: false },
      },
      languages: { englishProficiency: 'fluent', speaksAdditionalLanguages: false },
      documents,
    },
    files:
      role === 'Nanny'
        ? [
            { field: `doc_${vscId}`, path: join(__dirname, '.tmp-vsc.pdf'), mime: 'application/pdf' },
            { field: `doc_${cprId}`, path: join(__dirname, '.tmp-cpr.pdf'), mime: 'application/pdf' },
            { field: `doc_${immId}`, path: join(__dirname, '.tmp-imm.pdf'), mime: 'application/pdf' },
            { field: `doc_${qualOrTrainingId}`, path: join(__dirname, '.tmp-training.png'), mime: 'image/png' },
          ]
        : [
            { field: `doc_${vscId}`, path: join(__dirname, '.tmp-vsc.pdf'), mime: 'application/pdf' },
            { field: `doc_${cprId}`, path: join(__dirname, '.tmp-cpr.pdf'), mime: 'application/pdf' },
            { field: `doc_${immId}`, path: join(__dirname, '.tmp-imm.pdf'), mime: 'application/pdf' },
            { field: `doc_${qualOrTrainingId}`, path: join(__dirname, '.tmp-qual.pdf'), mime: 'application/pdf' },
          ],
  };
}

async function verifyDb(applicationId: string) {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = await pool.query('SELECT id, status, role, nanny_training_completed FROM applications WHERE id = $1', [
    applicationId,
  ]);
  const docs = await pool.query(
    'SELECT id, category, storage_key FROM application_documents WHERE application_id = $1',
    [applicationId],
  );
  const activity = await pool.query(
    'SELECT event_type, actor_type FROM application_activity WHERE application_id = $1',
    [applicationId],
  );
  await pool.end();
  return { app: app.rows[0], docs: docs.rows, activity: activity.rows };
}

async function main() {
  fakePdf(join(__dirname, '.tmp-vsc.pdf'), 'vsc');
  fakePdf(join(__dirname, '.tmp-cpr.pdf'), 'cpr');
  fakePdf(join(__dirname, '.tmp-imm.pdf'), 'imm');
  fakePdf(join(__dirname, '.tmp-qual.pdf'), 'qual');
  fakePng(join(__dirname, '.tmp-training.png'));

  const ecaExternalId = randomUUID();
  const eca = buildPayload('ECA', ecaExternalId);
  const ecaResult = await submitMultipart('ECA submit', eca.payload, eca.files);
  if (ecaResult.status !== 200 && ecaResult.status !== 201) process.exit(1);

  const ecaAppId = (ecaResult.json as { applicationId: string }).applicationId;
  const ecaDb = await verifyDb(ecaAppId);
  console.log('[ECA DB]', {
    status: ecaDb.app?.status,
    role: ecaDb.app?.role,
    docs: ecaDb.docs.length,
    activity: ecaDb.activity.map((a: { event_type: string }) => a.event_type),
  });

  const nannyExternalId = randomUUID();
  const nanny = buildPayload('Nanny', nannyExternalId);
  const nannyResult = await submitMultipart('Nanny submit', nanny.payload, nanny.files);
  const nannyAppId = (nannyResult.json as { applicationId: string }).applicationId;
  const nannyDb = await verifyDb(nannyAppId);
  console.log('[Nanny DB]', {
    role: nannyDb.app?.role,
    nannyTrainingCompleted: nannyDb.app?.nanny_training_completed,
    docs: nannyDb.docs.length,
  });

  await submitMultipart('Auth failure', eca.payload, eca.files, false);

  const invalid = { ...eca.payload, role: 'InvalidRole' };
  await submitMultipart('Invalid role', invalid, eca.files);

  const idempotent = await submitMultipart('Idempotency retry', eca.payload, eca.files);
  const idempotent2 = await submitMultipart('Idempotency retry 2', eca.payload, eca.files);
  console.log('[Idempotency]', {
    first: (idempotent.json as { applicationId: string }).applicationId,
    second: (idempotent2.json as { applicationId: string }).applicationId,
    same: (idempotent.json as { applicationId: string }).applicationId ===
      (idempotent2.json as { applicationId: string }).applicationId,
  });

  for (const p of ['.tmp-vsc.pdf', '.tmp-cpr.pdf', '.tmp-imm.pdf', '.tmp-qual.pdf', '.tmp-training.png']) {
    try {
      unlinkSync(join(__dirname, p));
    } catch {
      /* ignore */
    }
  }

  console.log('\nLocal test application IDs (safe to delete later):', ecaAppId, nannyAppId);
  console.log('External submission IDs:', ecaExternalId, nannyExternalId);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});

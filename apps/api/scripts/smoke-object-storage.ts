/**
 * One-off Phase 2A connectivity smoke test. Run from apps/api:
 *   npx tsx scripts/smoke-object-storage.ts
 *
 * Uses root .env via findRepoRootEnvFile. Never prints secrets.
 */
import { ConfigService } from '@nestjs/config';
import { config as loadDotenv } from 'dotenv';
import { findRepoRootEnvFile } from '../src/config/root-env';
import { StorageService } from '../src/storage/storage.service';

const SMOKE_APP_ID = '00000000-0000-4000-8000-000000000001';
const SMOKE_DOC_ID = '00000000-0000-4000-8000-000000000002';
const SMOKE_KEY = `applications/${SMOKE_APP_ID}/${SMOKE_DOC_ID}/phase-2a-smoke-test.txt`;
const SMOKE_BODY = 'intra-platform phase-2a storage smoke test — no personal data';

async function main() {
  const envFile = findRepoRootEnvFile();
  if (envFile) loadDotenv({ path: envFile });

  const configService = new ConfigService(process.env);
  const storage = new StorageService(configService);

  const results: Record<string, boolean | string> = {};

  results.configured = storage.isConfigured();
  if (!results.configured) {
    console.log('SMOKE_RESULT=configured=false');
    process.exit(1);
  }

  const summary = storage.getConfigSummary();
  results.bucket = summary.bucket ?? 'unknown';
  results.endpointRegion = `${summary.endpoint ?? '?'} (${summary.region ?? '?'})`;

  try {
    const ping = await storage.checkConnectivity();
    results.connectivity = ping.ok === true;
    results.bucketAccessible = ping.bucket === summary.bucket;
  } catch {
    results.connectivity = false;
    results.bucketAccessible = false;
  }

  if (!results.connectivity) {
    printResults(results);
    process.exit(1);
  }

  try {
    await storage.uploadObject({
      key: SMOKE_KEY,
      body: Buffer.from(SMOKE_BODY, 'utf8'),
      contentType: 'text/plain',
      metadata: { purpose: 'phase-2a-smoke-test' },
    });
    results.write = true;
  } catch {
    results.write = false;
  }

  try {
    const stream = await storage.getObjectStream(SMOKE_KEY);
    const chunks: Buffer[] = [];
    for await (const chunk of stream.body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString('utf8');
    results.read = text === SMOKE_BODY;
  } catch {
    results.read = false;
  }

  try {
    await storage.deleteObject(SMOKE_KEY);
    results.delete = true;
  } catch {
    results.delete = false;
  }

  printResults(results);

  const allPassed =
    results.configured === true &&
    results.connectivity === true &&
    results.bucketAccessible === true &&
    results.write === true &&
    results.read === true &&
    results.delete === true;

  process.exit(allPassed ? 0 : 1);
}

function printResults(results: Record<string, boolean | string>) {
  console.log('=== Phase 2A object storage smoke test ===');
  console.log(`1. configured: ${results.configured}`);
  console.log(`2. connectivity: ${results.connectivity}`);
  console.log(`3. bucket (${results.bucket}): ${results.bucketAccessible ? 'accessible' : 'FAILED'}`);
  console.log(`4. write: ${results.write === true ? 'PASS' : 'FAIL'}`);
  console.log(`5. read: ${results.read === true ? 'PASS' : 'FAIL'}`);
  console.log(`6. delete: ${results.delete === true ? 'PASS' : 'FAIL'}`);
  console.log(`endpoint: ${results.endpointRegion}`);
  console.log('==========================================');
}

void main().catch((err) => {
  console.error('SMOKE_ERROR:', err instanceof Error ? err.message : 'unknown');
  process.exit(1);
});

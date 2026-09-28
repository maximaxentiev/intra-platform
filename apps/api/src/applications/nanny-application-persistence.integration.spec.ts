import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema';
import { applications } from '../db/schema';
import { ApplicationsService } from './applications.service';
import { buildNannyV2ApplicationJson } from './network-submit-nanny.test-fixtures';
import { parseNetworkApplicationJson } from './network-submit.validation';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://intra:intra-dev-password@127.0.0.1:5434/intra';

async function probePostgres(): Promise<boolean> {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2500, max: 1 });
  try {
    await pool.query('select 1');
    await pool.end();
    return true;
  } catch {
    await pool.end().catch(() => undefined);
    return false;
  }
}

const POSTGRES_READY = await probePostgres();

describe.skipIf(!POSTGRES_READY)('Nanny v2 application persistence integration', () => {
  it('returns every stored nanny answer through authenticated detail API', async () => {
    const json = buildNannyV2ApplicationJson({
      canadaStatus: 'Canadian citizen',
      spokenEnglishRating: 7,
    });
    const parsed = parseNetworkApplicationJson(JSON.stringify(json));
    const id = randomUUID();
    const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
    const db = drizzle(pool, { schema });

    await db.insert(applications).values({
      id,
      status: 'new',
      role: 'nanny',
      firstName: parsed.applicant.firstName,
      lastName: parsed.applicant.lastName,
      email: parsed.applicant.email,
      phone: parsed.applicant.phone,
      preferredName: parsed.applicant.preferredName ?? '',
      city: parsed.applicant.city ?? '',
      postalCode: parsed.applicant.postalCode ?? '',
      accuracyConfirmed: parsed.accuracyConfirmed ?? true,
      gtaEligible: parsed.eligibility.gtaEligible,
      statusInCanada: parsed.eligibility.statusInCanada,
      experienceDuration: parsed.experience.duration,
      nannyExperienceTypes: parsed.experience.types ?? [],
      vscStatus: parsed.compliance.nannyVscStatus ?? '',
      vscIssueOrRequestDate: parsed.compliance.vulnerableSectorCheck.issueDate ?? null,
      firstAidCprStatus: parsed.compliance.nannyFirstAidStatus ?? '',
      firstAidCprExpiry: parsed.compliance.firstAidCpr.expiryDate ?? null,
      englishProficiency: parsed.languages.englishProficiency,
      externalSubmissionId: parsed.metadata.externalApplicationId,
      payloadSnapshot: parsed.websitePayload ?? {},
      consentAccepted: true,
      consentPolicyVersion: parsed.metadata.consentPolicyVersion,
    });

    const service = new ApplicationsService(db, { isConfigured: () => false } as never);
    const detail = await service.get(id);

    expect(detail.nanny?.intakeVersion).toBe('nanny_v2');
    expect(detail.applicant.city).toBe('Toronto');
    expect(detail.nanny?.languages.spokenEnglishRating).toBe(7);
    expect(detail.nanny?.experience.types).toContain('Nanny');
    expect(detail.nanny?.qualifications.educationCertifications).toContain('ECE diploma');
    expect(detail.metadata.accuracyConfirmed).toBe(true);

    await db.delete(applications).where(eq(applications.id, id));
    await pool.end();
  });
});
